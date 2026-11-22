'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import ContactActions from './ContactActions'
import type { OfferDocument } from '@/lib/firebase/offers'
import { useLang } from '@/lib/i18n/useLang'
import { localizedBusinessName } from '@/lib/business/businessText'
import { badgeLogoUri } from '@/lib/offers/dealImage'
import { isRaayonitOffer, logoOnlyHero } from '@/lib/offers/logoOnly'
import { perkBrand } from '@/lib/perks/perksFilter'
import { RAAYONIT_LOGO_PATH } from '@/lib/payments/issuer'
import DealMedia from '@/components/discover/DealMedia'
import MerchantBadge from '@/components/discover/MerchantBadge'
import type { DealImage } from '@/components/discover/useDealImage'

// The brand's card at the foot of the offer page: the offer's own picture (else its category's panel) as the banner, the brand's logo
// centred across the banner's lower edge, then its website (only when Raayonit or GoLandly hold one) and "To brand page", which opens the
// Perks catalogue filtered to that brand. No description: only what the data holds. Expo: landly-mobile/src/components/BrandSpotlight.tsx.
export default function BrandSpotlight({ offer, image, alt, className = '' }: { offer: OfferDocument; image: DealImage; alt: string; className?: string }) {
  const { t, lang } = useLang()
  const name = perkBrand(offer)
  const shown = localizedBusinessName(offer, lang).text || name
  if (!name || offer.perkScope === 'multi_chain') return null
  const hero = logoOnlyHero(offer)
  const heroLogo = hero ? { src: hero.kind === 'issuer' ? RAAYONIT_LOGO_PATH : hero.logoUrl, alt: name, small: hero.kind === 'brand' ? hero.fallback : hero.small } : null
  const logoUrl = heroLogo ? '' : badgeLogoUri(offer.businessLogoUrl ?? '', offer.imageUrl, image.role) ?? ''
  return (
    <section aria-label={shown} className={`overflow-hidden rounded-3xl bg-[#F4F5F7] ${className}`}>
      <div className="relative">
        <DealMedia src={offer.imageUrl} image={image} alt={alt} category={offer.category} logo={heroLogo} aspect="aspect-[16/7] max-h-[160px]" />
        {(logoUrl || isRaayonitOffer(offer)) && (
          <div className="absolute inset-x-0 -bottom-7 z-10 flex justify-center"><MerchantBadge size="lg" logoUrl={logoUrl} /></div>
        )}
      </div>
      <div className="flex flex-col items-center gap-2.5 px-5 pb-5 pt-11 text-center">
        <h2 className="text-lg font-extrabold leading-6 text-ink"><bdi dir="auto">{shown}</bdi></h2>
        {/* The website and the phone, equal 44px buttons side by side. */}
        <ContactActions row websiteUrl={offer.websiteUrl} phone={offer.contactPhone} className="mt-1" />
        <Link href={`/categories?brand=${encodeURIComponent(name)}`} className="tap-target flex min-h-11 w-full items-center justify-center gap-0.5 rounded-xl border border-[#CBD5E1] bg-white/70 text-[15px] font-bold text-ink transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 [@media(hover:hover)]:hover:bg-white">
          {t('brand_spotlight_cta')}
          <ChevronRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2} />
        </Link>
      </div>
    </section>
  )
}
