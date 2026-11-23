'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, CircleCheck, Heart, MapPin, Tags, Ticket } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import ComingSoonNotice from '@/components/raayonit/ComingSoonNotice'
import Navbar from '@/components/layout/Navbar'
import { useLang } from '@/lib/i18n/useLang'
import { Lang } from '@/lib/i18n/translations'
import { useAuth } from '@/lib/firebase/useAuth'
import { useWishlist } from '@/lib/firebase/useWishlist'
import { getClaimedPoolIds } from '@/lib/firebase/vouchers'
import { variantDiscountPercent } from '@/lib/offers/variants'
import { variantForDenomination } from '@/lib/home/superShowcase'
import VariantSelector from '@/components/offers/VariantSelector'
import { getOffer, getOfferDiscountPercent, OfferDocument } from '@/lib/firebase/offers'
import { formatPrice } from '@/lib/format'
import DealMedia from '@/components/discover/DealMedia'
import { isRaayonitOffer, logoOnlyHero, raayonitImageOpts } from '@/lib/offers/logoOnly'
import { RAAYONIT_LOGO_PATH } from '@/lib/payments/issuer'
import { useDealImage } from '@/components/discover/useDealImage'
import MerchantBadge from '@/components/discover/MerchantBadge'
import OfferTags from '@/components/discover/OfferTags'
import FlagshipEyebrow from '@/components/offers/FlagshipEyebrow'
import { superTavHeadline } from '@/lib/offers/superTav'
import DiscountBadge from '@/components/discover/DiscountBadge'
import HowToRedeem, { Fold } from '@/components/offers/HowToRedeem'
import RedemptionCallout from '@/components/offers/RedemptionCallout'
import IssuerAttribution from '@/components/member/IssuerAttribution'
import { isChain, isFlagship, landlyOffers } from '@/lib/offers/discoverTab'
import RaayonitChainNotes from '@/components/raayonit/RaayonitChainNotes'
import { isPooled } from '@/lib/inventory/types'
import { RAAYONIT_ISSUER } from '@/lib/payments/issuer'
import { ParticipatingChains, PerkReachLine, RedemptionGuide } from '@/components/discover/PerkReach'
import BrandStrip from '@/components/offers/BrandStrip'
import { useChainBrands } from '@/lib/offers/useChainBrands'
import BranchStrip from '@/components/offers/BranchStrip'
import OfferMemberGate from '@/components/offers/OfferMemberGate'
import BackButton from '@/components/navigation/BackButton'
import OpenInAppHint from '@/components/layout/OpenInAppHint'
import TranslationNotice from '@/components/ui/TranslationNotice'
import IconFrame from '@/components/ui/IconFrame'
import { useLocalizedContent } from '@/lib/i18n/useLocalizedContent'
import { badgeLogoUri } from '@/lib/offers/dealImage'
import { distinctDescription, offerTextSources } from '@/lib/offers/offerText'
import { offerFullAddress } from '@/lib/geo'
import { isSingleVenue, locationNoticeKind, shouldShowLocationNavigation } from '@/lib/offers/locationVisibility'
import NavigationLinks from '@/components/offers/NavigationLinks'
import { GlobalPerkSearchRow } from '@/components/layout/MemberPageShell'
import { ChainsFold, MultiChainBonus } from '@/components/offers/MultiChainCredit'
import BrandSpotlight from '@/components/offers/BrandSpotlight'
import ChainOfferView from '@/components/offers/ChainOfferView'
import OfferCardRail from '@/components/discover/OfferCardRail'
import { useOffers } from '@/lib/offers/useOffers'
import { isRaayonitMultiChain } from '@/lib/offers/multiChainNote'
import { isOfferAvailable } from '@/lib/firebase/offers'

const DATE_LOCALE: Record<Lang, string> = {
  en: 'en-US',
  ru: 'ru-RU',
  es: 'es-ES',
  fr: 'fr-FR',
  he: 'he-IL',
}

