'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin/adminSession'
import Card from '@/components/admin/Card'
import { formatPrice } from '@/lib/format'
import { getOfferDiscountPercent } from '@/lib/firebase/offers'

interface Offer {
  id: string
  title: string
  businessId: string
  businessName: string
  originalPrice: number
  offerPrice: number
  expiryDate: string | null
  totalQuantity: number | null
  claimedCount: number
  active: boolean
}

export default function OffersListPage() {
  const [offers, setOffers] = useState<Offer[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminFetch('/api/admin/offers')
      .then((res) => res.json())
      .then((data) => setOffers(data.offers ?? []))
      .catch(() => setError('Failed to load offers.'))
  }, [])

  return (
    <div>
      <Link
        href="/admin/offers/new"
        className="btn-primary !min-h-0 !py-2.5 !px-4 text-sm inline-flex items-center gap-2 w-fit mb-6"
      >
        <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
        Add new offer
      </Link>

      {error && (
        <div className="mb-4 text-sm font-semibold text-red-400 bg-red-950/40 border border-red-900 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {offers === null && <p className="text-slate-400">Loading…</p>}
      {offers?.length === 0 && (
        <p className="text-slate-400">No offers yet — add one from an existing business.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {offers?.map((offer) => (
          <Card key={offer.id} href={`/admin/offers/${offer.id}/edit`} className="p-5 flex flex-col gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`inline-flex items-center text-[11px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 border ${
                    offer.active
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                      : 'text-slate-400 bg-white/5 border-white/10'
                  }`}
                >
                  {offer.active ? 'Active' : 'Not active'}
                </span>
              </div>
              <div className="text-white font-bold truncate">{offer.title}</div>
              <div className="text-slate-500 text-xs mt-1 truncate">{offer.businessName}</div>
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
                {offer.claimedCount}/{offer.totalQuantity ?? '∞'} claimed
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
