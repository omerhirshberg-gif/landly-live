'use client'

import { useLang } from '@/lib/i18n/useLang'

// The "{n}% OFF" badge, the same on the perk card and the offer page: solid
// emerald with white text. Emerald-700 (#047857) rather than -600: white on
// -600 is 3.8:1, under WCAG AA's 4.5:1 for text this size; -700 is 5.5:1.
// The label follows the page's direction (Hebrew reads "15% הנחה" right to
// left). The Expo OfferCard mirrors it. 'sm' is the compact rail card's.
export default function DiscountBadge({ percent, size = 'md', className = '' }: { percent: number; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const { t } = useLang()
  if (percent <= 0) return null
  return (
    <span
      className={`inline-flex items-center rounded-full bg-[#047857] font-extrabold uppercase leading-none tracking-wide text-white shadow-sm ${
        size === 'lg' ? 'px-3 py-1.5 text-sm' : size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1 text-xs sm:text-sm'
      } ${className}`}
    >
      {t('offer_percent_off').replace('{n}', String(percent))}
    </span>
  )
}
