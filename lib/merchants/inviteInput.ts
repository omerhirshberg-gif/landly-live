import { CATEGORY_TILES } from '@/lib/categories'
import { isCommissionRate, isPaymentTerms, type PaymentTerms } from './terms'
import { isEmail, normalizePhone } from './validation'

// What an admin fixes for a merchant before sending the link. Pure and
// client-safe: the invite form, the batch preview and the server all use it.
export interface InviteInput {
  businessName: string
  contactEmail: string
  contactPhone: string
  commissionRate: number
  paymentTerms: PaymentTerms
  category: string
  lang: 'he' | 'en'
  /** Attach the onboarding to a business that already exists (its Auth uid); '' creates a new account. */
  existingBusinessUid: string
}

/** "10%", "10", "0.1" and 0.1 all mean ten percent; anything over 1 is read as a percentage. */
export function parseCommission(raw: unknown): number | null {
  const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim().replace(/%$/, '') : ''
  if (!/^\d+(\.\d+)?$/.test(text)) return null
  const n = Number(text)
  const rate = typeof raw === 'string' && raw.trim().endsWith('%') ? n / 100 : n > 1 ? n / 100 : n
  const rounded = Math.round(rate * 10000) / 10000
  return isCommissionRate(rounded) ? rounded : null
}

export function parseInviteInput(raw: Record<string, unknown>): { ok: true; value: InviteInput } | { ok: false; errors: string[] } {
  const str = (k: string) => (typeof raw[k] === 'string' ? (raw[k] as string).trim() : '')
  const errors: string[] = []
  const businessName = str('businessName')
  if (businessName.length < 2 || businessName.length > 120) errors.push('Business name must be 2 to 120 characters.')
  const contactEmail = str('contactEmail').toLowerCase()
  if (!isEmail(contactEmail)) errors.push('Contact email is not valid.')
  const phone = normalizePhone(str('contactPhone'))
  if (!phone) errors.push('Contact phone is not valid.')
  const commissionRate = parseCommission(raw.commissionRate)
  if (commissionRate === null) errors.push('Commission must be between 0% and 50%.')
  const paymentTerms = str('paymentTerms').toLowerCase().replace('-', '_')
  if (!isPaymentTerms(paymentTerms)) errors.push('Payment terms must be net_0, net_15, net_30, net_45 or net_60.')
  const category = str('category')
  if (category && !CATEGORY_TILES.some((c) => c.category === category)) errors.push(`Unknown category "${category}".`)
  const lang = (str('lang') || str('language') || 'he').toLowerCase()
  if (lang !== 'he' && lang !== 'en') errors.push('Language must be he or en.')
  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    value: {
      businessName, contactEmail, contactPhone: phone!, commissionRate: commissionRate!, paymentTerms: paymentTerms as PaymentTerms,
      category, lang: lang as 'he' | 'en', existingBusinessUid: str('existingBusinessUid'),
    },
  }
}

// RFC 4180: quoted fields with "" escapes, commas or semicolons, CRLF or LF, a BOM.
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const delimiter = (src.split(/\r?\n/, 1)[0]!.match(/;/g)?.length ?? 0) > (src.split(/\r?\n/, 1)[0]!.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = [], field = '', quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++ } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === delimiter) { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((v) => v.trim())) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((v) => v.trim())) rows.push(row)
  return rows
}

export const MAX_BATCH_ROWS = 200

/** CSV (header row) or a JSON array of objects, as the records to validate. Throws a readable Error on a bad file. */
export function parseBatchFile(text: string): Record<string, unknown>[] {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('The file is empty.')
  let records: Record<string, unknown>[]
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    let json: unknown
    try { json = JSON.parse(trimmed) } catch { throw new Error('That is not valid JSON.') }
    const list = Array.isArray(json) ? json : (json as { merchants?: unknown })?.merchants
    if (!Array.isArray(list) || list.some((r) => !r || typeof r !== 'object' || Array.isArray(r))) throw new Error('JSON must be an array of merchant objects.')
    records = list as Record<string, unknown>[]
  } else {
    const [header, ...body] = parseCsv(trimmed)
    if (!header || body.length === 0) throw new Error('A CSV needs a header row and at least one merchant.')
    const keys = header.map((h) => h.trim())
    records = body.map((cells) => Object.fromEntries(keys.map((k, i) => [k, (cells[i] ?? '').trim()])))
  }
  if (records.length > MAX_BATCH_ROWS) throw new Error(`At most ${MAX_BATCH_ROWS} merchants per batch.`)
  return records
}
