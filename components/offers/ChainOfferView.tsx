'use client'

import BrandMedia from '@/components/ui/BrandMedia'
import { useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight, Ticket } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import BackButton from '@/components/navigation/BackButton'
import OfferTags from '@/components/discover/OfferTags'
import ContactActions from '@/components/offers/ContactActions'
import HowToRedeem from '@/components/offers/HowToRedeem'
import BrandStrip from '@/components/offers/BrandStrip'
import BranchStrip from '@/components/offers/BranchStrip'
import RaayonitChainNotes from '@/components/raayonit/RaayonitChainNotes'
import { ParticipatingChains, RedemptionGuide } from '@/components/discover/PerkReach'
import { useAuth } from '@/lib/firebase/useAuth'
import type { OfferDocument } from '@/lib/firebase/offers'
import { useLang } from '@/lib/i18n/useLang'
import { useLocalizedContent } from '@/lib/i18n/useLocalizedContent'
import { useRaayonitDisplay } from '@/lib/flags/raayonitDisplayStore'
import { isolateLtr } from '@/lib/home/superShowcase'
import { isFlagship } from '@/lib/offers/discoverTab'
import { raayonitCategoryName, raayonitCategoryOf } from '@/lib/offers/raayonitCategories'
import { logoOnlyHero } from '@/lib/offers/logoOnly'
import { locationNoticeKind } from '@/lib/offers/locationVisibility'
import { RAAYONIT_CARD_PAGE, RAAYONIT_HUB } from '@/lib/offers/offerRoutes'
import { distinctDescription, offerTextSources } from '@/lib/offers/offerText'
import { raayonitStartPrice } from '@/lib/offers/raayonitStartPrice'
import { roundedCount } from '@/lib/offers/raayonitPreview'
import { useChainBrands } from '@/lib/offers/useChainBrands'
import { useOffers } from '@/lib/offers/useOffers'
import { RAAYONIT_LOGO_PATH } from '@/lib/payments/issuer'

