import { isValidImageUrl } from '@/lib/admin/validateImageUrl'
import { imageUrlProblem, normalizeImageUrl } from '@/lib/offers/imageUrl'

// A business's logo: uploaded from the admin (logos/{uuid}.png, fitted whole
// into a ≤1024px square, transparency kept) or a pasted link. Stored on the business as `logoUrl`
// and copied onto each of its offers as `businessLogoUrl`, like its name, so
// the perk cards (web and app) can show it in their rounded badge. '' = none.

export type ParsedLogoUrl = { ok: true; logoUrl: string } | { ok: false; error: string }

/**
 * The admin's logo field as it will be saved: wrappers unwrapped (Google
 * Images, Drive, Imgur), or '' to clear it. Undefined means "not sent", for
 * callers that keep the stored logo then.
 */
export function parseLogoUrl(raw: unknown): ParsedLogoUrl {
  if (raw === undefined || raw === null) return { ok: true, logoUrl: '' }
  if (typeof raw !== 'string') return { ok: false, error: 'business.logoUrl must be a string.' }
  const logoUrl = normalizeImageUrl(raw)
  if (!logoUrl) return { ok: true, logoUrl: '' }
  if (!isValidImageUrl(logoUrl)) return { ok: false, error: 'business.logoUrl must be a valid http(s) URL.' }
  const problem = imageUrlProblem(logoUrl)
  if (problem) return { ok: false, error: `business.logoUrl: ${problem}` }
  return { ok: true, logoUrl }
}
