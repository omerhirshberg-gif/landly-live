import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'
import type { Auth } from 'firebase-admin/auth'
import { encryptField } from '@/lib/crypto/fieldCipher'
import { auditInTransaction } from '@/lib/admin/auditLog'
import { clientIp } from '@/lib/auth/clientIp'
import { INVITE_COLLECTION } from './invites'
import { hashInviteToken, isInviteTokenShape } from './inviteToken'
import { isPublicTaxId, validateOnboarding, type OnboardingField } from './validation'
import { renderContractPdf } from './contractPdf'
import { parseFrozenTerms, type PaymentTerms } from './terms'

// A link that can't be used says nothing about why (unknown, expired, used or
// revoked all read the same), so it can't be probed.
export class InviteUnavailableError extends Error {
  constructor() { super('This link is no longer valid.') }
}
export class OnboardingInputError extends Error {
  constructor(message: string, public readonly fields: Partial<Record<OnboardingField | 'signature' | 'cheque', string>> = {}) { super(message) }
}

export interface InviteView {
  businessName: string
  commissionRate: number
  paymentTerms: PaymentTerms
  contactEmail: string
  lang: 'he' | 'en'
  expiresAt: string
}

const STALE_PROCESSING_MS = 5 * 60 * 1000
const usable = (status: unknown) => status === 'pending' || status === 'opened'

/** Looks the invite up by the link's token. Throws InviteUnavailableError for anything but a live one. */
export async function loadInvite(db: Firestore, token: unknown, { markOpened = false } = {}): Promise<InviteView> {
  if (!isInviteTokenShape(token)) throw new InviteUnavailableError()
  const ref = db.collection(INVITE_COLLECTION).doc(hashInviteToken(token))
  const snap = await ref.get()
  const invite = snap.data()
  if (!invite || !usable(invite.status) || !(invite.expiresAt instanceof Timestamp) || invite.expiresAt.toMillis() < Date.now()) {
    throw new InviteUnavailableError()
  }
  if (markOpened && invite.status === 'pending') await ref.update({ status: 'opened', openedAt: Timestamp.now() }).catch(() => {})
  return {
    businessName: invite.businessName, commissionRate: invite.commissionRate, paymentTerms: invite.paymentTerms,
    contactEmail: invite.contactEmail, lang: invite.lang === 'en' ? 'en' : 'he', expiresAt: invite.expiresAt.toDate().toISOString(),
  }
}

const MAX_SIGNATURE_BYTES = 300 * 1024
export const MAX_CHEQUE_BYTES = 4 * 1024 * 1024
const CHEQUE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' }

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47]
const isPng = (b: Uint8Array) => PNG_MAGIC.every((v, i) => b[i] === v)
const sniff = (b: Uint8Array, type: string) =>
  type === 'image/png' ? isPng(b) : type === 'image/jpeg' ? b[0] === 0xff && b[1] === 0xd8 : b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46

export interface CompletionInput {
  token: string
  raw: Record<string, unknown>
  signaturePng: Uint8Array
  cheque: { bytes: Uint8Array; type: string }
  request: Request
}
export interface Storage { save(path: string, bytes: Uint8Array, contentType: string): Promise<void> }

export interface CompletionResult { businessId: string; contractId: string; pdf: Uint8Array; email: string; lang: 'he' | 'en'; businessName: string; createdAccount: boolean }

/**
 * Turns a live invite into a merchant: claims the invite (single use), creates
 * or attaches the business, stores the bank details encrypted and the cheque
 * and contract privately, and writes the immutable contract record.
 *
 * The invite is flipped to `processing` first inside a transaction, so two
 * submissions of one link can't both go through; if anything fails it goes
 * back to `opened` and the merchant can retry the same link.
 */
