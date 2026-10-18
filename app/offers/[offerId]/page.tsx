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
import BackButton from '@/components/navigation/BackButton'
import OpenInAppHint from '@/components/layout/OpenInAppHint'

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

  if (offer === undefined) {
    return (
      <>
        <Navbar />
        <div className="pt-16 min-h-screen bg-slate-50" />
      </>
    )
  }

  if (offer === null) {
    return (
      <>
        <Navbar />
        <div className="pt-16 bg-slate-50 min-h-screen">
          <div className="max-w-lg mx-auto px-5 sm:px-6 py-16">
            <div className="dash-empty-state bg-white border border-slate-100 rounded-2xl">
              <i className="fa-solid fa-tags" aria-hidden="true"></i>
              <div className="font-bold text-slate-700 text-base mb-1">{t('offer_detail_not_found_title')}</div>
              <p className="text-sm text-slate-500 max-w-xs mb-5">{t('offer_detail_not_found_sub')}</p>
              <Link href="/categories" className="tap-target btn-primary">
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
  const discount = getOfferDiscountPercent(offer.originalPrice, offer.offerPrice)
  const tile = CATEGORY_TILES.find((c) => c.category === offer.category)
  const saved = isWishlisted(offer.id)

  return (
    <>
      <Navbar />
      <div className="min-h-dvh bg-[#F8FAFC] pt-16">
        <div className="mx-auto max-w-2xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pt-8 sm:pb-12">
          <OpenInAppHint className="mb-3" />
          <BackButton fallback={`/categories/${encodeURIComponent(offer.category)}`} label={t('offer_detail_back')} className="mb-4" />

          {/* One surface: photo, details, how to redeem and the purchase button,
              split only by hairlines. No overflow-hidden here -- it would stop the
              purchase bar from sticking -- so the photo rounds its own top corners. */}
          <article className="rounded-3xl border border-slate-200/80 bg-white shadow-sm">
            <div className="relative aspect-[16/10] overflow-hidden rounded-t-3xl bg-[#F0F7FF]">
              <PerkImage src={offer.imageUrl} alt={offer.title} category={offer.category} businessName={offer.businessName} size="hero" />
              {user && (
                <button
                  type="button"
                  onClick={() => toggleWishlist(offer.id)}
                  aria-pressed={saved}
                  aria-label={saved ? t('btn_remove_from_wishlist') : t('btn_add_to_wishlist')}
                  className={`absolute top-3 end-3 flex h-12 w-12 items-center justify-center rounded-full shadow-sm transition-colors ${saved ? 'bg-red-500 text-white' : 'bg-white/95 text-[#475569] [@media(hover:hover)]:hover:text-red-500'}`}
                >
                  <i className={`${saved ? 'fa-solid' : 'fa-regular'} fa-heart text-base`} aria-hidden="true"></i>
                </button>
              )}
            </div>

            <div className="px-5 pb-6 pt-5 sm:px-8 sm:pb-8 sm:pt-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] px-3 py-1.5 text-xs font-semibold text-blue-700">
                  {tile && <span aria-hidden="true">{tile.emoji}</span>}
                  {tile ? t(tile.labelKey) : <span dir="auto">{offer.category}</span>}
                </span>
                <RedemptionBadge method={offer.redemptionMethod} className="!py-1.5 !text-xs" />
              </div>

              <p className="mt-4 text-2xl font-bold leading-tight tracking-tight text-[#0B1B3D] sm:text-3xl" dir="auto">
                {offer.businessName}
              </p>
              <h1 className="mt-2 text-lg font-semibold leading-snug text-[#334155] sm:text-xl" dir="auto">
                {offer.title}
              </h1>
              {offer.location && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-[#94A3B8]">
                  <i className="fa-solid fa-location-dot text-xs" aria-hidden="true"></i>
                  <span dir="auto">{offer.location}</span>
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-3xl font-extrabold tracking-tight text-[#0038B8]" dir="ltr">{formatPrice(offer.offerPrice)}</span>
                {discount > 0 && (
                  <span className="text-lg text-[#94A3B8] line-through decoration-[#94A3B8]/70" dir="ltr">{formatPrice(offer.originalPrice)}</span>
                )}
                <DiscountBadge percent={discount} size="lg" />
              </div>

              {offer.description && (
                <p className="mt-5 whitespace-pre-line text-[15px] leading-relaxed text-[#475569]" dir="auto">{offer.description}</p>
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

            <div className="border-t border-slate-100 px-5 py-6 sm:px-8 sm:py-7">
              <HowToRedeem
                method={offer.redemptionMethod}
                instructions={offer.redemptionInstructions}
                terms={offer.redemptionTerms}
                includePurchaseStep={!alreadyClaimed}
                variant="section"
              />
            </div>

            {/* The card's last row. On phones it sticks to the bottom of the screen,
                above the home indicator, while the card is in view. */}
            <div className="sticky bottom-0 z-10 rounded-b-3xl border-t border-slate-100 bg-white/95 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:static sm:px-8 sm:pb-8 sm:pt-6 sm:backdrop-blur-none">
              {!user && !authLoading && (
                <Link href="/login" className="tap-target btn-primary w-full">
                  <span>{t('offer_buy_button').replace('{price}', formatPrice(offer.offerPrice))}</span>
                </Link>
              )}

              {(authLoading || claimLoading) && (
                <div role="status" className="tap-target btn-primary w-full opacity-60 pointer-events-none">
                  <span aria-hidden="true">…</span>
                  <span className="sr-only">{t('bizdash_loading')}</span>
                </div>
              )}

              {user && !authLoading && !claimLoading && alreadyClaimed && (
                <div className="flex items-start gap-3 rounded-2xl bg-[#F8FAFC] p-4">
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
                <a href={`/checkout?offerId=${encodeURIComponent(offer.id)}`} className="tap-target btn-primary w-full">
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
