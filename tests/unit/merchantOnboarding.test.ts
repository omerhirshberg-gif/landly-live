import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import { randomBytes } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { decryptField } from '@/lib/crypto/fieldCipher'
import { parseBatchFile, parseCommission, parseCsv, parseInviteInput } from '@/lib/merchants/inviteInput'
import { generateInviteToken, hashInviteToken } from '@/lib/merchants/inviteToken'
import { commissionAgorot, isCommissionRate, parseFrozenTerms, paymentTermsDays } from '@/lib/merchants/terms'
import { isValidIsraeliId, validateOnboarding } from '@/lib/merchants/validation'
import { visualRuns } from '@/lib/merchants/pdfText'
import { renderContractPdf } from '@/lib/merchants/contractPdf'
import { InviteUnavailableError, completeOnboarding, loadInvite } from '@/lib/merchants/onboarding'
import { createInvite, whatsappHref } from '@/lib/merchants/invites'
import { TransactionStore } from '../helpers/transactionStore'

vi.mock('@/lib/auth/requestContext', () => ({ applicationOrigin: () => 'https://landly.test', isValidLang: (v: unknown) => v === 'en' || v === 'he' }))
vi.mock('@/lib/email/brandedEmail', () => ({ sendBrandedEmail: vi.fn(), emailConfigProblem: () => 'off', EmailProviderError: class extends Error {} }))

beforeAll(() => {
  process.env.BUSINESS_FINANCIALS_KEY = randomBytes(32).toString('base64')
})

// 000000018 and 123456782 pass the check digit; 123456789 does not.
describe('field validation', () => {
  it('checks the Israeli ID check digit', () => {
    expect(isValidIsraeliId('123456782')).toBe(true)
    expect(isValidIsraeliId('000000018')).toBe(true)
    expect(isValidIsraeliId('123456789')).toBe(false)
    expect(isValidIsraeliId('12ab')).toBe(false)
  })
  it('cleans and pads valid fields, and flags each bad one', () => {
    const good = { legalEntityType: 'company', legalName: 'Cafe Ltd', taxId: '12345 6782', signatoryName: 'Dana Levi', signatoryId: '123456782', signatoryRole: 'CEO', bankCode: '12', branchCode: '600', accountNumber: '123456' }
    expect(validateOnboarding(good)).toMatchObject({ ok: true, fields: { taxId: '123456782' } })
    const bad = validateOnboarding({ ...good, bankCode: '1', branchCode: '60', accountNumber: '12', taxId: '1' })
    expect(bad).toMatchObject({ ok: false, errors: { bankCode: 'invalid', branchCode: 'invalid', accountNumber: 'invalid', taxId: 'invalid' } })
  })
})

describe('terms and invite input', () => {
  it('reads commissions written as 10%, 10, 0.1 and refuses over 50%', () => {
    expect([parseCommission('10%'), parseCommission('10'), parseCommission('0.1'), parseCommission(0.15), parseCommission('12.5%')]).toEqual([0.1, 0.1, 0.1, 0.15, 0.125])
    expect(parseCommission('60%')).toBeNull()
    expect(parseCommission('abc')).toBeNull()
    expect(isCommissionRate(0.123456)).toBe(false)
  })
  it('rounds commission per voucher in whole agorot', () => {
    expect(commissionAgorot(1025, 0.1)).toBe(103)
    expect(commissionAgorot(10000, 0.15)).toBe(1500)
    expect(paymentTermsDays('net_45')).toBe(45)
    expect(parseFrozenTerms({ commissionRate: 0.1, paymentTerms: 'net_9' })).toBeNull()
  })
  it('parses invites and rejects bad ones with readable messages', () => {
    const ok = parseInviteInput({ businessName: 'Cafe', contactEmail: 'A@B.co', contactPhone: '050-123-4567', commissionRate: '10%', paymentTerms: 'NET-30', category: '', language: 'en' })
    expect(ok).toMatchObject({ ok: true, value: { contactEmail: 'a@b.co', paymentTerms: 'net_30', commissionRate: 0.1, contactPhone: '0501234567', lang: 'en' } })
    const bad = parseInviteInput({ businessName: '', contactEmail: 'x', contactPhone: '1', commissionRate: '70%', paymentTerms: 'net_99', category: 'Nope' })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.errors).toHaveLength(6)
  })
  it('parses CSV with quotes, semicolons and a BOM, and JSON', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"']])
    expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']])
    expect(parseBatchFile('businessName,contactEmail\nCafe,a@b.co')).toEqual([{ businessName: 'Cafe', contactEmail: 'a@b.co' }])
    expect(parseBatchFile('[{"businessName":"X"}]')).toEqual([{ businessName: 'X' }])
    expect(() => parseBatchFile('{ nope')).toThrow('valid JSON')
    expect(() => parseBatchFile('')).toThrow('empty')
  })
  it('builds a WhatsApp link from local and international numbers', () => {
    expect(whatsappHref('0501234567', 'hi')).toBe('https://wa.me/972501234567?text=hi')
    expect(whatsappHref('+14155550100', 'hi')).toContain('wa.me/14155550100')
    expect(whatsappHref('12', 'hi')).toBeNull()
  })
})