export async function completeOnboarding(db: Firestore, auth: Auth, storage: Storage, input: CompletionInput): Promise<CompletionResult> {
  if (!isInviteTokenShape(input.token)) throw new InviteUnavailableError()
  const validated = validateOnboarding(input.raw)
  if (!validated.ok) throw new OnboardingInputError('Some details need another look.', validated.errors)
  const { fields } = validated
  if (!isPng(input.signaturePng) || input.signaturePng.byteLength > MAX_SIGNATURE_BYTES || input.signaturePng.byteLength < 200) {
    throw new OnboardingInputError('Please sign in the box.', { signature: 'invalid' })
  }
  const chequeExt = CHEQUE_TYPES[input.cheque.type]
  if (!chequeExt || input.cheque.bytes.byteLength === 0 || input.cheque.bytes.byteLength > MAX_CHEQUE_BYTES || !sniff(input.cheque.bytes, input.cheque.type)) {
    throw new OnboardingInputError('Upload a JPG, PNG or PDF of the cancelled cheque, up to 4 MB.', { cheque: 'invalid' })
  }

  const inviteRef = db.collection(INVITE_COLLECTION).doc(hashInviteToken(input.token))
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(inviteRef)
    const invite = snap.data()
    const stale = invite?.status === 'processing' && invite.processingAt instanceof Timestamp && Date.now() - invite.processingAt.toMillis() > STALE_PROCESSING_MS
    if (!invite || !(usable(invite.status) || stale) || !(invite.expiresAt instanceof Timestamp) || invite.expiresAt.toMillis() < Date.now()) {
      throw new InviteUnavailableError()
    }
    tx.update(inviteRef, { status: 'processing', processingAt: Timestamp.now() })
    return invite
  })

  let createdUid: string | null = null
  try {
    const terms = parseFrozenTerms(claimed)
    if (!terms) throw new Error('Invite has invalid terms.')
    const contractId = db.collection('businessContracts').doc().id
    const signedAt = new Date()
    const signaturePngSha256 = createHash('sha256').update(input.signaturePng).digest('hex')

    // The account: attach to an existing business, or create the login (random password; the
    // merchant sets their own from the emailed link) and the business profile.
    let businessId: string = claimed.existingBusinessUid ?? ''
    let createdAccount = false
    if (!businessId) {
      const user = await auth.createUser({ email: claimed.contactEmail, password: randomBytes(24).toString('base64url') })
      createdUid = businessId = user.uid
      createdAccount = true
    }
    const taxLast4 = fields.taxId.slice(-4)
    const publicId = isPublicTaxId(fields.legalEntityType)

    const financialsAad = (field: string) => `businessFinancials/${businessId}:${field}`
    const enc = (field: string, value: string) => encryptField('BUSINESS_FINANCIALS_KEY', value, financialsAad(field))
    const base = `merchantDocs/${businessId}`
    const chequePath = `${base}/cheque-${contractId}.${chequeExt}`
    const signaturePath = `${base}/signature-${contractId}.png`
    const pdfPath = `${base}/contract-${contractId}.pdf`

    const pdf = await renderContractPdf({
      lang: claimed.lang === 'en' ? 'en' : 'he', contractId, businessName: claimed.businessName, legalName: fields.legalName,
      legalEntityType: fields.legalEntityType, taxIdLast4: taxLast4, signatoryName: fields.signatoryName, signatoryRole: fields.signatoryRole,
      commissionRate: terms.commissionRate, paymentTerms: terms.paymentTerms, signedAt,
      signerIp: clientIp(input.request), userAgent: input.request.headers.get('user-agent') ?? 'unknown',
      signaturePng: input.signaturePng, signaturePngSha256,
    }).catch((err: unknown) => {
      // A file that starts like a PNG but isn't one fails to embed; that is a bad signature, not a server fault.
      if (err instanceof Error && /png/i.test(err.message)) throw new OnboardingInputError('Please sign in the box.', { signature: 'invalid' })
      throw err
    })
    const pdfSha256 = createHash('sha256').update(pdf).digest('hex')

    await Promise.all([
      storage.save(chequePath, input.cheque.bytes, input.cheque.type),
      storage.save(signaturePath, input.signaturePng, 'image/png'),
      storage.save(pdfPath, pdf, 'application/pdf'),
    ])

    const now = Timestamp.now()
    await db.runTransaction(async (tx) => {
      const businessRef = db.collection('businesses').doc(businessId)
      const existing = await tx.get(businessRef)
      const profile = {
        commissionRate: terms.commissionRate, paymentTerms: terms.paymentTerms, legalEntityType: fields.legalEntityType,
        legalName: fields.legalName, taxIdLast4: taxLast4, onboardingStatus: 'active', contractId,
      }
      if (existing.exists) tx.update(businessRef, profile)
      else {
        tx.create(businessRef, {
          ...profile, businessName: claimed.businessName, businessId: publicId ? fields.taxId : `ID-${taxLast4}`,
          category: claimed.category || '', location: '', email: claimed.contactEmail,
          voucherStats: { active: 0, redeemedTotal: 0, redeemedThisMonth: 0 },
        })
      }
      tx.set(db.collection('businessFinancials').doc(businessId), {
        taxIdCipher: enc('taxId', fields.taxId), bankCodeCipher: enc('bankCode', fields.bankCode),
        branchCipher: enc('branch', fields.branchCode), accountCipher: enc('account', fields.accountNumber),
        signatory: { name: fields.signatoryName, role: fields.signatoryRole, idCipher: enc('signatoryId', fields.signatoryId) },
        chequeStoragePath: chequePath, updatedAt: now,
      })
      tx.create(db.collection('businessContracts').doc(contractId), {
        businessId, inviteHash: inviteRef.id, termsSnapshot: { ...terms, version: '2026-1' }, lang: claimed.lang,
        signaturePngSha256, signaturePngPath: signaturePath, pdfSha256, pdfStoragePath: pdfPath,
        signerIp: clientIp(input.request), userAgent: (input.request.headers.get('user-agent') ?? 'unknown').slice(0, 300), signedAt: now,
      })
      tx.update(inviteRef, { status: 'completed', completedAt: now, businessId })
      auditInTransaction(db, tx, input.request, {
        action: 'merchantInvite.complete', targetType: 'business', targetId: businessId, after: { contractId, createdAccount },
      })
    })
    return { businessId, contractId, pdf, email: claimed.contactEmail, lang: claimed.lang === 'en' ? 'en' : 'he', businessName: claimed.businessName, createdAccount }
  } catch (err) {
    if (createdUid) await auth.deleteUser(createdUid).catch(() => {})
    await inviteRef.update({ status: 'opened', processingAt: null }).catch(() => {})
    throw err
  }
}
