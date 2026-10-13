import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@shared/i18n/translations'

// Native counterpart of lib/i18n/LangProvider.tsx: same dictionary, same
// context shape ({ lang, setLang, t, isRtl }), but AsyncStorage instead of
// localStorage, and layout direction is applied by the root layout instead
// of on <html>. English is the default until the user picks something else.
interface LangContextValue {
  /** Language this subtree renders in (always 'en' inside <EnglishOnly>). */
  lang: Lang
  /** The user's actual app language, even inside <EnglishOnly>. */
  appLang: Lang
  setLang: (lang: Lang) => void
  t: (key: TranslationKey) => string
  isRtl: boolean
}

const LangContext = createContext<LangContextValue | null>(null)

const STORAGE_KEY = 'landly_lang' // same key name as the web app's localStorage
const DEFAULT_LANG: Lang = 'en'

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved && saved in translations) setLangState(saved as Lang)
      })
      .catch(() => {
        // Storage unavailable — stay on the default language
      })
  }, [])

  const setLang = (next: Lang) => {
    setLangState(next)
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Storage unavailable — the choice just won't persist
    })
  }

  const t = (key: TranslationKey): string => translations[lang][key] || translations.en[key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)

  return <LangContext.Provider value={{ lang, appLang: lang, setLang, t, isRtl }}>{children}</LangContext.Provider>
}

// Renders its subtree in English, left-to-right, whatever the app language
// is (the auth screens are English-only). `setLang` still changes the app
// language, so a preference applied on sign-in reaches the rest of the app.
export function EnglishOnly({ children }: { children: ReactNode }) {
  const { appLang, setLang } = useLang()
  const t = (key: TranslationKey): string => translations.en[key]
  return <LangContext.Provider value={{ lang: 'en', appLang, setLang, t, isRtl: false }}>{children}</LangContext.Provider>
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used within a LangProvider')
  return ctx
}
