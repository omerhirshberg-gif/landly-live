'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CircleCheck, Clock, Heart, MapPin, Tags, Ticket } from 'lucide-react'
import { useParams } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import { useLang } from '@/lib/i18n/useLang'
import { Lang } from '@/lib/i18n/translations'
import { useAuth } from '@/lib/firebase/useAuth'
import { useWishlist } from '@/lib/firebase/useWishlist'
import { hasUserClaimedOffer } from '@/lib/firebase/vouchers'
import { getOffer, getOfferDiscountPercent, OfferDocument } from '@/lib/firebase/offers'
import { formatPrice } from '@/lib/format'
import DealMedia from '@/components/discover/DealMedia'
import { useDealImage } from '@/components/discover/useDealImage'
import MerchantBadge from '@/components/discover/MerchantBadge'
import OfferTags from '@/components/discover/OfferTags'
import DiscountBadge from '@/components/discover/DiscountBadge'
import HowToRedeem, { Fold } from '@/components/offers/HowToRedeem'
import OfferMemberGate from '@/components/offers/OfferMemberGate'
import BackButton from '@/components/navigation/BackButton'
import OpenInAppHint from '@/components/layout/OpenInAppHint'
import TranslationNotice from '@/components/ui/TranslationNotice'
import IconFrame from '@/components/ui/IconFrame'
import { useLocalizedContent } from '@/lib/i18n/useLocalizedContent'
import { badgeLogoUri } from '@/lib/offers/dealImage'
import { distinctDescription, offerTextSources } from '@/lib/offers/offerText'
import { offerFullAddress } from '@/lib/geo'
import NavigationLinks from '@/components/offers/NavigationLinks'

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
  const { user, loading: authLoading } = useAuth()
  const { isWishlisted, toggleWishlist } = useWishlist()
  // The heart pops only when the member saves it here, not on load.
  const [heartPop, setHeartPop] = useState(false)

  const [offer, setOffer] = useState<OfferDocument | null | undefined>(undefined)
  const [alreadyClaimed, setAlreadyClaimed] = useState<boolean | null>(null)
  // Read once per mount, since render must stay pure.
  const [now] = useState(Date.now)

  useEffect(() => {
    let cancelled = false
    getOffer(offerId).then((result) => {
      if (!cancelled) setOffer(result)
    })
    return () => { cancelled = true }
  }, [offerId])

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
    hasUserClaimedOffer(user.uid, offerId).then((claimed) => {
      if (!cancelled) setAlreadyClaimed(claimed)
    })
    return () => { cancelled = true }
  }, [user, offerId])

  // Before the early returns below: hooks run on every render.
  const content = useLocalizedContent(offerTextSources(offer), offer?.translations, lang)
  // The business name has its own translations (and source language); one "Show original" switch flips both.
  const nameContent = useLocalizedContent({ businessName: offer?.businessName ?? '' }, offer?.businessTranslations, lang)
  const image = useDealImage(offer?.imageUrl ?? '')

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
  const address = offerFullAddress(offer, lang)
  const machine = content.machine || nameContent.machine
  const showingOriginal = content.showingOriginal || nameContent.showingOriginal
  const toggleOriginal = () => {
    content.toggleOriginal()
    nameContent.toggleOriginal()
  }
  const discount = getOfferDiscountPercent(offer.originalPrice, offer.offerPrice)
  const expired = !!offer.expiryDate && offer.expiryDate.getTime() < now
  const saved = isWishlisted(offer.id)
  const guest = !user && !authLoading

  return (
    <>
      <Navbar />
      <div className="member-canvas below-header">
        <div className="mx-auto max-w-2xl fold:max-w-6xl pb-[env(safe-area-inset-bottom)] fold:px-6 fold:pt-8 fold:pb-12">
          <OpenInAppHint className="mx-4 my-3 fold:mx-0 fold:mt-0" />
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
            <div className="fold:grid fold:grid-cols-2 fold:items-start fold:gap-x-8 lg:grid-cols-[1.6fr_1fr] lg:gap-x-10">
              <div className="relative fold:sticky fold:top-[calc(var(--header-offset)+1rem)] fold:row-span-3 fold:rounded-2xl fold:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                <DealMedia src={offer.imageUrl} image={image} alt={title.text} category={offer.category} className="rounded-[inherit]">
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
                <div className="absolute -bottom-2 start-5 z-20 fold:bottom-4 fold:start-4">
                  <MerchantBadge size="lg" logoUrl={badgeLogoUri(offer.businessLogoUrl ?? '', offer.imageUrl, image.role) ?? ''} businessName={businessName.text} />
                </div>
              </div>

              {/* Its shadow falls upward only: below the sheet the page runs on in white. */}
              <div className="relative z-10 -mt-5 rounded-t-3xl bg-white px-5 pb-6 pt-11 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] sm:px-8 fold:col-start-2 fold:mt-0 fold:rounded-none fold:bg-transparent fold:px-0 fold:pb-5 fold:pt-0 fold:shadow-none">
                <OfferTags category={offer.category} method={offer.redemptionMethod} className="mb-2" />
                {/* The deal is the page's heading; the logo already carries the brand, named above it. */}
                {/* <bdi>: a Latin name keeps its letters in order yet stays on the page's side in Hebrew. */}
                <p className="break-words text-base font-bold leading-snug text-body">
                  <bdi lang={businessName.lang ?? undefined} dir="auto">{businessName.text}</bdi>
                </p>
                <h1 className="mt-1 break-words text-2xl font-black leading-tight tracking-tight text-ink sm:text-3xl">
                  <bdi lang={title.lang ?? undefined} dir="auto">{title.text}</bdi>
                </h1>

                {/* Prices in <bdi>, in the body font with their "₪" (app/layout.tsx loads its subset). */}
                <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-2">
                  <bdi className="text-price-lg tabular-nums text-brand">{formatPrice(offer.offerPrice)}</bdi>
                  {discount > 0 && (
                    <bdi className="text-price-was sm:text-base tabular-nums text-slate-400 line-through decoration-slate-400/70">{formatPrice(offer.originalPrice)}</bdi>
                  )}
                  {discount > 0 && (
                    <span className="whitespace-nowrap text-sm font-semibold text-emerald-700">{t('offer_you_save').replace('{amount}', formatPrice(offer.originalPrice - offer.offerPrice))}</span>
                  )}
                </div>

                {/* Only what the offer really states. */}
                <div className="mt-4 flex flex-wrap items-center gap-2 empty:hidden">
                  {formattedExpiry && (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold leading-4 ${expired ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-body'}`}>
                      <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                      <span>{t('offer_detail_expires').replace('{date}', formattedExpiry)}</span>
                    </span>
                  )}
                  {remaining !== null && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold leading-4 text-body">
                      <Ticket aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                      <span>{t('offer_detail_remaining').replace('{count}', String(remaining))}</span>
                    </span>
                  )}
                </div>

                {machine && (
                  <TranslationNotice className="mt-3" showingOriginal={showingOriginal} onToggle={toggleOriginal} />
                )}

                {/* The header's last row, right above the folds: the address, with the ways to get there at its end. */}
                <div className="mt-4 flex items-center gap-3 empty:hidden">
                  {address && (
                    <p className="flex min-w-0 flex-1 items-start gap-1.5 text-sm text-muted">
                      <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                      {/* The full address as Google writes it in the reader's language. */}
                      <span className="min-w-0 break-words" dir="auto">{address}</span>
                    </p>
                  )}
                  <NavigationLinks
                    className="ms-auto"
                    destination={{ geo: offer.geo, placeId: offer.address?.placeId, address: address || offer.location }}
                  />
                </div>
              </div>

              {/* The folds. Everyone reads what the perk is, when that says more
                  than the title; members also get How to redeem and the fine
                  print, guests the locked card in their place, with their way in
                  and no purchase bar. Neither while auth is still being read, so a
                  guest never sees the steps flash in first. Codes live only on the
                  member's own voucher pages. */}
              {(descriptionText || user) && (
                <div className="border-t border-slate-100 px-5 py-1 sm:px-8 fold:col-start-2 fold:border-slate-200/80 fold:px-0">
                  <div className="divide-y divide-slate-100 fold:divide-slate-200/80">
                    {descriptionText && (
                      <Fold title={t('offer_about_title')} defaultOpen>
                        <p className="whitespace-pre-line text-copy leading-relaxed text-body" lang={description.lang ?? undefined} dir="auto">{descriptionText}</p>
                      </Fold>
                    )}
                    {user && (
                      <HowToRedeem
                        method={offer.redemptionMethod}
                        instructions={instructions.text}
                        instructionsLang={instructions.lang}
                        terms={terms.text}
                        termsLang={terms.lang}
                        includePurchaseStep={!alreadyClaimed}
                        variant="accordion"
                      />
                    )}
                  </div>
                </div>
              )}
              {guest && (
                <div className="border-t border-slate-100 px-5 py-6 sm:px-8 fold:col-start-2 fold:border-0 fold:px-0 fold:pb-0 fold:pt-4">
                  <OfferMemberGate offerId={offer.id} />
                </div>
              )}

              {/* The last row. On phones it sticks to the bottom of the screen,
                  above the home indicator, while the offer is in view; floating buttons
                  (the WhatsApp widget) rise above it there (data-floating-clearance). */}
              {!guest && (
                <div data-floating-clearance="" className="sticky bottom-0 z-10 border-t border-slate-100 bg-white/95 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:px-8 fold:static fold:col-start-2 fold:border-0 fold:bg-transparent fold:px-0 fold:pb-0 fold:pt-5 fold:backdrop-blur-none">
                  {(authLoading || claimLoading) && (
                    <div role="status" className="ds-btn ds-btn-primary w-full opacity-60 pointer-events-none">
                      <span aria-hidden="true">…</span>
                      <span className="sr-only">{t('bizdash_loading')}</span>
                    </div>
                  )}

                  {user && !authLoading && !claimLoading && alreadyClaimed && (
                    <div className="flex items-start gap-3 rounded-2xl bg-canvas p-4">
                      <IconFrame icon={CircleCheck} size="sm" tone="success" />
                      <div>
                        <div className="mb-1 text-sm font-bold text-ink">{t('offer_already_claimed_title')}</div>
                        <p className="mb-2 text-sm text-body">{t('offer_already_claimed_sub')}</p>
                        <Link href="/member" className="text-sm font-bold text-brand hover:underline">{t('offer_already_claimed_link')}</Link>
                      </div>
                    </div>
                  )}

                  {user && !authLoading && !claimLoading && !alreadyClaimed && (expired ? (
                    // Gone past its date: the button stays in place, unusable, as in the app.
                    <button type="button" disabled className="ds-btn ds-btn-primary ds-btn-wrap w-full">
                      <span>{t('offer_buy_button').replace('{price}', formatPrice(offer.offerPrice))}</span>
                    </button>
                  ) : (
                    // A full page load, not a client-side Link: the accessibility widget
                    // script this page ran must not carry over beside the payment iframe.
                    <a href={`/checkout?offerId=${encodeURIComponent(offer.id)}`} className="ds-btn ds-btn-primary ds-btn-wrap w-full">
                      <span>{t('offer_buy_button').replace('{price}', formatPrice(offer.offerPrice))}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </article>
        </div>
      </div>
    </>
  )
}
