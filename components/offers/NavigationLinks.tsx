'use client'

import Image from 'next/image'
import { useLang } from '@/lib/i18n/useLang'
import { navigationLinks, type NavigationDestination } from '@/lib/maps/navigation'

const BUTTON =
  'flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-[border-color,filter] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

// Waze and Google Maps as a compact pair of 44px icon links, beside the address
// on the offer page (the app: landly-mobile/src/components/NavigationButtons.tsx).
// Universal https links (lib/maps/navigation.ts): a phone with the app
// installed opens it, anything else the maps website, in a new tab so the
// perk stays open behind it. Nothing when the business has no address.
// The official app marks (public/icons; the app's landly-mobile/assets/icons are
// 144px copies), each in its own container. next/image serves them resized, so
// the large originals never reach the page. Waze's mark is a cyan tile to its
// corners, so it fills the button with no white around it; Google Maps' pin is
// transparent and cropped to its own edges, so it stands in a white tile, as
// tall as its 32px box.
export default function NavigationLinks({ destination, className = '', wide = false }: { destination: NavigationDestination; className?: string; wide?: boolean }) {
  const { t } = useLang()
  const links = navigationLinks(destination)
  if (!links) return null
  const newTab = <span className="sr-only">{t('offer_nav_opens_new_tab')}</span>
  // `wide`: two labelled buttons side by side, each half the row (My Pass cards, the voucher page).
  if (wide) {
    const WIDE = 'flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[13px] font-bold shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-[border-color,filter] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
    return (
      <nav aria-label={t('offer_nav_heading')} className={`flex gap-2.5 ${className}`}>
        <a href={links.waze} target="_blank" rel="noopener noreferrer" className={`${WIDE} bg-[#33ccff] text-[#04232e] [@media(hover:hover)]:hover:brightness-95`}>
          <Image src="/icons/waze.webp" alt="" width={48} height={48} className="h-6 w-6 shrink-0 rounded-md object-cover" />
          <span className="truncate">Waze</span>
          <span className="sr-only">{t('offer_nav_waze')} {t('offer_nav_opens_new_tab')}</span>
        </a>
        <a href={links.googleMaps} target="_blank" rel="noopener noreferrer" className={`${WIDE} border border-slate-200/90 bg-white text-slate-900 [@media(hover:hover)]:hover:border-brand`}>
          <Image src="/icons/google-maps.webp" alt="" width={44} height={44} className="h-[22px] w-[22px] shrink-0 object-contain" />
          <span className="truncate">Google Maps</span>
          <span className="sr-only">{t('offer_nav_google')} {t('offer_nav_opens_new_tab')}</span>
        </a>
      </nav>
    )
  }
  return (
    <nav aria-label={t('offer_nav_heading')} className={`flex shrink-0 gap-2 ${className}`}>
      <a href={links.waze} target="_blank" rel="noopener noreferrer" className={`${BUTTON} bg-[#33ccff] [@media(hover:hover)]:hover:brightness-95`}>
        <Image src="/icons/waze.webp" alt="" width={44} height={44} className="h-full w-full object-cover" />
        <span className="sr-only">{t('offer_nav_waze')}</span>
        {newTab}
      </a>
      <a href={links.googleMaps} target="_blank" rel="noopener noreferrer" className={`${BUTTON} border border-slate-200/90 bg-white [@media(hover:hover)]:hover:border-brand`}>
        <Image src="/icons/google-maps.webp" alt="" width={32} height={32} className="h-8 w-8 shrink-0 object-contain" />
        <span className="sr-only">{t('offer_nav_google')}</span>
        {newTab}
      </a>
    </nav>
  )
}