describe('PDF text order', () => {
  it('reverses Hebrew runs and keeps numbers and Latin in reading order', () => {
    expect(visualRuns('שלום', true)).toEqual([{ kind: 'he', text: 'םולש' }])
    const runs = visualRuns('עמלה 10% מ-GoLandly', true).map((r) => r.text).join('|')
    expect(runs.startsWith('GoLandly')).toBe(true)
    expect(runs).toContain('10')
    expect(visualRuns('Pay Net 30', false).map((r) => r.text).join('')).toBe('Pay Net 30')
  })
  it('renders a one-page A4 PDF in both languages', async () => {
    // A 1x1 transparent PNG.
    const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'))
    for (const lang of ['en', 'he'] as const) {
      const pdf = await renderContractPdf({ lang, contractId: 'c1', businessName: 'קפה דוגמה', legalName: 'קפה דוגמה בע"מ', legalEntityType: 'company', taxIdLast4: '6782', signatoryName: 'דנה לוי', signatoryRole: 'מנכ"לית', commissionRate: 0.1, paymentTerms: 'net_30', signedAt: new Date('2026-11-11T10:00:00Z'), signerIp: '1.2.3.4', userAgent: 'test', signaturePng: png, signaturePngSha256: 'ab'.repeat(32) })
      expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe('%PDF-')
      expect(pdf.byteLength).toBeGreaterThan(5000)
    }
  })
})

// A real 120x40 PNG (noise rows so it clears the size floor), built with zlib.
function pngBytes(): Uint8Array {
  const w = 120, h = 40
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) for (let i = 1; i <= w * 4; i++) raw[y * (w * 4 + 1) + i] = (y * 31 + i * 17) & 0xff
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (buf: Buffer) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type: string, data: Buffer) => { const t = Buffer.concat([Buffer.from(type), data]); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(t)); return Buffer.concat([len, t, sum]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
}
const chequeBytes = () => { const b = new Uint8Array(500); b.set([0xff, 0xd8]); return b }
const fields = { legalEntityType: 'company', legalName: 'Cafe Ltd', taxId: '123456782', signatoryName: 'Dana Levi', signatoryId: '123456782', signatoryRole: 'CEO', bankCode: '12', branchCode: '600', accountNumber: '123456' }

