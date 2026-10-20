'use client'

import { useLang } from '@/lib/i18n/useLang'
import { navigationLinks, type NavigationDestination } from '@/lib/maps/navigation'

const CHIP =
  'inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-ink transition-colors [@media(hover:hover)]:hover:border-brand [@media(hover:hover)]:hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

// "Navigate with Waze" / "Google Maps" under the address on the offer page.
// Universal https links (lib/maps/navigation.ts): a phone with the app
// installed opens it, anything else the maps website, in a new tab so the
// perk stays open behind it. Nothing when the business has no address.
export default function NavigationLinks({ destination, className = '' }: { destination: NavigationDestination; className?: string }) {
  const { t } = useLang()
  const links = navigationLinks(destination)
  if (!links) return null
  const newTab = <span className="sr-only">{t('offer_nav_opens_new_tab')}</span>
  return (
    <nav aria-label={t('offer_nav_heading')} className={`flex flex-wrap gap-2 ${className}`}>
      <a href={links.waze} target="_blank" rel="noopener noreferrer" className={CHIP}>
        <i className="fa-brands fa-waze text-base text-[#33CCFF]" aria-hidden="true"></i>
        <span>{t('offer_nav_waze')}</span>
        {newTab}
      </a>
      <a href={links.googleMaps} target="_blank" rel="noopener noreferrer" className={CHIP}>
        <i className="fa-solid fa-map-location-dot text-base text-[#34A853]" aria-hidden="true"></i>
        <span>{t('offer_nav_google')}</span>
        {newTab}
      </a>
    </nav>
  )
}
