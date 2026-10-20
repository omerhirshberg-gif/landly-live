import { createHash } from 'node:crypto'
import { CONTENT_LANGS, type ContentOverrides, type ContentTranslations, type TranslatedField } from '../i18n/contentTranslation'
import type { Lang } from '../i18n/translations'
import { OFFER_TEXT_FIELDS, type OfferTextField, type OfferTranslations, type TranslationOverrides } from '../offers/offerText'

export { manualOverridesOf, type TranslationOverrides } from '../offers/offerText'

// Server side of lib/i18n/contentTranslation.ts: works out an offer's
// `translations` (and a business's, lib/translate/businessTranslations.ts) on save. A field is sent to Cloud Translation only when it
// has no translation yet or its source text changed (compared by hash), so
// editing a price costs nothing. An admin's own wording (machine: false) is
// kept as written, whatever happens to the source. A translation failure
// never blocks the save: those fields are dropped (readers fall back to the
// source text) and the route reports a warning. No server-only import, so
// the unit tests can drive it with a fake translator.

export interface Translator {
  /** The language code Cloud Translation detects, or null. */
  detect(text: string): Promise<string | null>
  /** `texts` translated in order. */
  translate(texts: string[], targetLang: string, sourceLang: string): Promise<string[]>
}

export type OfferTextSource = Record<OfferTextField, string>


const MAX_OVERRIDE_LENGTH = 2000
const DETECT_SAMPLE_LENGTH = 500

export function hashSource(text: string): string {
  return createHash('sha256').update(text.trim()).digest('hex').slice(0, 16)
}

/** Request JSON as TranslationOverrides; anything malformed is an error message for a 400. */
export function parseTranslationOverrides(raw: unknown): { ok: true; overrides: TranslationOverrides } | { ok: false; error: string } {
  return parseContentOverrides(raw, OFFER_TEXT_FIELDS)
}

/** Request JSON as overrides of `fieldNames`; anything malformed is an error message for a 400. */
export function parseContentOverrides<F extends string>(
  raw: unknown,
  fieldNames: readonly F[]
): { ok: true; overrides: ContentOverrides<F> } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, overrides: {} }
  if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'translationOverrides must be an object.' }
  const overrides: ContentOverrides<F> = {}
  for (const [lang, byField] of Object.entries(raw as Record<string, unknown>)) {
    if (!(CONTENT_LANGS as readonly string[]).includes(lang)) return { ok: false, error: `translationOverrides: unknown language "${lang}".` }
    if (!byField || typeof byField !== 'object' || Array.isArray(byField)) return { ok: false, error: `translationOverrides.${lang} must be an object.` }
    const fields: Partial<Record<F, string>> = {}
    for (const [field, text] of Object.entries(byField as Record<string, unknown>)) {
      if (!(fieldNames as readonly string[]).includes(field)) return { ok: false, error: `translationOverrides.${lang}: unknown field "${field}".` }
      if (typeof text !== 'string') return { ok: false, error: `translationOverrides.${lang}.${field} must be text.` }
      if (text.length > MAX_OVERRIDE_LENGTH) return { ok: false, error: `translationOverrides.${lang}.${field} is too long.` }
      if (text.trim()) fields[field as F] = text.trim()
    }
    if (Object.keys(fields).length > 0) overrides[lang as Lang] = fields
  }
  return { ok: true, overrides }
}

/** Cloud Translation's code as one of ours where it is one ('iw' is Google's old code for Hebrew). */
export function normalizeLanguageCode(code: string | null | undefined): string | null {
  const base = code?.trim().toLowerCase().split(/[-_]/)[0]
  if (!base || base === 'und') return null
  return base === 'iw' ? 'he' : base
}

/** Without the API (switched off, or it failed): Hebrew letters mean Hebrew, anything else English. */
export function guessLanguage(text: string): string {
  return /[֐-׿]/.test(text) ? 'he' : 'en'
}

