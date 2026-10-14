'use client'

import { CUSTOMER_TYPES } from '@/lib/customerTypes'
import { useLang } from '@/lib/i18n/useLang'
import { radioKeyDown } from './radioNav'

// Single-choice chip grid (two columns, so all six fit in three rows).
export default function PersonaStep({
  labelledBy,
  value,
  onChange,
  error,
}: {
  labelledBy: string
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  const { t, isRtl } = useLang()
  // With nothing chosen yet, the first chip is the group's tab stop.
  const focusable = Math.max(0, CUSTOMER_TYPES.findIndex((o) => o.value === value))
  return (
    <div className="mb-5">
      <div role="radiogroup" aria-labelledby={labelledBy} aria-invalid={!!error || undefined} className="grid grid-cols-2 gap-2">
        {CUSTOMER_TYPES.map((option, i) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={i === focusable ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(e) => radioKeyDown(e, isRtl, (n) => onChange(CUSTOMER_TYPES[n].value))}
              className={`min-h-[52px] px-3 py-2 rounded-2xl border-[1.5px] text-sm leading-[18px] font-semibold text-center cursor-pointer select-none transition-[border-color,background-color,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 ${
                selected ? 'border-brand bg-brandLight text-brand' : 'border-slate-200 bg-slate-50 text-slate-700 [@media(hover:hover)]:hover:border-slate-300'
              }`}
            >
              {t(option.labelKey)}
            </button>
          )
        })}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs font-semibold text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
