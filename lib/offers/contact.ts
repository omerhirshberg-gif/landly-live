// A business's website and phone numbers as Raayonit lists them, made safe to link: a clean https/http address, and numbers a phone can dial.
// Pure; shared by the Raayonit sync, the website and the Expo app (@shared/offers/contact).

const TRACKING = /^(utm_|gclid|fbclid|msclkid|mc_|_ga|igshid)/i

/**
 * The business's own website as a clean link: a doubled scheme ("http://https://…") repaired, a missing one added, tracking
 * parameters dropped, and Raayonit's own site ignored (it is not the business's). '' when there is nothing usable.
 */
export function normalizeWebsiteUrl(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  let value = raw.trim().replace(/^https?:\/\/(https?:\/\/)/i, '$1')
  if (!value || /\s/.test(value.replace(/\/[^]*$/, ''))) return ''
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`
  let url: URL
  try { url = new URL(value) } catch { try { url = new URL(encodeURI(value)) } catch { return '' } }
  if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.')) return ''
  if (/(^|\.)raayonit\.co\.il$/i.test(url.hostname)) return ''
  for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key)
  return url.toString()
}

export interface PhoneNumber {
  /** As written for the reader: digits with the business's own dashes, or a star number ("*2345"). */
  display: string
  /** The `tel:` link that dials it. */
  href: string
}

/**
 * Every dialable number in a listing's phone text ("03-9223392 04-6714430 052-3600232", "*5692 03-6447031", "Whatsapp-03-3767306"),
 * in the order written, without duplicates. Text that is not a number is dropped.
 */
export function parsePhones(raw: unknown): PhoneNumber[] {
  if (typeof raw !== 'string') return []
  const out: PhoneNumber[] = []
  for (const match of raw.matchAll(/\*\s?\d{3,5}|\+?\d[\d\-]{5,}\d/g)) {
    const display = match[0].replace(/^\*\s+/, '*')
    const digits = display.replace(/[^\d+*]/g, '')
    const count = digits.replace(/\D/g, '').length
    if (count < 4 || count > 13 || out.some((p) => p.href === `tel:${digits}`)) continue
    out.push({ display, href: `tel:${digits}` })
  }
  return out
}

/** The first dialable number in a listing's phone text, or null. */
export const firstPhone = (raw: unknown): PhoneNumber | null => parsePhones(raw)[0] ?? null