// A participating Raayonit chain's page (native: landly-mobile/src/components/ChainOfferView.tsx). It is not a voucher for this one store: no
// price, no discount, no denomination picker and no store-specific Buy. It names the venue, says it accepts the Raayonit Card and sends the
// visitor to the card's own page (/raayonit). Desktop: a centred max-w-5xl column with the venue header card on top, the participating
// branches (main) beside how to redeem and the fine print (side). The sticky bar below lg carries the same action.
export default function ChainOfferView({ offer, hint }: { offer: OfferDocument; hint?: ReactNode }) {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const display = useRaayonitDisplay()
  const { offers: all } = useOffers()
  const content = useLocalizedContent(offerTextSources(offer), offer.translations, lang)
  const nameContent = useLocalizedContent({ businessName: offer.businessName ?? '' }, offer.businessTranslations, lang)
  const chainSubject = useMemo(() => ({ offerId: offer.id, perkScope: offer.perkScope, participatingChains: offer.participatingChains, allLiveBrands: true }), [offer])
  const liveBrands = useChainBrands(chainSubject)
  const chainBrands = offer.brandIndex?.length ? offer.brandIndex : liveBrands

  const flagship = useMemo(() => (all ?? []).find(isFlagship) ?? null, [all])
  const total = useMemo(() => roundedCount((all ?? []).filter((o) => o.fulfillmentType === 'raayonit_pool' && !isFlagship(o)).length), [all])
  const price = raayonitStartPrice(flagship)
  const priceText = isolateLtr(`₪${price}`)
  const cta = t('chain_card_cta').replace('{price}', priceText)
  const note = t('chain_card_note').replace('{count}+', isolateLtr(`${total}+`))
  const seeAll = t('chain_all_chains').replace('{count}+', isolateLtr(`${total}+`))

  const name = nameContent.text('businessName')
  const description = content.text('description')
  const descriptionText = distinctDescription(content.text('title').text, description.text)
  const instructions = content.text('redemptionInstructions')
  const terms = content.text('redemptionTerms')
  const hero = logoOnlyHero(offer)
  const photo = offer.logoKind === 'photo'
  const logoSrc = hero?.kind === 'brand' ? hero.logoUrl : offer.imageUrl || RAAYONIT_LOGO_PATH

  const noticeKind = locationNoticeKind(offer)
  const hasBranches = !!offer.branches?.length
  const hasList = hasBranches || noticeKind === 'chains' || noticeKind === 'stores' || (offer.perkScope === 'multi_chain' && chainBrands.length > 0)

  const ctaClass = 'ds-btn ds-btn-primary ds-btn-wrap w-full lg:h-[52px] lg:rounded-xl lg:text-base lg:font-bold'
  return (
    <>
      <Navbar />
      <div className="member-canvas below-header">
        <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-14 lg:pt-8">
          {hint}
          <BackButton fallback={user ? '/' : '/categories'} contextLabel className="mb-4" />

          <header className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
              <div className="relative h-40 w-40 shrink-0 self-center overflow-hidden rounded-2xl border border-slate-200 bg-[#EEF2F7] sm:self-auto">
                <BrandMedia src={logoSrc} alt={name.text} cover={photo} inset="p-4" eager />
              </div>
              <div className="min-w-0 flex-1">
                <OfferTags categoryName={raayonitCategoryName(raayonitCategoryOf(offer), lang)} category={offer.category} method={offer.redemptionMethod} modes={offer.redemptionModes} className="mb-2" />
                <h1 className="break-words text-2xl font-black leading-tight tracking-tight text-ink sm:text-3xl"><bdi lang={name.lang ?? undefined} dir="auto">{name.text}</bdi></h1>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brandTint px-3 py-1 text-[13px] font-semibold text-brand"><Ticket aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />{t('businesses_accepts')}</p>
                <p className="mt-3 max-w-xl text-sm leading-5 text-body">{note}</p>
                <ContactActions websiteUrl={offer.websiteUrl} phone={offer.contactPhone} className="mt-4" />
                <div className="mt-5 hidden max-w-md lg:block">
                  <Link href={RAAYONIT_CARD_PAGE} className={ctaClass}><span>{cta}</span></Link>
                </div>
                <IssuerNote show={display} className="mt-4" />
              </div>
            </div>
          </header>

          <div className="mt-6 space-y-6 lg:mt-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8 lg:space-y-0">
            <div className="space-y-6 lg:col-span-7">
              {hasList && (
                <section aria-labelledby="chain-branches-title" className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-6">
                  <h2 id="chain-branches-title" className="mb-4 text-lg font-extrabold tracking-tight text-ink">{t(noticeKind === 'chains' ? 'perk_chains_title' : 'perk_stores_title')}</h2>
                  {offer.perkScope === 'multi_chain' && chainBrands.length > 0 ? (
                    <div className="space-y-4"><BrandStrip entries={chainBrands} /><RedemptionGuide offer={offer} /></div>
                  ) : hasBranches ? (
                    <BranchStrip branches={offer.branches!} brand={offer.brandName || offer.businessName || null} />
                  ) : (
                    <ParticipatingChains offer={offer} />
                  )}
                </section>
              )}
              {!!descriptionText && (
                <section className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-6">
                  <h2 className="mb-3 text-lg font-extrabold tracking-tight text-ink">{t('offer_about_title')}</h2>
                  <p className="whitespace-pre-line text-copy leading-relaxed text-body" lang={description.lang ?? undefined} dir="auto">{descriptionText}</p>
                </section>
              )}
              <Link href={RAAYONIT_HUB} className="group flex min-h-11 items-center gap-1 text-sm font-bold text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                <span>{seeAll}</span>
                <ChevronRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2} />
              </Link>
            </div>

            <aside className="space-y-6 lg:col-span-5">
              <RaayonitChainNotes offer={offer} />
              <HowToRedeem method={offer.redemptionMethod} instructions={instructions.text} instructionsLang={instructions.lang} terms={terms.text} termsLang={terms.lang} codeOnly />
              <IssuerNote show={display} className="lg:hidden" />
            </aside>
          </div>
        </div>

        {/* Phones and tablets: the action sticks to the foot of the screen (floating buttons rise above it). */}
        <div data-floating-clearance="" className="sticky bottom-0 z-10 border-t border-slate-100 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:px-6 lg:hidden">
          <Link href={RAAYONIT_CARD_PAGE} className={ctaClass}><span>{cta}</span></Link>
        </div>
      </div>
    </>
  )
}

// "Issued by Raayonit Ltd." with the partner's logo, which appears only once its written approval is switched on.
function IssuerNote({ show, className = '' }: { show: boolean; className?: string }) {
  const { t } = useLang()
  return (
    <p className={`flex items-center gap-2 text-xs text-muted ${className}`}>
      {show && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={RAAYONIT_LOGO_PATH} alt="" aria-hidden="true" width={20} height={34} className="h-7 w-auto rounded border border-slate-200 bg-white p-0.5" />
      )}
      <span>{t('chain_issued_by')}</span>
    </p>
  )
}
