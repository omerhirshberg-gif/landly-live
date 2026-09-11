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
  const [imgError, setImgError] = useState(false)

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
              <i className="fa-solid fa-tags"></i>
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
  const showImage = !!offer.imageUrl && !imgError

  return (
    <>
      <Navbar />
      <div className="pt-16 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 pt-8 sm:pt-10">
          <Link
            href={`/categories/${encodeURIComponent(offer.category)}`}
            className="tap-target inline-flex items-center gap-2 text-sm font-bold text-brand bg-brand/10 border border-brand/20 rounded-full px-4 py-2 transition hover:bg-brand/20 hover:border-brand/40 mb-5"
          >
            <i className="fa-solid fa-arrow-left text-xs"></i>
            <span>{t('offer_detail_back')}</span>
          </Link>
        </div>

        <div className="max-w-lg mx-auto px-5 sm:px-6 pb-8 sm:pb-10">
          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="relative aspect-[16/9] bg-slate-50 flex items-center justify-center">
              {showImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={offer.imageUrl} alt={offer.title} onError={() => setImgError(true)} className="w-full h-full object-cover" />
              ) : (
                <i className="fa-regular fa-image text-4xl text-slate-300"></i>
              )}
              {user && (
                <button
                  onClick={() => toggleWishlist(offer.id)}
                  aria-pressed={isWishlisted(offer.id)}
                  aria-label={isWishlisted(offer.id) ? t('btn_remove_from_wishlist') : t('btn_add_to_wishlist')}
                  className={`tap-target absolute top-3 end-3 w-10 h-10 flex items-center justify-center rounded-full shadow-sm transition ${isWishlisted(offer.id) ? 'bg-red-500 text-white' : 'bg-white/90 text-slate-500 hover:text-red-500'}`}
                >
                  <i className={`${isWishlisted(offer.id) ? 'fa-solid' : 'fa-regular'} fa-heart text-base`}></i>
                </button>
              )}
            </div>
            <div className="p-6 sm:p-8">
            <div className="text-xs font-bold tracking-widest text-brand uppercase mb-1">{offer.category}</div>
            <div className="text-sm font-bold text-slate-500">{offer.businessName}</div>
            {offer.location && <div className="text-xs text-slate-400 mb-3">{offer.location}</div>}
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mb-3 mt-1">{offer.title}</h1>

            <div className="flex items-center gap-2 mb-4" dir="ltr">
              <span className="text-2xl font-black text-brand">{formatPrice(offer.offerPrice)}</span>
              <span className="text-sm text-slate-400 line-through">{formatPrice(offer.originalPrice)}</span>
              <span className="deal-badge !mb-0">-{getOfferDiscountPercent(offer.originalPrice, offer.offerPrice)}%</span>
            </div>

            {offer.description && (
              <p className="text-sm text-slate-600 leading-relaxed mb-5">{offer.description}</p>
            )}

            <div className="border-t border-slate-100 pt-4 space-y-2 mb-6">
              {formattedExpiry && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <i className="fa-regular fa-clock"></i>
                  <span>{t('offer_detail_expires').replace('{date}', formattedExpiry)}</span>
                </div>
              )}
              {remaining !== null && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <i className="fa-solid fa-ticket"></i>
                  <span>{t('offer_detail_remaining').replace('{count}', String(remaining))}</span>
                </div>
              )}
            </div>

            {!user && !authLoading && (
              <Link href="/login" className="tap-target btn-primary w-full">
                <span>{t('offer_buy_button').replace('{price}', formatPrice(offer.offerPrice))}</span>
              </Link>
            )}

            {(authLoading || claimLoading) && (
              <div className="tap-target btn-primary w-full opacity-60 pointer-events-none">
                <span>…</span>
              </div>
            )}

            {user && !authLoading && !claimLoading && alreadyClaimed && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
                <i className="fa-solid fa-circle-check text-emerald-500 text-lg flex-shrink-0 mt-0.5"></i>
                <div>
                  <div className="font-bold text-slate-700 text-sm mb-1">{t('offer_already_claimed_title')}</div>
                  <p className="text-sm text-slate-500 mb-2">{t('offer_already_claimed_sub')}</p>
                  <Link href="/member" className="text-sm font-bold text-brand hover:underline">{t('offer_already_claimed_link')}</Link>
                </div>
              </div>
            )}

            {user && !authLoading && !claimLoading && !alreadyClaimed && (
              <Link href={`/checkout?offerId=${encodeURIComponent(offer.id)}`} className="tap-target btn-primary w-full">
                <span>{t('offer_buy_button').replace('{price}', formatPrice(offer.offerPrice))}</span>
              </Link>
            )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
