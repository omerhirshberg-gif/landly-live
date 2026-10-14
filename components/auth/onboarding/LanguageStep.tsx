'use client'

import { ONBOARDING_LANGS } from '@/lib/auth/onboarding'
import { useLang } from '@/lib/i18n/useLang'
import { RTL_LANGS, type Lang } from '@/lib/i18n/translations'
import { radioKeyDown } from './radioNav'

// Step 1. Picking a card switches the whole site's language and direction at
// once (LangProvider persists it); a tap also moves on to the next step,
// while arrow keys only select, leaving Enter / Continue to advance. All
// five languages as compact rows, so the card fits a small phone without
// scrolling.
export default function LanguageStep({ labelledBy, onPick }: { labelledBy: string; onPick: () => void }) {
  const { lang, setLang, isRtl } = useLang()
  const choose = (code: Lang) => {
    if (code !== lang) setLang(code)
  }
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid gap-2 mb-4">
      {ONBOARDING_LANGS.map((option) => {
        const selected = option.code === lang
        return (
          <button
            key={option.code}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              choose(option.code)
              onPick()
            }}
            onKeyDown={(e) => radioKeyDown(e, isRtl, (i) => choose(ONBOARDING_LANGS[i].code))}
            className={`flex items-center justify-between gap-3 min-h-[52px] px-4 rounded-[14px] border-[1.5px] text-start cursor-pointer select-none transition-[border-color,background-color,transform] duration-150 active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 ${
              selected ? 'border-brand bg-brandLight' : 'border-slate-200 bg-slate-50 [@media(hover:hover)]:hover:border-slate-300'
            }`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <span aria-hidden="true" className="text-xl leading-6">
                {option.flag}
              </span>
              <span
                lang={option.code}
                dir={(RTL_LANGS as readonly string[]).includes(option.code) ? 'rtl' : 'ltr'}
                className={`text-[17px] font-bold ${selected ? 'text-brand' : 'text-slate-800'}`}
              >
                {option.label}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center ${selected ? 'border-brand bg-brand' : 'border-slate-300 bg-white'}`}
            >
              {selected && (
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
