'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import { useLang } from '@/lib/i18n/useLang'
import { Lang } from '@/lib/i18n/translations'
import { useAuth } from '@/lib/firebase/useAuth'
import { useWishlist } from '@/lib/firebase/useWishlist'
import { hasUserClaimedOffer } from '@/lib/firebase/vouchers'
import { getOffer, getOfferDiscountPercent, OfferDocument } from '@/lib/firebase/offers'
import { formatPrice } from '@/lib/format'
import { CATEGORY_TILES } from '@/lib/categories'
import PerkImage from '@/components/discover/PerkImage'
import RedemptionBadge from '@/components/discover/RedemptionBadge'
import DiscountBadge from '@/components/discover/DiscountBadge'
import HowToRedeem from '@/components/offers/HowToRedeem'
import OfferGuestTeaser from '@/components/offers/OfferGuestTeaser'
import OfferMemberGate from '@/components/offers/OfferMemberGate'
import BackButton from '@/components/navigation/BackButton'
import OpenInAppHint from '@/components/layout/OpenInAppHint'
import TranslationNotice from '@/components/ui/TranslationNotice'
import { useLocalizedContent } from '@/lib/i18n/useLocalizedContent'
import { offerTextSources } from '@/lib/offers/offerText'
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
              <i className="fa-solid fa-tags" aria-hidden="true"></i>
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
  const tile = CATEGORY_TILES.find((c) => c.category === offer.category)
  const saved = isWishlisted(offer.id)

  return (
    <>
      <Navbar />
      <div className="member-canvas below-header">
        <div className="mx-auto max-w-2xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pt-8 sm:pb-12">
          <OpenInAppHint className="mb-3" />
          {/* Back names where it returns (Home, Discover, Wishlist); opened directly it says "Back" and goes Home (members) or to Discover (guests). */}
          <BackButton fallback={user ? '/' : '/categories'} contextLabel className="mb-4" />

          {/* One surface: photo, details, how to redeem and the purchase button,
              split only by hairlines. No overflow-hidden here -- it would stop the
              purchase bar from sticking -- so the picture sits in its own snug
              framed box (light canvas, hairline border, 14px corners): a photo
              fills it, a logo sits whole inside with a little room. */}
          <article className="rounded-3xl border border-slate-200/80 bg-white shadow-sm">
            <div className="relative mx-3 mt-3 sm:mx-4 sm:mt-4 h-[180px] sm:h-[220px] overflow-hidden rounded-[14px] border border-[#E2E8F0] bg-[#F8FAFC]">
              <PerkImage src={offer.imageUrl} alt={title.text} category={offer.category} businessName={businessName.text} size="hero" />
              {user && (
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
                  className="group/heart absolute top-1.5 end-1.5 flex h-12 w-12 items-center justify-center rounded-full [-webkit-tap-highlight-color:transparent] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand"
                >
                  <span className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-white/60 bg-white/80 shadow-[0_3px_10px_rgba(15,23,42,0.16)] backdrop-blur-md backdrop-saturate-150 transition-transform duration-200 ease-[cubic-bezier(.34,1.56,.64,1)] group-active/heart:scale-90 motion-reduce:transition-none motion-reduce:group-active/heart:scale-100">
                    <i
                      key={saved ? 'saved' : 'unsaved'}
                      className={`${saved ? `fa-solid text-[#EF4444] ${heartPop ? 'heart-pop' : ''}` : 'fa-regular text-[#0B1B3D]'} fa-heart text-[18px]`}
                      aria-hidden="true"
                    ></i>
                  </span>
                </button>
              )}
            </div>

            <div className="px-5 pb-6 pt-5 sm:px-8 sm:pb-8 sm:pt-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brandTint px-3 py-1.5 text-xs font-semibold text-brand">
                  {tile && <i className={`fa-solid ${tile.icon} text-[11px]`} aria-hidden="true"></i>}
                  {tile ? t(tile.labelKey) : <span dir="auto">{offer.category}</span>}
                </span>
                <RedemptionBadge method={offer.redemptionMethod} className="!py-1.5 !text-xs" />
              </div>

              {/* The business is the page's heading (what members search and
                  recognise); the offer reads as its subtitle. */}
              <h1 className="mt-4 text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl" lang={businessName.lang ?? undefined} dir="auto">
                {businessName.text}
              </h1>
              <p className="mt-2 text-lg font-semibold leading-snug text-body sm:text-xl" lang={title.lang ?? undefined} dir="auto">
                {title.text}
              </p>
              {address && (
                <p className="mt-2 flex items-start gap-1.5 text-sm text-[#94A3B8]">
                  <i className="fa-solid fa-location-dot mt-[3px] text-xs" aria-hidden="true"></i>
                  {/* The full address as Google writes it in the reader's language. */}
                  <span className="min-w-0 break-words" dir="auto">{address}</span>
                </p>
              )}
              <NavigationLinks
                className="mt-3"
                destination={{ geo: offer.geo, placeId: offer.address?.placeId, address: address || offer.location }}
              />

              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-3xl font-extrabold tracking-tight text-[#0038B8]" dir="ltr">{formatPrice(offer.offerPrice)}</span>
                {discount > 0 && (
                  <span className="text-lg text-[#94A3B8] line-through decoration-[#94A3B8]/70" dir="ltr">{formatPrice(offer.originalPrice)}</span>
                )}
                <DiscountBadge percent={discount} size="lg" />
              </div>

              {/* Guests get a short version; members the whole text. */}
              {description.text && (
                <p className={`mt-5 whitespace-pre-line text-[15px] leading-relaxed text-[#475569] ${user ? '' : 'line-clamp-4'}`} lang={description.lang ?? undefined} dir="auto">{description.text}</p>
              )}
              {machine && (
                <TranslationNotice className="mt-3" showingOriginal={showingOriginal} onToggle={toggleOriginal} />
              )}

              {(formattedExpiry || remaining !== null) && (
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
                  {formattedExpiry && (
                    <div className="flex items-center gap-2 text-xs font-medium text-[#475569]">
                      <i className="fa-regular fa-clock text-[#94A3B8]" aria-hidden="true"></i>
                      <span>{t('offer_detail_expires').replace('{date}', formattedExpiry)}</span>
                    </div>
                  )}
                  {remaining !== null && (
                    <div className="flex items-center gap-2 text-xs font-medium text-[#475569]">
                      <i className="fa-solid fa-ticket text-[#94A3B8]" aria-hidden="true"></i>
                      <span>{t('offer_detail_remaining').replace('{count}', String(remaining))}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Members get How to redeem (steps, counter instructions, terms);
                guests a teaser banner instead, its sign-in links in the bar
                below. Neither while auth is still being read, so a guest
                never sees the steps flash in first. Codes live only on the
                member's own voucher pages. */}
            {user ? (
              <div className="border-t border-slate-100 px-5 py-6 sm:px-8 sm:py-7">
                <HowToRedeem
                  method={offer.redemptionMethod}
                  instructions={instructions.text}
                  instructionsLang={instructions.lang}
                  terms={terms.text}
                  termsLang={terms.lang}
                  includePurchaseStep={!alreadyClaimed}
                  variant="section"
                />
              </div>
            ) : !authLoading && (
              <div className="border-t border-slate-100 px-5 pt-6 pb-2 sm:px-8 sm:pt-7 sm:pb-0">
                <OfferGuestTeaser />
              </div>
            )}

            {/* The card's last row. On phones it sticks to the bottom of the screen,
                above the home indicator, while the card is in view; floating buttons
                (the WhatsApp widget) rise above it there (data-floating-clearance). */}
            <div data-floating-clearance="" className="sticky bottom-0 z-10 rounded-b-3xl border-t border-slate-100 bg-white/95 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:static sm:px-8 sm:pb-8 sm:pt-6 sm:backdrop-blur-none">
              {/* Guests read everything above; buying and vouchers are for members. */}
              {!user && !authLoading && <OfferMemberGate offerId={offer.id} />}

              {(authLoading || claimLoading) && (
                <div role="status" className="ds-btn ds-btn-primary w-full opacity-60 pointer-events-none">
                  <span aria-hidden="true">…</span>
                  <span className="sr-only">{t('bizdash_loading')}</span>
                </div>
              )}

              {user && !authLoading && !claimLoading && alreadyClaimed && (
                <div className="flex items-start gap-3 rounded-2xl bg-canvas p-4">
                  <i className="fa-solid fa-circle-check mt-0.5 flex-shrink-0 text-lg text-emerald-600" aria-hidden="true"></i>
                  <div>
                    <div className="mb-1 text-sm font-bold text-[#0B1B3D]">{t('offer_already_claimed_title')}</div>
                    <p className="mb-2 text-sm text-[#475569]">{t('offer_already_claimed_sub')}</p>
                    <Link href="/member" className="text-sm font-bold text-brand hover:underline">{t('offer_already_claimed_link')}</Link>
                  </div>
                </div>
              )}

              {user && !authLoading && !claimLoading && !alreadyClaimed && (
                // A full page load, not a client-side Link: the accessibility widget
                // script this page ran must not carry over beside the payment iframe.
                <a href={`/checkout?offerId=${encodeURIComponent(offer.id)}`} className="ds-btn ds-btn-primary ds-btn-wrap w-full">
                  <span>{t('offer_buy_button').replace('{price}', formatPrice(offer.offerPrice))}</span>
                </a>
              )}
            </div>
          </article>
        </div>
      </div>
    </>
  )
}