export interface BuildResult<F extends string = OfferTextField> {
  translations: ContentTranslations<F>
  /** For the admin: why some fields were left untranslated, or null. */
  warning: string | null
  /** How many fields were sent to Cloud Translation. */
  translatedCount: number
}

export function buildOfferTranslations(
  source: OfferTextSource,
  existing: OfferTranslations | null | undefined,
  overrides: TranslationOverrides,
  translator: Translator | null
): Promise<BuildResult> {
  return buildContentTranslations(OFFER_TEXT_FIELDS, source, existing, overrides, translator)
}

/**
 * The stored translations of `fieldNames`. `sourceLang`, when given, is
 * trusted as the source language and nothing is detected (the business name
 * knows its own from its script).
 */
export async function buildContentTranslations<F extends string>(
  fieldNames: readonly F[],
  source: Record<F, string>,
  existing: ContentTranslations<F> | null | undefined,
  overrides: ContentOverrides<F>,
  translator: Translator | null,
  options: { sourceLang?: string } = {}
): Promise<BuildResult<F>> {
  const hashes = Object.fromEntries(fieldNames.map((field) => [field, hashSource(source[field] ?? '')])) as Record<F, string>
  const filled = fieldNames.filter((field) => (source[field] ?? '').trim())
  const sample = filled.map((field) => source[field]).join('\n').slice(0, DETECT_SAMPLE_LENGTH)

  // Which entries could be kept if the source language stays what it was.
  const reusable = (lang: Lang, field: F): TranslatedField | null => {
    const entry = existing?.fields[lang]?.[field]
    return entry && entry.machine && entry.sourceHash === hashes[field] ? entry : null
  }
  const needsMachine = (sourceLang: string) =>
    CONTENT_LANGS.some((lang) => lang !== sourceLang && filled.some((field) => !overrides[lang]?.[field] && !reusable(lang, field)))

  let warning: string | null = null
  let sourceLang = options.sourceLang ?? existing?.sourceLang ?? guessLanguage(sample)
  // Detect again only when there's something to translate: an unchanged offer costs nothing.
  if (!options.sourceLang && translator && sample && needsMachine(sourceLang)) {
    try {
      sourceLang = normalizeLanguageCode(await translator.detect(sample)) ?? guessLanguage(sample)
    } catch {
      sourceLang = guessLanguage(sample)
    }
  }
  const languageChanged = !!existing && existing.sourceLang !== sourceLang

  const fields: ContentTranslations<F>['fields'] = {}
  const pending = new Map<Lang, F[]>()
  for (const lang of CONTENT_LANGS) {
    if (lang === sourceLang) continue
    for (const field of filled) {
      const manual = overrides[lang]?.[field]
      const kept = languageChanged ? null : reusable(lang, field)
      if (manual) (fields[lang] ??= {} as Partial<Record<F, TranslatedField>>)[field] = { text: manual, sourceHash: hashes[field], machine: false }
      else if (kept) (fields[lang] ??= {} as Partial<Record<F, TranslatedField>>)[field] = kept
      else pending.set(lang, [...(pending.get(lang) ?? []), field])
    }
  }

  let translatedCount = 0
  if (pending.size > 0) {
    if (!translator) {
      warning = 'Automatic translation is switched off, so the changed text is shown untranslated in other languages.'
    } else {
      const results = await Promise.allSettled(
        Array.from(pending, async ([lang, names]) => {
          const texts = await translator.translate(names.map((field) => source[field]), lang, sourceLang)
          names.forEach((field, i) => {
            const text = texts[i]?.trim()
            if (text) (fields[lang] ??= {} as Partial<Record<F, TranslatedField>>)[field] = { text, sourceHash: hashes[field], machine: true }
          })
          translatedCount += names.length
        })
      )
      if (results.some((result) => result.status === 'rejected')) {
        warning = 'Some translations failed; that text is shown untranslated for now. Save again to retry.'
      }
    }
  }

  return { translations: { sourceLang, fields }, warning, translatedCount }
}
