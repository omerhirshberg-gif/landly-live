import { parsePhoneNumberFromString } from 'libphonenumber-js'

// A business's contact phone (businesses/{uid}.phone): optional, stored as
// E.164, typed in the admin as a local Israeli number ("03-123 4567") or with
// its own "+country". Only on the business record; offers don't copy it.

export type BusinessPhoneResult = { ok: true; phone: string } | { ok: false; error: string }

/** '' (none) or a valid number as E.164. */
export function parseBusinessPhone(raw: unknown): BusinessPhoneResult {
  if (raw === undefined || raw === null || raw === '') return { ok: true, phone: '' }
  if (typeof raw !== 'string') return { ok: false, error: 'business.phone must be a string.' }
  const typed = raw.trim()
  if (!typed) return { ok: true, phone: '' }
  const parsed = parsePhoneNumberFromString(typed, 'IL')
  return parsed?.isValid() ? { ok: true, phone: parsed.number } : { ok: false, error: 'business.phone is not a valid phone number.' }
}

/** "03-123-4567" for an Israeli number, "+44 20 7946 0958" for any other; as stored if unparsable. */
export function displayPhone(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164)
  if (!parsed) return e164
  return parsed.country === 'IL' ? parsed.formatNational() : parsed.formatInternational()
}

export const telHref = (e164: string) => `tel:${e164}`

/** A wa.me chat link: the number's digits, no "+". */
export const whatsappHref = (e164: string) => `https://wa.me/${e164.replace(/\D/g, '')}`
