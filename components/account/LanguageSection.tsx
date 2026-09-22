'use client'

import type { User } from 'firebase/auth'
import { useLang } from '@/lib/i18n/useLang'
import { LANGUAGES } from '@/lib/i18n/languages'
import { updateUserLanguage } from '@/lib/firebase/users'

export default function LanguageSection({ user }: { user: User }) {
  const { t, lang, setLang } = useLang()

  const handleLanguageChange = (code: (typeof LANGUAGES)[number]['code']) => {
    setLang(code)
    updateUserLanguage(user.uid, code)
  }

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm">
      <h3 className="text-base font-bold text-slate-900 mb-4">{t('profile_language_title')}</h3>
      <div className="flex flex-wrap gap-2">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => handleLanguageChange(l.code)}
            aria-pressed={lang === l.code}
            className={`tap-target inline-flex items-center gap-2 text-sm font-bold rounded-full px-4 py-2 border transition ${
              lang === l.code
                ? 'bg-brand/10 text-brand border-brand/40'
                : 'bg-white text-slate-600 border-slate-200 hover:border-brand hover:text-brand'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  )
}