describe('onboarding completion', () => {
  let store: TransactionStore
  let saved: Record<string, number>
  const auth = { createUser: vi.fn(), deleteUser: vi.fn(async () => {}) }
  const storage = { save: vi.fn(async (path: string, bytes: Uint8Array) => { saved[path] = bytes.byteLength }) }
  const request = new Request('https://landly.test', { headers: { 'user-agent': 'vitest' } })
  let token: string

  beforeEach(async () => {
    vi.clearAllMocks()
    saved = {}
    store = new TransactionStore()
    auth.createUser.mockResolvedValue({ uid: 'newbiz' })
    const invite = await createInvite(store.db, request, { businessName: 'Cafe', contactEmail: 'o@cafe.co', contactPhone: '0501234567', commissionRate: 0.1, paymentTerms: 'net_30', category: 'Restaurants and Cafes', lang: 'en', existingBusinessUid: '' })
    token = invite.link.split('/').pop()!
  })
  const run = (over: Record<string, unknown> = {}) => completeOnboarding(store.db, auth as never, storage, { token, raw: fields, signaturePng: pngBytes(), cheque: { bytes: chequeBytes(), type: 'image/jpeg' }, request, ...over })

  it('stores only the hash of the token, and a live link loads', async () => {
    expect(store.snapshot()[`merchantInvites/${hashInviteToken(token)}`]).toBeDefined()
    expect(JSON.stringify(store.snapshot())).not.toContain(token)
    expect(await loadInvite(store.db, token)).toMatchObject({ businessName: 'Cafe', commissionRate: 0.1, paymentTerms: 'net_30' })
  })

  it('creates the business, encrypts the bank details, stores files and closes the invite', async () => {
    const result = await run()
    expect(result.businessId).toBe('newbiz')
    const snap = store.snapshot()
    expect(snap['businesses/newbiz']).toMatchObject({ commissionRate: 0.1, paymentTerms: 'net_30', taxIdLast4: '6782', onboardingStatus: 'active', businessId: '123456782' })
    const fin = snap['businessFinancials/newbiz'] as Record<string, any>
    const dump = JSON.stringify(fin)
    for (const secret of ['123456782', '600', '123456']) expect(dump).not.toContain(`"${secret}"`)
    expect(decryptField('BUSINESS_FINANCIALS_KEY', fin.accountCipher, 'businessFinancials/newbiz:account')).toBe('123456')
    expect(() => decryptField('BUSINESS_FINANCIALS_KEY', fin.accountCipher, 'businessFinancials/other:account')).toThrow()
    expect(Object.keys(saved).filter((p) => p.startsWith('merchantDocs/newbiz/'))).toHaveLength(3)
    const contract = Object.entries(snap).find(([k]) => k.startsWith('businessContracts/'))![1] as Record<string, any>
    expect(contract).toMatchObject({ businessId: 'newbiz', termsSnapshot: { commissionRate: 0.1, paymentTerms: 'net_30' } })
    expect(contract.pdfSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(snap[`merchantInvites/${hashInviteToken(token)}`].status).toBe('completed')
  })

  it('is single use: the same link fails afterwards, and reads like any dead link', async () => {
    await run()
    await expect(run()).rejects.toBeInstanceOf(InviteUnavailableError)
    await expect(loadInvite(store.db, token)).rejects.toBeInstanceOf(InviteUnavailableError)
    await expect(loadInvite(store.db, generateInviteToken())).rejects.toBeInstanceOf(InviteUnavailableError)
    await expect(loadInvite(store.db, 'short')).rejects.toBeInstanceOf(InviteUnavailableError)
  })

  it('refuses an expired invite', async () => {
    const key = `merchantInvites/${hashInviteToken(token)}`
    store.seed(key, { ...store.read(key), expiresAt: Timestamp.fromMillis(Date.now() - 1000) })
    await expect(run()).rejects.toBeInstanceOf(InviteUnavailableError)
  })

  it('rejects bad input without consuming the invite', async () => {
    await expect(run({ raw: { ...fields, bankCode: '1' } })).rejects.toMatchObject({ fields: { bankCode: 'invalid' } })
    await expect(run({ signaturePng: new Uint8Array(10) })).rejects.toMatchObject({ fields: { signature: 'invalid' } })
    await expect(run({ cheque: { bytes: chequeBytes(), type: 'image/png' } })).rejects.toMatchObject({ fields: { cheque: 'invalid' } })
    expect(auth.createUser).not.toHaveBeenCalled()
    await expect(run()).resolves.toBeDefined()
  })

  it('undoes the new login and reopens the invite when saving fails', async () => {
    storage.save.mockRejectedValueOnce(new Error('storage down'))
    await expect(run()).rejects.toThrow('storage down')
    expect(auth.deleteUser).toHaveBeenCalledWith('newbiz')
    expect(store.read(`merchantInvites/${hashInviteToken(token)}`)?.status).toBe('opened')
    await expect(run()).resolves.toBeDefined()
  })

  it('attaches to an existing business without creating a login', async () => {
    store.seed('businesses/old', { businessName: 'Old Cafe', voucherStats: { active: 0 } })
    const invite = await createInvite(store.db, request, { businessName: 'Old Cafe', contactEmail: 'o@old.co', contactPhone: '0501234567', commissionRate: 0.15, paymentTerms: 'net_15', category: '', lang: 'he', existingBusinessUid: 'old' })
    const result = await run({ token: invite.link.split('/').pop() })
    expect(result).toMatchObject({ businessId: 'old', createdAccount: false })
    expect(auth.createUser).not.toHaveBeenCalled()
    expect(store.read('businesses/old')).toMatchObject({ businessName: 'Old Cafe', commissionRate: 0.15, paymentTerms: 'net_15' })
  })
})
