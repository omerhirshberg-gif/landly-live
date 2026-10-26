'use client'

import Image from 'next/image'
import { useLang } from '@/lib/i18n/useLang'
import { navigationLinks, type NavigationDestination } from '@/lib/maps/navigation'

const BUTTON =
  'flex h-[46px] min-w-0 items-center justify-center gap-2 rounded-[14px] border border-slate-200 bg-white px-3 shadow-sm text-meta font-semibold text-ink transition-colors [@media(hover:hover)]:hover:border-brand [@media(hover:hover)]:hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

// Waze and Google Maps, side by side in equal halves under the address on
// the offer page (the app: landly-mobile/src/components/NavigationButtons.tsx).
// Universal https links (lib/maps/navigation.ts): a phone with the app
// installed opens it, anything else the maps website, in a new tab so the
// perk stays open behind it. Nothing when the business has no address.
// The official app marks (public/icons, the same files as the app's
// landly-mobile/assets/icons), drawn at 20px. next/image serves them resized,
// so the large originals never reach the page. Waze's mark is a square tile,
// so it's rounded like an app icon; Google Maps' pin is transparent.
function BrandIcon({ src, rounded = false }: { src: string; rounded?: boolean }) {
  return <Image src={src} alt="" width={20} height={20} className={`h-5 w-5 shrink-0 object-contain ${rounded ? 'rounded-[5px]' : ''}`} />
}

export default function NavigationLinks({ destination, className = '' }: { destination: NavigationDestination; className?: string }) {
  const { t } = useLang()
  const links = navigationLinks(destination)
  if (!links) return null
  const newTab = <span className="sr-only">{t('offer_nav_opens_new_tab')}</span>
  return (
    <nav aria-label={t('offer_nav_heading')} className={`grid grid-cols-2 gap-3 ${className}`}>
      <a href={links.waze} target="_blank" rel="noopener noreferrer" className={BUTTON}>
        <BrandIcon src="/icons/waze.webp" rounded />
        <span className="truncate">Waze</span>
        {newTab}
      </a>
      <a href={links.googleMaps} target="_blank" rel="noopener noreferrer" className={BUTTON}>
        <BrandIcon src="/icons/google-maps.webp" />
        <span className="truncate">Google Maps</span>
        {newTab}
      </a>
    </nav>
  )
}
