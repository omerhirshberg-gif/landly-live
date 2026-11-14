'use client'

import { ADMIN_INPUT } from './formStyles'
import { useAdminT } from '@/lib/admin/translations'
import { directionalProps } from '@/lib/directionalInput'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
  autoFocus?: boolean
  className?: string
}

export function SearchInput({ value, onChange, placeholder, label, autoFocus, className = '' }: SearchInputProps) {
  const { dir } = useAdminT()
  const inputDir = directionalProps(value, placeholder, dir === 'rtl')
  return (
    <div dir={inputDir.dir === 'auto' ? undefined : inputDir.dir} className={`relative ${className}`}>
      <i
        className="fa-solid fa-magnifying-glass pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-sm text-adm-muted"
        aria-hidden="true"
      />
      <input
        type="search"
        {...inputDir}
        aria-label={label}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`${ADMIN_INPUT} ps-11 shadow-sm`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

interface FilterChipsProps<T extends string> {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

/** Single-choice filter row; wraps onto more lines on a narrow screen, so no chip is ever cut off. */
export function FilterChips<T extends string>({ label, options, value, onChange }: FilterChipsProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`inline-flex min-h-12 shrink-0 items-center rounded-xl border px-4 text-sm font-semibold whitespace-nowrap transition-colors [-webkit-tap-highlight-color:transparent] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adm-accent ${
              selected
                ? 'border-adm-accent bg-adm-accent text-adm-on-accent shadow-sm shadow-adm-accent/20'
                : 'border-adm-line bg-adm-surface text-adm-text-2 hover:border-adm-line-strong hover:text-adm-accent active:bg-adm-raised'
            }`}
          >
            {selected && (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="me-1.5 shrink-0 text-emerald-300" aria-hidden="true">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            )}
            <span dir="auto">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** "12 of 30 businesses" under a filtered list. */
export function ResultCount({ shown, total, noun }: { shown: number; total: number; noun: string }) {
  const { t } = useAdminT()
  return (
    <p className="text-sm text-adm-muted" aria-live="polite">
      {shown === total ? t('list.count', { total, noun }) : t('list.of', { shown, total, noun })}
    </p>
  )
}
