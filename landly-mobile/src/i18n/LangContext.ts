import { createContext } from 'react'
import type { Lang, TranslationKey } from '@shared/i18n/translations'

export interface LangContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TranslationKey) => string
  isRtl: boolean
  /** The saved choice has been read from storage (or there was none to read). */
  ready: boolean
}

// Its own module, importing nothing at runtime (the import above is
// type-only). Fast Refresh re-runs a module whenever it or a file it imports
// is edited; were the context created in LangProvider.tsx, an edit to the
// shared translations would mint a second context mid-session, and screens
// already mounted would read the new one with no provider above them.
export const LangContext = createContext<LangContextValue | null>(null)
