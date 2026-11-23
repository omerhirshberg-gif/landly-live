// Pure helpers for promoting Raayonit's catalogue from the dev project to production (scripts/promote-raayonit-prod.mts).
// No server-only import and no Firestore: the script reads the documents and these functions decide, so the guards are unit-testable.

export const TRANSLATED_LANGS = ['en', 'ru', 'fr', 'es'] as const
export type TranslatedLang = (typeof TRANSLATED_LANGS)[number]

/** The parts of a DEV offer the translation cache is built from. */
export interface DevOfferText {
  sourceKey?: unknown
  redemptionTerms?: unknown
  translations?: unknown
}

const termLines = (text: string): string[] => text.split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean)

/**
 * Reuses the dev project's translated fine print: each Hebrew restriction line of a DEV card is paired with the same line of its
 * translation, keyed `${lang}|${protected Hebrew}` (the key shape raayonit-seed's cache and translateAll use). A card whose line
 * counts differ across languages is skipped, never guessed at. Machine-edited and manual wording are both reused as stored.
 */
export function translationCacheFromOffers(offers: readonly DevOfferText[], protect: (text: string) => string): Record<string, string> {
  const cache: Record<string, string> = {}
  for (const offer of offers) {
    if (typeof offer.sourceKey !== 'string' || !/^raayonit:[^:]+$/.test(offer.sourceKey)) continue
    const he = termLines(typeof offer.redemptionTerms === 'string' ? offer.redemptionTerms : '')
    if (he.length === 0) continue
    const fields = (offer.translations as { fields?: Record<string, { redemptionTerms?: { text?: unknown } } | undefined> } | null | undefined)?.fields
    for (const lang of TRANSLATED_LANGS) {
      const text = fields?.[lang]?.redemptionTerms?.text
      if (typeof text !== 'string') continue
      const tr = termLines(text)
      if (tr.length !== he.length) continue
      he.forEach((line, i) => { if (tr[i]) cache[`${lang}|${protect(line)}`] ??= tr[i]! })
    }
  }
  return cache
}

/** The distinct restriction strings (after `protect`) that have no cached translation in some language. */
export function missingTranslations(restrictions: readonly string[], cache: Readonly<Record<string, string>>, protect: (text: string) => string): string[] {
  const unique = [...new Set(restrictions.map((r) => r.trim()).filter(Boolean))]
  return unique.filter((r) => TRANSLATED_LANGS.some((lang) => !cache[`${lang}|${protect(r)}`]))
}

export interface PromoteExisting { sourceKey: string }

/** Cards already in PROD that a non-partial sync would retire, re-key or merge: the live run refuses them unless the operator allows it. */
export function unexpectedProdCards(existingSourceKeys: readonly string[], catalogBrandKeys: readonly string[]): string[] {
  const wanted = new Set(['raayonit:general', ...catalogBrandKeys.map((k) => `raayonit:${k}`)])
  return existingSourceKeys.filter((key) => key.startsWith('raayonit:') && !wanted.has(key))
}

export interface LivePreconditions {
  project: string
  /** The one project a live run may write to (the production project's id, passed in by the script). */
  expectedProject: string
  allowProd: boolean
  confirm: string | undefined
  untranslated: number
  allowUntranslated: boolean
  unexpected: number
  allowRetire: boolean
  /** The stored `system_config/feature_flags.raayonitDisplay`: true means the display is already ON. */
  displayFlag: unknown
}

/** Why a live run must not start, or [] when it may. Production is the only live target; dry runs never call this. */
export function livePromotionBlockers(p: LivePreconditions): string[] {
  const out: string[] = []
  if (p.project !== p.expectedProject) out.push(`Live runs target ${p.expectedProject} only (got ${p.project}).`)
  if (!p.allowProd) out.push('Pass --allow-prod to write to production.')
  if (p.confirm !== p.expectedProject) out.push(`Pass --confirm ${p.expectedProject} to confirm the project.`)
  if (p.untranslated > 0 && !p.allowUntranslated) out.push(`${p.untranslated} fine-print line(s) have no DEV translation (pass --allow-untranslated to keep them in Hebrew).`)
  if (p.unexpected > 0 && !p.allowRetire) out.push(`${p.unexpected} existing Raayonit card(s) in production are not in the catalogue and would be retired (pass --allow-retire after reviewing the dry run).`)
  if (p.displayFlag === true || p.displayFlag === 'true' || p.displayFlag === '1' || p.displayFlag === 'on') out.push('raayonitDisplay is already ON in production; this promotion keeps it off and will not flip a live flag.')
  return out
}

/** Keys of the dev project's live (non-retired, unified) Raayonit cards, as brand keys without the "raayonit:" prefix. */
export function brandKeysOf(sourceKeys: readonly unknown[]): string[] {
  return sourceKeys.filter((k): k is string => typeof k === 'string' && /^raayonit:[^:]+$/.test(k)).map((k) => k.slice('raayonit:'.length)).filter((k) => k !== 'general')
}