export default function OfferDetailPage() {
  const { t, lang } = useLang()
  const { offerId } = useParams<{ offerId: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { isWishlisted, toggleWishlist } = useWishlist()
  // The heart pops only when the member saves it here, not on load.
  const [heartPop, setHeartPop] = useState(false)

  const [offer, setOffer] = useState<OfferDocument | null | undefined>(undefined)
  const [alreadyClaimed, setAlreadyClaimed] = useState<boolean | null>(null)
  // A multi-denomination offer: the value picked (a pool id), and the stocks the member already owns.
  const [pickedPool, setPickedPool] = useState('')
  const [claimedPools, setClaimedPools] = useState<string[]>([])
  // Read once per mount, since render must stay pure.
  const [now] = useState(Date.now)
  // A showcase card links here with its value (?denomination=150): that value starts out picked.
  useEffect(() => {
    if (!offer?.variants?.length) return
    const wanted = variantForDenomination(offer.variants, new URLSearchParams(window.location.search).get('denomination'))
    if (wanted) setPickedPool((current) => current || wanted.poolId)
  }, [offer])

  useEffect(() => {
    let cancelled = false
    getOffer(offerId).then((result) => {
      if (!cancelled) setOffer(result)
    })
    return () => { cancelled = true }
  }, [offerId])

  // The Raayonit Card has no offer page of its own: it is bought from /raayonit (and Home) in one click. An old link lands there, with its
  // ?denomination= pick kept.
  const flagshipHere = !!offer && isFlagship(offer)
  useEffect(() => {
    if (flagshipHere) router.replace(`/raayonit${window.location.search}`)
  }, [flagshipHere, router])

  useEffect(() => {
    if (!user) {
      setAlreadyClaimed(null)
      return
    }
    // Unverified customers cannot own a readable voucher or initiate payment.
    if (!user.emailVerified) {
      setAlreadyClaimed(false)
      return
    }
    let cancelled = false
    // A voucher from before variants belongs to the offer's default (first, cheapest) stock.
    getClaimedPoolIds(user.uid, offerId, offer?.variants?.[0]?.poolId ?? null).then((claimed) => {
      if (cancelled) return
      setAlreadyClaimed(claimed.any)
      setClaimedPools(claimed.pools)
    })
    return () => { cancelled = true }
  }, [user, offerId, offer?.variants])

  // Before the early returns below: hooks run on every render.
  const content = useLocalizedContent(offerTextSources(offer), offer?.translations, lang)
  // The business name has its own translations (and source language); one "Show original" switch flips both.
  const nameContent = useLocalizedContent({ businessName: offer?.businessName ?? '' }, offer?.businessTranslations, lang)
  const image = useDealImage(offer?.imageUrl ?? '', raayonitImageOpts(offer))
  // The brand tiles of a multi-chain pass: the offer's own index, else its chain names matched to the live brand offers, so a missing index never drops to plain text boxes.
  const chainSubject = useMemo(() => (offer ? { offerId: offer.id, perkScope: offer.perkScope, participatingChains: offer.participatingChains, allLiveBrands: true } : null), [offer])
  const liveBrands = useChainBrands(chainSubject)
  const chainBrands = offer?.brandIndex?.length ? offer.brandIndex : liveBrands
  // The hero stretches when the page is pulled down past the top (iOS rubber-band) and trails the scroll a little going up.
  // Only on a phone (the picture is a pane from 600px) and never under Reduce Motion; Chrome and Firefox have no overscroll offset, so they only trail.
  const heroRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pane = window.matchMedia('(min-width: 600px)')
    let frame = 0
    const apply = () => {
      frame = 0
      if (still.matches || pane.matches) { el.style.transform = ''; return }
      const y = window.scrollY
      const h = el.offsetHeight || 1
      if (y < 0) { el.style.transformOrigin = 'bottom'; el.style.transform = `scale(${1 + Math.min(-y, h) / h})` }
      else { el.style.transformOrigin = ''; el.style.transform = y > 0 ? `translate3d(0, ${Math.round(y * 0.35)}px, 0)` : '' }
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(apply) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame); el.style.transform = '' }
  }, [offer])
  const { offers: allOffers } = useOffers()
  // "See the chains": opens and scrolls to the chains fold (the fold remounts open).
  const [chainsOpen, setChainsOpen] = useState(false)
  const seeChains = () => {
    setChainsOpen(true)
    requestAnimationFrame(() => document.getElementById('perk-chains')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }))
  }

  if (offer === undefined) {
    return (
      <>
        <Navbar />
        <div className="below-header member-canvas" />
      </>
    )
  }

  if (offer === null) {
    return (
      <>
        <Navbar />
        <div className="below-header member-canvas">
          <div className="max-w-lg mx-auto px-5 sm:px-6 py-16">
            <div className="dash-empty-state bg-white border border-slate-100 rounded-2xl">
              <Tags aria-hidden="true" strokeWidth={1.75} />
              <div className="font-bold text-ink text-base mb-1">{t('offer_detail_not_found_title')}</div>
              <p className="text-sm text-body max-w-xs mb-5">{t('offer_detail_not_found_sub')}</p>
              <Link href="/categories" className="ds-btn ds-btn-primary">
                <span>{t('offer_detail_back')}</span>
              </Link>
            </div>
          </div>
        </div>
      </>
    )
  }

  // A participating chain is not a voucher for one store: its own page sends the visitor to the Raayonit Card.
  if (isChain(offer)) return <ChainOfferView offer={offer} hint={<OpenInAppHint className="mb-3" />} />
  // Handed on to /raayonit above; nothing to draw meanwhile.
  if (isFlagship(offer)) return null

  const remaining = offer.totalQuantity !== null ? Math.max(offer.totalQuantity - offer.claimedCount, 0) : null
  const formattedExpiry = offer.expiryDate
    ? new Intl.DateTimeFormat(DATE_LOCALE[lang], { year: 'numeric', month: 'long', day: 'numeric' }).format(offer.expiryDate)
    : null

  const claimLoading = !!user && alreadyClaimed === null
  const title = content.text('title')
  const description = content.text('description')
  const descriptionText = distinctDescription(title.text, description.text)
  const instructions = content.text('redemptionInstructions')
  const terms = content.text('redemptionTerms')
  const businessName = nameContent.text('businessName')
  const headline = superTavHeadline(offer, t('super_tav_headline'))
  const chainPage = isChain(offer)
  const hero = offer ? logoOnlyHero(offer) : null
  const heroLogo = hero ? { src: hero.kind === 'issuer' ? RAAYONIT_LOGO_PATH : hero.logoUrl, alt: businessName.text, small: hero.kind === 'brand' ? hero.fallback : hero.small } : null
  // Only a single-location perk shows its address and navigation; a multi-branch one shows a notice instead.
  const showLocation = shouldShowLocationNavigation(offer)
  const address = showLocation ? offerFullAddress(offer, lang) : ''
  const machine = content.machine || nameContent.machine
  const showingOriginal = content.showingOriginal || nameContent.showingOriginal
  const toggleOriginal = () => {
    content.toggleOriginal()
    nameContent.toggleOriginal()
  }
  // Multi-denomination: the picked value, else the first one not already owned; the price, saving and checkout follow it.
  const variants = offer.variants ?? []
  const multi = variants.length > 1
  const freeVariants = variants.filter((v) => !claimedPools.includes(v.poolId))
  const selected = variants.length > 0 ? (freeVariants.find((v) => v.poolId === pickedPool) ?? freeVariants[0] ?? variants[0]) : undefined
  const price = selected ? selected.priceAgorot / 100 : offer.offerPrice
  const original = selected ? selected.faceValueAgorot / 100 : offer.originalPrice
  const everyValueOwned = variants.length > 0 && freeVariants.length === 0
  const claimedHere = variants.length > 0 ? everyValueOwned : alreadyClaimed
  const checkoutHref = `/checkout?offerId=${encodeURIComponent(offer.id)}${selected ? `&variant=${encodeURIComponent(selected.poolId)}` : ''}`
  const discount = selected ? variantDiscountPercent(selected) : getOfferDiscountPercent(offer.originalPrice, offer.offerPrice)
  const expired = !!offer.expiryDate && offer.expiryDate.getTime() < now
  const saved = isWishlisted(offer.id)
  const guest = !user && !authLoading
  // Other perks in the same category, never this one or a sold-out one. The brand's own are one tap away on its brand page.
  const moreInCategory = (() => {
    // A category is a GoLandly notion: a Raayonit voucher or chain has no "more in category", and a direct perk never lists Raayonit's.
    if (!allOffers || offer.fulfillmentType === 'raayonit_pool') return []
    return landlyOffers(allOffers).filter((o) => o.id !== offer.id && isOfferAvailable(o) && o.category === offer.category).slice(0, 12)
  })()
  const brandOffer = isPooled(offer.fulfillmentType) && offer.perkScope !== 'multi_chain'
  const noticeKind = locationNoticeKind(offer)
  // The stores or chains that honour the perk, when the admin listed any.
  // One venue: its address in the header and its own location section, never "1 store".
  const singleVenue = isSingleVenue(offer)
  const venueLine = singleVenue ? offerFullAddress(offer, lang) : ''
  const hasStoreList = noticeKind === 'chains' || noticeKind === 'stores' || (offer.perkScope === 'multi_chain' && chainBrands.length > 0) || (singleVenue && !!offer.branches?.length)

  return (
    <>
      <Navbar />
      <div className="member-canvas below-header">
        <div className={`mx-auto w-full max-w-2xl fold:max-w-6xl ${chainPage ? 'lg:max-w-5xl' : 'lg:max-w-[1520px]'} pb-[env(safe-area-inset-bottom)] fold:px-6 fold:pb-12 lg:px-10`}>
          <OpenInAppHint className="mx-4 my-3 fold:mx-0 fold:mt-0" />
          {/* The persistent search row, where it sits on every other page. Not on phones: there the photo runs under the navbar with the back button on it. */}
          <div className="hidden fold:block fold:pt-8 sm:pt-10 lg:pt-12">
            <GlobalPerkSearchRow />
          </div>
          {/* Back names where it returns (Home, Discover, Wishlist); opened directly it says "Back" and goes Home (members) or to Discover (guests). */}
          <div className="hidden fold:block">
            <BackButton fallback={user ? '/' : '/categories'} contextLabel className="mb-4" />
          </div>

          {/* On phones the picture runs edge to edge under the navbar, with the
              back button on it, and the content rises over its foot as a white
              sheet; the logo floats on that edge, above the sheet (the sticky
              wrapper only makes a stacking context from 600px). The same 16:9
              picture as the perk cards (DealMedia.tsx): a photo fills it, anything
              else leaves it to the category's panel and a logo goes to the badge.
              From 600px (an unfolded foldable, a tablet, desktop;
              lib/layout/foldable.ts) there is no card at all: the photo and the
              details stand on the canvas side by side, in the reading direction,
              the photo staying in view while the details scroll, two equal panes
              either side of a fold and about 650px of photo from 1024px. Nothing
              here clips, which would stop the purchase bar from sticking. */}
          <article className="bg-white fold:bg-transparent">
            <div className="fold:grid fold:grid-cols-2 fold:items-start fold:gap-x-8 lg:grid-cols-12 lg:gap-x-10">
              <div ref={heroRef} className="relative will-change-transform fold:sticky fold:top-[calc(var(--header-offset)+1rem)] fold:row-span-3 lg:col-span-6 fold:rounded-2xl fold:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                <DealMedia src={offer.imageUrl} image={image} alt={title.text} category={offer.category} logo={heroLogo} aspect="aspect-video lg:aspect-[16/10] lg:min-h-[380px]" containAspect="aspect-[4/5] max-h-[380px] lg:aspect-auto lg:h-[480px] lg:max-h-[480px] lg:min-h-0" className="rounded-[inherit]">
                  <BackButton fallback={user ? '/' : '/categories'} contextLabel variant="glass" className="absolute start-1.5 top-1.5 fold:hidden" />
                  {/* The photo isn't clipped from 600px (the shadow, the sticky pane), so the ribbon rounds that corner itself. */}
                  <DiscountBadge percent={discount} className="fold:rounded-se-2xl" />
                  {user && (
                    // At the picture's foot, clear of the ribbon and of the sheet rising over it on a phone.
                    // A 42px frosted-glass circle in a 48px tap target: the picture
                    // blurs through it, a white rim and a soft shadow lift it. An ink
                    // outline heart until saved, then a solid red one that pops.
                    <button
                      type="button"
                      onClick={() => {
                        setHeartPop(!saved)
                        toggleWishlist(offer.id)
                      }}
                      aria-pressed={saved}
                      aria-label={saved ? t('btn_remove_from_wishlist') : t('btn_add_to_wishlist')}
                      className="group/heart absolute bottom-6 end-1.5 fold:bottom-1.5 flex h-12 w-12 items-center justify-center rounded-full [-webkit-tap-highlight-color:transparent] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand"
                    >
                      <span className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-white/60 bg-white/80 shadow-[0_3px_10px_rgba(15,23,42,0.16)] backdrop-blur-md backdrop-saturate-150 transition-transform duration-200 ease-[cubic-bezier(.34,1.56,.64,1)] group-active/heart:scale-90 motion-reduce:transition-none motion-reduce:group-active/heart:scale-100">
                        <Heart
                          key={saved ? 'saved' : 'unsaved'}
                          aria-hidden="true"
                          className={`h-5 w-5 ${saved ? `fill-current text-red-500 ${heartPop ? 'heart-pop' : ''}` : 'text-ink'}`}
                          strokeWidth={2}
                        />
                      </span>
                    </button>
                  )}
                </DealMedia>
                {!heroLogo && !isRaayonitOffer(offer) && <div className="absolute -bottom-2 start-5 z-20 fold:bottom-4 fold:start-4">
                  <MerchantBadge size="lg" logoUrl={badgeLogoUri(offer.businessLogoUrl ?? '', offer.imageUrl, image.role) ?? ''} />
                </div>}
              </div>

              {/* From 1024px the details are one elevated card beside the photo; below that the wrapper dissolves (contents) and the blocks sit as before. */}
              <div className="contents fold:block fold:col-start-2 lg:col-start-7 lg:col-span-6 lg:rounded-2xl lg:border lg:border-slate-200/80 lg:bg-white lg:p-8 lg:shadow-sm">
              {/* Its shadow falls upward only: below the sheet the page runs on in white. */}
              <div className="relative z-10 -mt-5 rounded-t-3xl bg-white px-5 pb-6 pt-11 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] sm:px-8 fold:col-start-2 fold:mt-0 fold:rounded-none fold:bg-transparent fold:px-0 lg:px-0 fold:pb-5 fold:pt-0 fold:shadow-none">
                {isFlagship(offer) ? <FlagshipEyebrow className="mb-2" /> : <OfferTags category={offer.category} method={offer.redemptionMethod} modes={offer.redemptionModes} className="mb-2" />}
                {/* The deal is the page's heading; the logo already carries the brand, named above it. */}
                {/* <bdi>: a Latin name keeps its letters in order yet stays on the page's side in Hebrew. */}
                {/* A Super Tav leads with its value ("Super Tav — ₪100 Value"), the business on the line below; any other perk keeps business then deal. */}
                {chainPage ? (
                  <>
                    {/* A participating chain's page is the chain's: its name is the heading, with the note that it honours Super Tav. */}
                    <h1 className="break-words text-2xl font-black leading-tight tracking-tight text-ink sm:text-3xl"><bdi lang={businessName.lang ?? undefined} dir="auto">{businessName.text}</bdi></h1>
                    <p className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand"><Ticket aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />{t('raayonit_honors_badge')}</p>
                  </>
                ) : headline ? (
                  <>
                    <h1 className="break-words text-2xl font-black leading-tight tracking-tight text-ink tabular-nums sm:text-3xl"><bdi dir="auto">{headline}</bdi></h1>
                    <p className="mt-1 break-words text-base font-bold leading-snug text-body lg:font-semibold lg:text-slate-500">
                      <bdi lang={businessName.lang ?? undefined} dir="auto">{businessName.text}</bdi>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="break-words text-base font-bold leading-snug text-body lg:font-semibold lg:text-slate-500">
                      <bdi lang={businessName.lang ?? undefined} dir="auto">{businessName.text}</bdi>
                    </p>
                    <h1 className="mt-1 break-words text-2xl font-black leading-tight tracking-tight text-ink sm:text-3xl">
                      <bdi lang={title.lang ?? undefined} dir="auto">{title.text}</bdi>
                    </h1>
                  </>
                )}

                {/* Prices in <bdi>, in the body font with their "₪" (app/layout.tsx loads its subset). */}
                {chainPage && !!headline && <p className="mt-5 text-sm font-bold text-ink tabular-nums"><bdi dir="auto">{headline}</bdi></p>}
                {multi && <VariantSelector variants={variants} value={selected?.poolId ?? ''} onChange={setPickedPool} claimed={claimedPools} />}
                <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-2 lg:rounded-xl lg:bg-slate-50/90 lg:p-4">
                  <bdi className="text-price-lg tabular-nums text-brand">{formatPrice(price)}</bdi>
                  {discount > 0 && (
                    <bdi className="text-price-was sm:text-base tabular-nums text-slate-400 line-through decoration-slate-400/70">{formatPrice(original)}</bdi>
                  )}
                  {discount > 0 && (
                    <span className="whitespace-nowrap text-sm font-semibold text-emerald-700 lg:rounded-full lg:bg-emerald-50 lg:px-3 lg:py-1">{t('offer_you_save').replace('{amount}', formatPrice(original - price))}</span>
                  )}
                </div>

                {/* A Raayonit voucher: who issued it, and that it is a code (no QR) valid 5 years. Right under the title and price. */}
                {isPooled(offer.fulfillmentType) && <IssuerAttribution issuer={RAAYONIT_ISSUER} lang={lang} note={t('offer_code_only_info')} className="mt-6" />}
                {/* Bought through one brand, it is still a Multi-Chain Super Tav: also redeemable across the network. */}
                {brandOffer && <MultiChainBonus className="mt-4" onSeeChains={seeChains} />}

                {/* When it stops working: five years from purchase for a Raayonit voucher, else the offer's own date. */}
                {(isPooled(offer.fulfillmentType) || formattedExpiry) && (
                  <p className={`mt-5 flex items-center gap-2 text-sm font-semibold ${expired ? 'text-red-700' : 'text-body'}`}>
                    <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    <span>{isPooled(offer.fulfillmentType) ? t('card_valid_5_years') : t('offer_detail_expires').replace('{date}', formattedExpiry!)}</span>
                  </p>
                )}

                {/* Signed out: the way in, as a plain divider row with the action at its end. */}
                {guest && (
                  <div className="mt-5 flex items-center justify-between gap-3 border-y border-slate-100 py-3">
                    <p className="min-w-0 text-[13px] leading-[19px] text-body">{t('offer_login_prompt')}</p>
                    <Link href={`/login?redirect=${encodeURIComponent(`/offers/${offer.id}`)}`} className="tap-target inline-flex shrink-0 items-center text-sm font-extrabold text-ink underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{t('offer_login_action')}</Link>
                  </div>
                )}

                {/* Only what the offer really states. */}
                <div className="mt-5 flex flex-wrap items-center gap-2 empty:hidden">
                  {!!offer.kosherBranchCount && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold leading-4 text-body">{t('offer_kosher_branches').split('{count}').flatMap((part, i) => (i === 0 ? [part] : [<bdi key={i} dir="ltr">{offer.kosherBranchCount}</bdi>, part]))}</span>
                  )}
                  {remaining !== null && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold leading-4 text-body">
                      <Ticket aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                      <span>{t('offer_detail_remaining').replace('{count}', String(remaining))}</span>
                    </span>
                  )}
                </div>

                <RedemptionCallout className="mt-5" method={offer.redemptionMethod} instructions={instructions.text} instructionsLang={instructions.lang} />

                {machine && (
                  <TranslationNotice className="mt-3" showingOriginal={showingOriginal} onToggle={toggleOriginal} />
                )}

                {/* The header's last row, right above the folds: the address, with the ways to get there at its end. */}
                <div className="mt-5 flex flex-wrap items-center gap-3 empty:hidden lg:mt-6">
                  {!showLocation && locationNoticeKind(offer) !== null && (
                    <PerkReachLine offer={offer} className="flex-1 text-sm text-muted" />
                  )}
                  {singleVenue && !showLocation && !!venueLine && !hasStoreList && (
                    <p className="flex min-w-0 flex-1 items-start gap-1.5 text-sm text-muted">
                      <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                      <span className="min-w-0 break-words" dir="auto">{venueLine}</span>
                    </p>
                  )}
                  {showLocation && address && !hasStoreList && (
                    <p className="flex min-w-0 flex-1 items-start gap-1.5 text-sm text-muted">
                      <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                      {/* The full address as Google writes it in the reader's language. */}
                      <span className="min-w-0 break-words" dir="auto">{address}</span>
                    </p>
                  )}
                  {/* A multi-branch perk has no single store to navigate to; a multi-chain voucher lists its chains below. */}
                  {showLocation && <NavigationLinks
                    className="ms-auto lg:hidden"
                    destination={{ geo: offer.geo, placeId: offer.address?.placeId, address: address || offer.location }}
                  />}
                  {/* From 1024px the two ways to get there are labelled buttons, side by side under the address. */}
                  {showLocation && (
                    <div className="hidden lg:block lg:basis-full">
                      <NavigationLinks wide destination={{ geo: offer.geo, placeId: offer.address?.placeId, address: address || offer.location }} />
                    </div>
                  )}
                </div>
                {/* A Raayonit voucher: who issued it, and that it is a code (no QR) valid 5 years. */}
              </div>

              {/* The folds. Everyone reads what the perk is, when that says more
                  than the title; members also get How to redeem and the fine
                  print, guests the locked card in their place, with their way in
                  and no purchase bar. Neither while auth is still being read, so a
                  guest never sees the steps flash in first. Codes live only on the
                  member's own voucher pages. */}
              {(descriptionText || user || hasStoreList) && (
                <div className="border-t border-slate-100 px-5 py-1 sm:px-8 fold:col-start-2 fold:border-slate-200/80 fold:px-0 lg:px-0">
                  <RaayonitChainNotes offer={offer} className="py-4" />
                  <div className="divide-y divide-slate-100 fold:divide-slate-200/80">
                    {hasStoreList && (
                      <Fold title={t(noticeKind === 'chains' ? 'perk_chains_title' : singleVenue ? 'perk_business_location' : 'perk_stores_title')} defaultOpen>
                        {offer.perkScope === 'multi_chain' && chainBrands.length > 0 ? (
                          <div className="space-y-4"><BrandStrip entries={chainBrands} /><RedemptionGuide offer={offer} /></div>
                        ) : !!offer.branches?.length ? (
                          <BranchStrip branches={offer.branches} brand={offer.brandName || offer.businessName || null} />
                        ) : (
                          <ParticipatingChains offer={offer} />
                        )}
                      </Fold>
                    )}
                    {descriptionText && (
                      <Fold title={t('offer_about_title')} defaultOpen>
                        <p className="whitespace-pre-line text-copy leading-relaxed text-body lg:text-base lg:text-slate-700" lang={description.lang ?? undefined} dir="auto">{descriptionText}</p>
                      </Fold>
                    )}
                    {brandOffer && <ChainsFold key={chainsOpen ? 'open' : 'closed'} id="perk-chains" defaultOpen={chainsOpen} />}
                    {user && (
                      <HowToRedeem
                        method={offer.redemptionMethod}
                        instructions={instructions.text}
                        instructionsLang={instructions.lang}
                        terms={terms.text}
                        termsLang={terms.lang}
                        includePurchaseStep={!alreadyClaimed}
                        codeOnly={isPooled(offer.fulfillmentType)}
                        variant="accordion"
                      />
                    )}
                  </div>
                </div>
              )}
              {/* The category rail between two hairline dividers (1px, 24px of air each side), then the business's own card. */}
              {moreInCategory.length > 0 && (
                <div className="mx-5 border-y border-[#E2E8F0] py-6 sm:mx-8 fold:col-start-2 fold:mx-0 lg:mx-0" data-testid="offer-category-rail">
                  <OfferCardRail nested id="offer-more-in-category" title={t('offer_more_in_category')} offers={moreInCategory} href={`/categories?cat=${encodeURIComponent(offer.category)}`} seeAll={t('perk_see_all_perks')} />
                </div>
              )}
              <div className="px-5 pb-6 pt-6 empty:hidden sm:px-8 fold:col-start-2 fold:px-0 lg:px-0">
                <BrandSpotlight offer={offer} image={image} alt={title.text} />
              </div>
              {guest && (
                <div className="border-t border-slate-100 px-5 py-6 sm:px-8 fold:col-start-2 fold:border-0 fold:px-0 lg:px-0 fold:pb-0 fold:pt-4">
                  <OfferMemberGate offerId={offer.id} />
                </div>
              )}

              {/* The last row. On phones it sticks to the bottom of the screen,
                  above the home indicator, while the offer is in view; floating buttons
                  (the WhatsApp widget) rise above it there (data-floating-clearance). */}
              {!guest && (
                <div data-floating-clearance="" className="sticky bottom-0 z-10 border-t border-slate-100 bg-white/95 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:px-8 fold:static fold:col-start-2 fold:border-0 fold:bg-transparent fold:px-0 lg:px-0 fold:pb-0 fold:pt-5 fold:backdrop-blur-none">
                  {(authLoading || claimLoading) && (
                    <div role="status" className="ds-btn ds-btn-primary w-full opacity-60 pointer-events-none">
                      <span aria-hidden="true">…</span>
                      <span className="sr-only">{t('bizdash_loading')}</span>
                    </div>
                  )}

                  {user && !authLoading && !claimLoading && claimedHere && (
                    <div className="flex items-start gap-3 rounded-2xl bg-canvas p-4">
                      <IconFrame icon={CircleCheck} size="sm" tone="success" />
                      <div>
                        <div className="mb-1 text-sm font-bold text-ink">{t('offer_already_claimed_title')}</div>
                        <p className="mb-2 text-sm text-body">{t('offer_already_claimed_sub')}</p>
                        <Link href="/member" className="text-sm font-bold text-brand hover:underline">{t('offer_already_claimed_link')}</Link>
                      </div>
                    </div>
                  )}

                  {user && !authLoading && !claimLoading && !claimedHere && offer.comingSoon && (
                    // No live payment gateway: the perk stays visible, the purchase waits (never a dead-end checkout).
                    <div className="space-y-3">
                      <ComingSoonNotice generic compact />
                      <button type="button" disabled className="ds-btn ds-btn-primary ds-btn-wrap w-full cursor-not-allowed opacity-50 lg:h-[52px] lg:rounded-xl lg:text-base lg:font-bold">
                        <span>{t('perk_purchase_soon_cta')}</span>
                      </button>
                    </div>
                  )}

                  {user && !authLoading && !claimLoading && !claimedHere && !offer.comingSoon && (expired ? (
                    // Gone past its date: the button stays in place, unusable, as in the app.
                    <button type="button" disabled className="ds-btn ds-btn-primary ds-btn-wrap w-full lg:h-[52px] lg:rounded-xl lg:text-base lg:font-bold">
                      <span>{t('offer_buy_button').replace('{price}', formatPrice(price))}</span>
                    </button>
                  ) : (
                    // A full page load, not a client-side Link: the accessibility widget
                    // script this page ran must not carry over beside the payment iframe.
                    <a href={checkoutHref} className="ds-btn ds-btn-primary ds-btn-wrap w-full lg:h-[52px] lg:rounded-xl lg:text-base lg:font-bold">
                      <span>{t('offer_buy_button').replace('{price}', formatPrice(price))}</span>
                    </a>
                  ))}
                </div>
              )}
              </div>
            </div>
          </article>
        </div>
      </div>
    </>
  )
}
