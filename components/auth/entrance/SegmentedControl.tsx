'use client'

import type { CSSProperties } from 'react'
import { useLang } from '@/lib/i18n/useLang'

// Web counterpart of landly-mobile/src/components/SegmentedControl.tsx:
// equal-width segments with a white pill that slides by whole multiples of
// its own width (percent translate), on the entrance's strong ease-out. The
// pill is anchored at the start edge, so in RTL it slides the other way.
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  const { isRtl } = useLang()
  const count = options.length
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  const pill: CSSProperties = {
    width: `${100 / count}%`,
    transform: `translateX(${(isRtl ? -index : index) * 100}%)`,
    transition: 'transform 220ms var(--ease-out)',
  }
  return (
    <div role="tablist" className={`p-1 rounded-[14px] bg-slate-100 ${className ?? ''}`}>
      <div className="relative flex">
        <div aria-hidden="true" className="absolute inset-y-0 start-0 rounded-[10px] bg-white shadow-[0_2px_6px_rgba(15,23,42,0.08)]" style={pill} />
        {options.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(option.value)}
              className={`relative flex-1 min-h-[42px] px-2 flex items-center justify-center text-copy font-bold cursor-pointer select-none ${
                active ? 'text-brand' : 'text-slate-500'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
