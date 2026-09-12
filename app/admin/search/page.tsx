'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import Card from '@/components/admin/Card'
import { formatPrice } from '@/lib/format'
import { getOfferDiscountPercent } from '@/lib/firebase/offers'

interface Business {
  uid: string
  businessName: string
  businessId: string
  category: string
  email: string
  activePerkCount: number
  redeemedTotal: number
}

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

export default function AdminSearchPage() {
  const [businesses, setBusinesses] = useState<Business[] | null>(null)
  const [offers, setOffers] = useState<Offer[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    Promise.all([
      adminFetch('/api/admin/businesses').then((res) => res.json()),
      adminFetch('/api/admin/offers').then((res) => res.json()),
    ])
      .then(([businessesData, offersData]) => {
        setBusinesses(businessesData.businesses ?? [])
        setOffers(offersData.offers ?? [])
      })
      .catch(() => setError('Failed to load search data.'))
  }, [])

  const q = query.trim().toLowerCase()

  const matchedBusinesses = useMemo(() => {
    if (!q || !businesses) return []
    return businesses.filter(
      (b) =>
        b.businessName.toLowerCase().includes(q) ||
        b.businessId.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q)
    )
  }, [businesses, q])

  const matchedOffers = useMemo(() => {
    if (!q || !offers) return []
    return offers.filter((o) => o.title.toLowerCase().includes(q) || o.businessName.toLowerCase().includes(q))
  }, [offers, q])

  const loading = businesses === null || offers === null
  const hasQuery = q.length > 0
  const noResults = hasQuery && !loading && matchedBusinesses.length === 0 && matchedOffers.length === 0

  return (
    <div>
      {error && (
        <div className="mb-4 text-sm font-semibold text-red-400 bg-red-950/40 border border-red-900 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <div className="relative mb-8 max-w-xl">
        <i
          className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm"
          aria-hidden="true"
        />
        <input
          className="inp inp-dark !pl-11 !py-3.5"
          placeholder="Search stores or perks by name, ID, or category..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {!hasQuery && <p className="text-slate-400">Start typing to search stores and perks.</p>}
      {hasQuery && loading && <p className="text-slate-400">Loading…</p>}
      {noResults && <p className="text-slate-400">No results for &ldquo;{query.trim()}&rdquo;.</p>}

      {hasQuery && !loading && matchedBusinesses.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-3">
            Stores ({matchedBusinesses.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {matchedBusinesses.map((business) => (
              <Card key={business.uid} href={`/admin/businesses/${business.uid}`} className="p-5 flex flex-col gap-3">
                <div className="min-w-0">
                  <div className="text-white font-bold truncate">{business.businessName}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="inline-flex items-center text-[11px] font-bold uppercase tracking-wide text-brand bg-brand/10 border border-brand/30 rounded-full px-2 py-0.5">
                      {business.category}
                    </span>
                  </div>
                  <div className="text-slate-500 text-xs mt-2 truncate">{business.email}</div>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400 text-sm font-bold pt-2 border-t border-white/10">
                  <i className="fa-solid fa-tags text-xs" aria-hidden="true" />
                  {business.activePerkCount}
                  <span className="text-slate-500 font-semibold text-xs">active perks</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {hasQuery && !loading && matchedOffers.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-3">
            Perks ({matchedOffers.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {matchedOffers.map((offer) => (
              <Card key={offer.id} href={`/admin/offers/${offer.id}/edit`} className="p-5 flex flex-col gap-3">
                <div className="min-w-0">
                  <span
                    className={`inline-flex items-center text-[11px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 border mb-1.5 ${
                      offer.active
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                        : 'text-slate-400 bg-white/5 border-white/10'
                    }`}
                  >
                    {offer.active ? 'Active' : 'Not active'}
                  </span>
                  <div className="text-white font-bold truncate">{offer.title}</div>
                  <div className="text-slate-500 text-xs mt-1 truncate">{offer.businessName}</div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <div className="text-sm font-bold text-white" dir="ltr">
                    {formatPrice(offer.offerPrice)}{' '}
                    <span className="text-slate-500 font-semibold line-through">
                      {formatPrice(offer.originalPrice)}
                    </span>
                    <span className="text-emerald-400 font-semibold ml-1">
                      -{getOfferDiscountPercent(offer.originalPrice, offer.offerPrice)}%
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
