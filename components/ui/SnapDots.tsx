'use client'

import { useLang } from '@/lib/i18n/useLang'

/** Past this many cards a row of dots stops reading as a position and becomes noise: longer rows go without. */
export const SNAP_DOTS_MAX = 8

// iOS-style pagination dots under a phone swipe row (with useSnapIndex): the
// active dot stretches into a pill, the rest are small slate circles. Each
// dot is a 44px tap target that brings its card into view. They follow the
// DOM order, so they mirror with the row in Hebrew. Hide them where the row
// becomes a grid by passing that breakpoint's hidden class.
export default function SnapDots({ count, active, onSelect, className = '' }: { count: number; active: number; onSelect: (index: number) => void; className?: string }) {
  const { t } = useLang()
  return (
    <div className={`flex justify-center ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={t('landing_dots_label').replace('{n}', String(i + 1)).replace('{total}', String(count))}
          aria-current={i === active ? 'true' : undefined}
          className="flex h-11 w-11 items-center justify-center [-webkit-tap-highlight-color:transparent]"
        >
          <span aria-hidden="true" className={`block h-1.5 rounded-full transition-all duration-300 ease-out motion-reduce:transition-none ${i === active ? 'w-6 bg-brand' : 'w-1.5 bg-slate-300'}`} />
        </button>
      ))}
    </div>
  )
}
