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
        className="fa-solid fa-magnifying-glass pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-sm text-[#64748B]"
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
            className={`inline-flex min-h-12 shrink-0 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors [-webkit-tap-highlight-color:transparent] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0038B8] ${
              selected
                ? 'border-[#0038B8] bg-[#0038B8] text-white shadow-sm shadow-[#0038B8]/20'
                : 'border-[#E2E8F0] bg-white text-[#475569] hover:border-[#CBD5E1] hover:text-[#0038B8] active:bg-[#F1F5F9]'
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
    <p className="text-sm text-[#64748B]" aria-live="polite">
      {shown === total ? t('list.count', { total, noun }) : t('list.of', { shown, total, noun })}
    </p>
  )
}
