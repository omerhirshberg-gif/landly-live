import type { Lang } from './translations'

// Admin-written content (offer titles, descriptions, terms) in the reader's
// language. The admin types it once, usually in Hebrew; on save the admin
// routes ask Cloud Translation for the other languages and store them next
// to the source text (lib/translate/offerTranslations.ts), so reading costs
// nothing and every page, the app included, gets them with the document it
// already fetched. Pure and shared with the Expo app: no Firebase, no fetch.
//
// Stored shape, on offers/{id}.translations (copied to orders and vouchers):
//   { sourceLang: 'he', fields: { en: { title: { text, sourceHash, machine } } } }
// `sourceHash` is the source text's hash when it was translated: a field is
// translated again only when its source changes. `machine: false` marks an
// admin's own wording, which a later source edit never overwrites.

export const CONTENT_LANGS = ['en', 'ru', 'es', 'fr', 'he'] as const satisfies readonly Lang[]

export interface TranslatedField {
  text: string
  sourceHash: string
  machine: boolean
}

export interface ContentTranslations<F extends string = string> {
  /** The language the admin wrote in, as Cloud Translation detected it ('he', 'en', …). */
  sourceLang: string
  fields: Partial<Record<Lang, Partial<Record<F, TranslatedField>>>>
}

/** An admin's own wording, per language and field, as the admin forms send it. */
export type ContentOverrides<F extends string = string> = Partial<Record<Lang, Partial<Record<F, string>>>>

export interface LocalizedText {
  text: string
  /** The language `text` is in (for lang/dir), or null when unknown. */
  lang: string | null
  /** True when `text` came from Cloud Translation (the "Translated by Google" line). */
  machine: boolean
}

const isLang = (value: string): value is Lang => (CONTENT_LANGS as readonly string[]).includes(value)

/** Firestore data as ContentTranslations, or null; anything malformed is dropped, never thrown. */
export function parseContentTranslations<F extends string>(raw: unknown, fieldNames: readonly F[]): ContentTranslations<F> | null {
  if (!raw || typeof raw !== 'object') return null
  const { sourceLang, fields } = raw as { sourceLang?: unknown; fields?: unknown }
  if (typeof sourceLang !== 'string' || !sourceLang || !fields || typeof fields !== 'object') return null
  const parsed: ContentTranslations<F>['fields'] = {}
  for (const [lang, byField] of Object.entries(fields as Record<string, unknown>)) {
    if (!isLang(lang) || !byField || typeof byField !== 'object') continue
    const entries: Partial<Record<F, TranslatedField>> = {}
    for (const name of fieldNames) {
      const entry = (byField as Record<string, unknown>)[name] as Partial<TranslatedField> | undefined
      if (entry && typeof entry.text === 'string' && entry.text && typeof entry.sourceHash === 'string') {
        entries[name] = { text: entry.text, sourceHash: entry.sourceHash, machine: entry.machine !== false }
      }
    }
    if (Object.keys(entries).length > 0) parsed[lang] = entries
  }
  return { sourceLang, fields: parsed }
}

/** The stored manual translations as overrides (an edit form's starting point; a re-translation keeps them). */
export function manualOverridesFrom<F extends string>(existing: ContentTranslations<F> | null | undefined): ContentOverrides<F> {
  const overrides: ContentOverrides<F> = {}
  for (const [lang, byField] of Object.entries(existing?.fields ?? {}) as [Lang, Partial<Record<F, TranslatedField>>][]) {
    for (const [field, entry] of Object.entries(byField ?? {}) as [F, TranslatedField | undefined][]) {
      if (entry && !entry.machine) (overrides[lang] ??= {} as Partial<Record<F, string>>)[field] = entry.text
    }
  }
  return overrides
}

/**
 * One field in the reader's language: the stored translation when there is
 * one, else the source text (in its own language, so the page can still set
 * lang/dir for it).
 */
export function localizeText<F extends string>(
  source: string,
  translations: ContentTranslations<F> | null | undefined,
  lang: Lang,
  field: F
): LocalizedText {
  if (!translations) return { text: source, lang: null, machine: false }
  if (source && translations.sourceLang !== lang) {
    const entry = translations.fields[lang]?.[field]
    if (entry?.text) return { text: entry.text, lang, machine: entry.machine }
  }
  return { text: source, lang: translations.sourceLang, machine: false }
}

/** Whether any of `fields` shows Google's wording in `lang` (and so needs the attribution line). */
export function showsMachineTranslation<F extends string>(
  translations: ContentTranslations<F> | null | undefined,
  lang: Lang,
  sources: Partial<Record<F, string>>
): boolean {
  if (!translations || translations.sourceLang === lang) return false
  return (Object.keys(sources) as F[]).some((field) => !!sources[field] && translations.fields[lang]?.[field]?.machine === true)
}

/** Text direction for a language code ('he', 'iw', 'ar'… are right-to-left). */
export function directionOf(lang: string | null): 'rtl' | 'ltr' | undefined {
  if (!lang) return undefined
  return /^(he|iw|ar|fa|ur|yi)\b/i.test(lang) ? 'rtl' : 'ltr'
}
