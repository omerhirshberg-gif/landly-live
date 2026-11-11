import 'server-only'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'
import { applicationOrigin } from '@/lib/auth/requestContext'
import { EmailProviderError, emailConfigProblem, sendBrandedEmail } from '@/lib/email/brandedEmail'
import { auditInTransaction } from '@/lib/admin/auditLog'
import { generateInviteToken, hashInviteToken, INVITE_TTL_MS } from './inviteToken'
import type { InviteInput } from './inviteInput'

export const INVITE_COLLECTION = 'merchantInvites'
export type InviteStatus = 'pending' | 'opened' | 'processing' | 'completed' | 'expired' | 'revoked'

export interface CreatedInvite { hash: string; link: string; expiresAt: Date; message: string; whatsappHref: string | null }

export function onboardingLink(token: string): string {
  return `${applicationOrigin()}/business/onboard/${token}`
}

// The same words for the email and the manual WhatsApp message.
export function inviteMessage(input: Pick<InviteInput, 'businessName' | 'lang'>, link: string): string {
  return input.lang === 'he'
    ? `שלום, הוזמנתם להצטרף ל-Landly בתור ${input.businessName}. כדי להשלים את ההרשמה ולחתום על ההסכם (כ-5 דקות), היכנסו לקישור האישי: ${link}\nהקישור תקף 7 ימים וניתן לשימוש פעם אחת.`
    : `Hi, you've been invited to join Landly as ${input.businessName}. To finish setting up and sign the agreement (about 5 minutes), use your personal link: ${link}\nIt is valid for 7 days and can be used once.`
}

/** wa.me link with the message prefilled, for sending from the admin's own WhatsApp (no template needed). */
export function whatsappHref(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, '')
  // A local Israeli number (05x…) is made international; anything else must already be.
  const intl = phone.startsWith('+') ? digits : digits.startsWith('0') ? `972${digits.slice(1)}` : digits
  return /^\d{9,15}$/.test(intl) ? `https://wa.me/${intl}?text=${encodeURIComponent(message)}` : null
}

export async function createInvite(db: Firestore, request: Request, input: InviteInput, batchId: string | null = null): Promise<CreatedInvite> {
  const token = generateInviteToken()
  const hash = hashInviteToken(token)
  const now = Timestamp.now()
  const expiresAt = new Date(now.toMillis() + INVITE_TTL_MS)
  const ref = db.collection(INVITE_COLLECTION).doc(hash)
  await db.runTransaction(async (tx) => {
    if (input.existingBusinessUid) {
      const existing = await tx.get(db.collection('businesses').doc(input.existingBusinessUid))
      if (!existing.exists) throw new Error('The chosen business does not exist.')
    }
    tx.create(ref, {
      businessName: input.businessName, contactEmail: input.contactEmail, contactPhone: input.contactPhone,
      commissionRate: input.commissionRate, paymentTerms: input.paymentTerms, category: input.category, lang: input.lang,
      existingBusinessUid: input.existingBusinessUid || null, status: 'pending' as InviteStatus,
      createdAt: now, expiresAt: Timestamp.fromDate(expiresAt), openedAt: null, completedAt: null,
      failedAttempts: 0, batchId, businessId: null,
    })
    auditInTransaction(db, tx, request, {
      action: 'merchantInvite.create', targetType: 'invite', targetId: hash.slice(0, 12),
      after: { businessName: input.businessName, commissionRate: input.commissionRate, paymentTerms: input.paymentTerms, batchId },
    })
  })
  const link = onboardingLink(token)
  const message = inviteMessage(input, link)
  return { hash, link, expiresAt, message, whatsappHref: whatsappHref(input.contactPhone, message) }
}

/** Emails the link. Resend is primary; a missing key or a refusal is reported, never thrown. */
export async function emailInvite(input: InviteInput, link: string): Promise<{ sent: boolean; error?: string }> {
  const problem = emailConfigProblem()
  if (problem) return { sent: false, error: problem }
  const he = input.lang === 'he'
  try {
    await sendBrandedEmail({
      to: input.contactEmail, lang: input.lang, origin: applicationOrigin(),
      subject: he ? `${input.businessName}: ההזמנה שלכם ל-Landly` : `${input.businessName}: your invitation to Landly`,
      heading: he ? 'הוזמנתם להצטרף ל-Landly' : 'You are invited to join Landly',
      body: he
        ? `השלימו את פרטי העסק, פרטי הבנק והחתימה על ההסכם עבור ${input.businessName}. זה לוקח כ-5 דקות.`
        : `Complete the business details, bank details and agreement signature for ${input.businessName}. It takes about 5 minutes.`,
      buttonLabel: he ? 'להשלמת ההרשמה' : 'Complete registration',
      buttonLink: link,
      footnote: he ? 'הקישור אישי, תקף 7 ימים וניתן לשימוש פעם אחת. אם לא ציפיתם להודעה זו, אפשר להתעלם ממנה.' : 'This link is personal, valid for 7 days and works once. If you were not expecting this, you can ignore it.',
    })
    return { sent: true }
  } catch (err) {
    return { sent: false, error: err instanceof EmailProviderError ? 'The email provider refused the message.' : 'Could not send the email.' }
  }
}
