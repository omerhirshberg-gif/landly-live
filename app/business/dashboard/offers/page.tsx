'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/admin/Card'
import { useAuth } from '@/lib/firebase/useAuth'
import { useBusinessLang } from '@/lib/business/BusinessLangProvider'
import { formatPrice } from '@/lib/format'
import { getOfferDiscountPercent } from '@/lib/firebase/offers'
import type { OfferStatus } from '@/lib/admin/offerStatus'

interface BusinessOffer {
  id: string
  title: string
  originalPrice: number
  offerPrice: number
  totalQuantity: number | null
  claimedCount: number
  status: OfferStatus
}

const STATUS_STYLES: Record<OfferStatus, string> = {
  active: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  soldOut: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  expired: 'text-slate-400 bg-white/5 border-white/10',
}

export default function BusinessOffersPage() {
  const { t } = useBusinessLang()
  const { user } = useAuth()
  const [offers, setOffers] = useState<BusinessOffer[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  async function loadOffers(cursor: string | null, append: boolean) {
    if (!user) return
    if (append) setLoadingMore(true); else { setOffers(null); setError(null) }
    try {
      const idToken = await user.getIdToken()
      const suffix = cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
      const res = await fetch(`/api/business/offers?limit=50${suffix}`, { headers: { Authorization: `Bearer ${idToken}` } })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? t('bizdash_offers_error')); return }
      setOffers((current) => append ? [...(current ?? []), ...(data.offers ?? [])] : (data.offers ?? []))
      setNextCursor(data.nextCursor ?? null)
    } catch { setError(t('bizdash_offers_error')) }
    finally { setLoadingMore(false) }
  }

  useEffect(() => {
    if (!user) return
    void loadOffers(null, false)
  }, [user, t])

  const statusLabel: Record<OfferStatus, string> = {
    active: t('bizdash_offers_status_active'),
    soldOut: t('bizdash_offers_status_soldout'),
    expired: t('bizdash_offers_status_expired'),
  }

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-6">{t('bizdash_nav_offers')}</h1>

      {error && (
        <div className="mb-4 text-sm font-semibold text-red-400 bg-red-950/40 border border-red-900 rounded-xl px-4 py-3">
          {error}
        </div>
      )}
      {offers === null && !error && <p className="text-slate-400">{t('bizdash_loading')}</p>}
      {offers?.length === 0 && <p className="text-slate-400">{t('bizdash_offers_empty')}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {offers?.map((offer) => (
          <Card key={offer.id} className="p-5 flex flex-col gap-3">
            <div className="min-w-0">
              <span
                className={`inline-flex items-center text-[11px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 border mb-1.5 ${STATUS_STYLES[offer.status]}`}
              >
                {statusLabel[offer.status]}
              </span>
              <div className="text-white font-bold truncate">{offer.title}</div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div className="text-sm font-bold text-white" dir="ltr">
                {formatPrice(offer.offerPrice)}{' '}
                <span className="text-slate-500 font-semibold line-through">{formatPrice(offer.originalPrice)}</span>
                <span className="text-emerald-400 font-semibold ml-1">
                  -{getOfferDiscountPercent(offer.originalPrice, offer.offerPrice)}%
                </span>
              </div>
              <div className="text-slate-500 text-xs font-semibold shrink-0">
                {offer.claimedCount}/{offer.totalQuantity ?? '∞'} {t('bizdash_offers_claimed_label')}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {nextCursor && <button type="button" onClick={() => void loadOffers(nextCursor, true)} disabled={loadingMore} className="btn-primary mt-6 disabled:opacity-60">
        {loadingMore ? '…' : t('bizdash_view_all')}
      </button>}
    </div>
  )
}
