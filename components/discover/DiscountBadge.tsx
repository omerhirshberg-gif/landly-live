'use client'

import { useLang } from '@/lib/i18n/useLang'

// An offer's "-15%" as a ribbon tied to the top end corner of its photo: solid
// emerald-700 with white text (5.5:1), the card's or photo's corner above it
// and one rounded corner into the picture. Where nothing clips the corner,
// `className` rounds it. A sign and digits, left to right in every language;
// screen readers get the words.
export default function DiscountBadge({ percent, className = '' }: { percent: number; className?: string }) {
  const { t } = useLang()
  if (percent <= 0) return null
  return (
    <span className={`absolute top-0 end-0 rounded-es-2xl bg-emerald-700 px-3 py-1 text-xs font-bold text-white shadow-md sm:text-sm ${className}`}>
      <bdi aria-hidden="true" dir="ltr">{`-${percent}%`}</bdi>
      <span className="sr-only">{t('offer_percent_off').replace('{n}', String(percent))}</span>
    </span>
  )
}
