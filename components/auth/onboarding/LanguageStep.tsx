'use client'

import { ONBOARDING_LANGS } from '@/lib/auth/onboarding'
import { useLang } from '@/lib/i18n/useLang'
import { RTL_LANGS, type Lang } from '@/lib/i18n/translations'
import styles from '../entrance/entrance.module.css'
import { radioKeyDown } from './radioNav'

// Picking a row selects it at once; the wizard then cross-fades the card into
// the new language and direction and stays here until Continue. All five
// languages (Hebrew last) as compact full-width rows, so the card fits a
// small phone without scrolling: flag and native name on the leading side
// (the flag in a fixed box, so every name starts on one line), the radio on
// the trailing side.
export default function LanguageStep({ labelledBy, selected, onSelect }: { labelledBy: string; selected: Lang; onSelect: (code: Lang) => void }) {
  const { isRtl } = useLang()
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid w-full gap-2 mb-4">
      {ONBOARDING_LANGS.map((option) => {
        const checked = option.code === selected
        return (
          <button
            key={option.code}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onSelect(option.code)}
            onKeyDown={(e) => radioKeyDown(e, isRtl, (i) => onSelect(ONBOARDING_LANGS[i].code))}
            className={`${styles.choice} flex w-full items-center justify-between gap-3 min-h-[52px] lg:min-h-[56px] px-4 py-3 lg:py-3.5 rounded-[14px] border-[1.5px] text-start cursor-pointer select-none focus-visible:outline-none ${
              checked ? 'border-brand bg-brandLight' : 'border-slate-200 bg-slate-50 [@media(hover:hover)]:hover:border-slate-300'
            }`}
          >
            <span className="flex flex-1 items-center gap-2.5 min-w-0">
              <span aria-hidden="true" className="w-7 shrink-0 text-center text-xl leading-6">
                {option.flag}
              </span>
              <span
                lang={option.code}
                dir={(RTL_LANGS as readonly string[]).includes(option.code) ? 'rtl' : 'ltr'}
                className={`min-w-0 flex-1 truncate text-start text-title font-bold transition-colors duration-300 ${checked ? 'text-brand' : 'text-slate-800'}`}
              >
                {option.label}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors duration-300 ${checked ? 'border-brand bg-brand' : 'border-slate-300 bg-white'}`}
            >
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
          </button>
        )
      })}
    </div>
  )
}
