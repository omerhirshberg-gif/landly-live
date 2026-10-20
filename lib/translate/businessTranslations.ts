import { BUSINESS_TEXT_FIELDS, isHebrewScriptName, type BusinessNameOverrides, type BusinessTranslations } from '../business/businessText'
import { buildContentTranslations, guessLanguage, parseContentOverrides, type BuildResult, type Translator } from './offerTranslations'

// A business name's `translations` on save, with the rules of
// lib/translate/offerTranslations.ts (unchanged name: no API call; the
// admin's own wording kept). Its source language comes from its script, so
// nothing is detected, and only a Hebrew-script name goes to Google: a
// Latin-script brand stays as written, without a warning. No server-only
// import, so the unit tests can drive it with a fake translator.

export function parseBusinessNameOverrides(raw: unknown): { ok: true; overrides: BusinessNameOverrides } | { ok: false; error: string } {
  return parseContentOverrides(raw, BUSINESS_TEXT_FIELDS)
}

export async function buildBusinessTranslations(
  businessName: string,
  existing: BusinessTranslations | null | undefined,
  overrides: BusinessNameOverrides,
  translator: Translator | null
): Promise<BuildResult<'businessName'>> {
  const name = businessName.trim()
  const hebrew = isHebrewScriptName(name)
  const result = await buildContentTranslations(BUSINESS_TEXT_FIELDS, { businessName: name }, existing, overrides, hebrew ? translator : null, {
    sourceLang: guessLanguage(name),
  })
  if (!hebrew) return { ...result, warning: null }
  return result.warning ? { ...result, warning: `Business name: ${result.warning}` } : result
}
