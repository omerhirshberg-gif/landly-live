'use client'

import { radioKeyDown } from '@/components/auth/onboarding/radioNav'
import { useLang } from '@/lib/i18n/useLang'

export type Option = { value: string; label: string }

// The site's single-choice card grid for Edit profile (the customer type and
// the region in Israel), twin of the app's components/OptionGrid.tsx: two equal
// columns, every card the same height (a long label wraps inside it), and the
// odd last card across the row, so no row is left half empty. Columns follow
// the reading direction. A radio group: arrows move and select, and with
// nothing chosen the first card is the tab stop.
export default function OptionGrid({
  options,
  value,
  onChange,
  labelledBy,
  idPrefix,
}: {
  options: readonly Option[]
  value: string
  onChange: (value: string) => void
  labelledBy: string
  idPrefix: string
}) {
  const { isRtl } = useLang()
  const focusable = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-2 gap-3">
      {options.map((option, i) => {
        const selected = option.value === value
        const spansRow = i === options.length - 1 && options.length % 2 === 1
        return (
          <button
            key={option.value}
            id={`${idPrefix}-${option.value}`}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={i === focusable ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => radioKeyDown(e, isRtl, (n) => onChange(options[n].value))}
            className={`tap-target flex min-h-[56px] cursor-pointer select-none items-center justify-center rounded-2xl border-[1.5px] px-3 py-2 text-center text-sm font-semibold leading-[18px] transition-[background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25 ${spansRow ? 'col-span-2' : ''} ${
              selected
                ? 'border-brand bg-brandLight text-brand font-bold shadow-[0_0_0_4px_rgba(0,56,184,0.12)]'
                : 'border-slate-200 bg-slate-50 text-slate-700 [@media(hover:hover)]:hover:border-slate-300'
            }`}
          >
            <span className="min-w-0 break-words">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
