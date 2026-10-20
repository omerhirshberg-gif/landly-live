import 'server-only'
import { activeTranslator } from './cloudTranslate'
import { buildBusinessTranslations, parseBusinessNameOverrides } from './businessTranslations'
import { parseBusinessTranslations } from '@/lib/business/businessText'

/**
 * The `translations` to store with a business being created or edited, from
 * its name, its stored translations (edits) and the form's manual ones. A
 * malformed request is the only failure; translation trouble comes back as a
 * warning for the admin, and the business saves regardless.
 */
export async function businessTranslationsForSave(businessName: string, existingRaw: unknown, rawOverrides: unknown) {
  const overrides = parseBusinessNameOverrides(rawOverrides)
  if (!overrides.ok) return overrides
  const result = await buildBusinessTranslations(businessName, parseBusinessTranslations(existingRaw), overrides.overrides, activeTranslator())
  if (result.warning) console.warn(`Business translation: ${result.warning}`)
  return { ok: true as const, translations: result.translations, warning: result.warning }
}
