'use client'

import { MAX_PERSONA_NOTE_LENGTH, OTHER_CUSTOMER_TYPE } from '@/lib/auth/onboarding'
import { CUSTOMER_TYPES } from '@/lib/customerTypes'
import { useLang } from '@/lib/i18n/useLang'
import TextField from '../entrance/TextField'
import styles from '../entrance/entrance.module.css'
import { radioKeyDown } from './radioNav'

// Single-choice chip grid in two columns; with an odd number of types the
// last chip ("Other") spans both, so no row is left half empty. Also used by
// the Member type settings page (app/settings/member-type). Choosing "Other"
// reveals an optional note below the chips, 20px under the grid and (with
// the CTA's own top margin) 24px above Continue; the stage around the card
// eases its height as it appears.
export default function PersonaStep({
  labelledBy,
  value,
  onChange,
  note,
  onNoteChange,
  error,
}: {
  labelledBy: string
  value: string
  onChange: (value: string) => void
  note: string
  onNoteChange: (note: string) => void
  error?: string
}) {
  const { t, isRtl } = useLang()
  // With nothing chosen yet, the first chip is the group's tab stop.
  const focusable = Math.max(0, CUSTOMER_TYPES.findIndex((o) => o.value === value))
  return (
    <div className="mb-5">
      <div role="radiogroup" aria-labelledby={labelledBy} aria-invalid={!!error || undefined} className="grid grid-cols-2 gap-3">
        {CUSTOMER_TYPES.map((option, i) => {
          const selected = option.value === value
          const spansRow = i === CUSTOMER_TYPES.length - 1 && CUSTOMER_TYPES.length % 2 === 1
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={i === focusable ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(e) => radioKeyDown(e, isRtl, (n) => onChange(CUSTOMER_TYPES[n].value))}
              className={`${styles.choice} ${spansRow ? 'col-span-2' : ''} min-h-[54px] px-3 py-2 rounded-2xl border-[1.5px] text-sm leading-[18px] font-semibold text-center cursor-pointer select-none focus-visible:outline-none ${
                selected ? 'border-brand bg-brandLight text-brand' : 'border-slate-200 bg-slate-50 text-slate-700 [@media(hover:hover)]:hover:border-slate-300'
              }`}
            >
              {t(option.labelKey)}
            </button>
          )
        })}
      </div>
      {error && (
        <p role="alert" className={`${styles.reveal} mt-2 text-xs font-semibold text-red-600`}>
          {error}
        </p>
      )}
      {value === OTHER_CUSTOMER_TYPE && (
        <div className={`${styles.reveal} mt-5 -mb-4`}>
          <TextField
            label={t('onb_persona_otherLabel')}
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder={t('onb_persona_otherPlaceholder')}
            maxLength={MAX_PERSONA_NOTE_LENGTH}
            autoComplete="off"
            enterKeyHint="next"
          />
        </div>
      )}
    </div>
  )
}
