'use client'

import { useRef } from 'react'
import type { UsageView } from '@/lib/usage/usageReport'
import { USAGE_PROJECTS } from '@/lib/usage/usageTypes'

// Combined | Production | Development: a radio group of segments, coloured
// like AdminEnvironmentBadge (red PROD, amber DEV). Arrow keys move the
// choice, as in any radio group. Phones show the short labels; each segment
// carries its full name as its accessible label.

const OPTIONS: { view: UsageView; label: string; short: string; full: string; dot: string; active: string }[] = [
  { view: 'combined', label: 'Combined', short: 'All', full: 'Combined (Production + Development)', dot: 'bg-[#64748B]', active: 'bg-[#0B1B3D] text-white' },
  { view: 'prod', label: 'Production', short: 'Prod', full: `Production (${USAGE_PROJECTS.prod})`, dot: 'bg-[#DC2626]', active: 'bg-[#FEF2F2] text-[#B91C1C] ring-1 ring-[#FECACA]' },
  { view: 'dev', label: 'Development', short: 'Dev', full: `Development (${USAGE_PROJECTS.dev})`, dot: 'bg-[#F59E0B]', active: 'bg-[#FFFBEB] text-[#92400E] ring-1 ring-[#FDE68A]' },
]

export default function EnvironmentSwitch({ value, onChange }: { value: UsageView; onChange: (view: UsageView) => void }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + OPTIONS.length) % OPTIONS.length
    onChange(OPTIONS[next]!.view)
    buttons.current[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-label="Environment" className="grid w-full grid-cols-3 gap-1 rounded-xl border border-[#E2E8F0] bg-white p-1 shadow-sm sm:inline-grid sm:w-auto">
      {OPTIONS.map((option, index) => {
        const checked = option.view === value
        return (
          <button
            key={option.view}
            ref={(element) => {
              buttons.current[index] = element
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.full}
            title={option.full}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.view)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-150 [-webkit-tap-highlight-color:transparent] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0038B8] ${
              checked ? option.active : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0B1B3D]'
            }`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${option.dot}`} aria-hidden="true" />
            <span className="sm:hidden" aria-hidden="true">
              {option.short}
            </span>
            <span className="hidden sm:inline" aria-hidden="true">
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
