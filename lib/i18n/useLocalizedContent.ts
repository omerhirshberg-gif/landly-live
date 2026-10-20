import { useState } from 'react'
import { localizeText, showsMachineTranslation, type ContentTranslations, type LocalizedText } from './contentTranslation'
import type { Lang } from './translations'

/**
 * An offer's (or voucher's) admin-written fields in the reader's language,
 * with the "Show original" switch the attribution line toggles. Shared by
 * the website's and the app's detail screens; `lang` comes from whichever
 * LangProvider the caller has.
 */
export function useLocalizedContent<F extends string>(
  sources: Record<F, string>,
  translations: ContentTranslations<F> | null | undefined,
  lang: Lang
) {
  const [original, setOriginal] = useState(false)
  const machine = showsMachineTranslation(translations, lang, sources)
  const showingOriginal = original && machine
  const text = (field: F): LocalizedText =>
    showingOriginal
      ? { text: sources[field], lang: translations?.sourceLang ?? null, machine: false }
      : localizeText(sources[field], translations, lang, field)
  return { text, machine, showingOriginal, toggleOriginal: () => setOriginal((value) => !value) }
}
