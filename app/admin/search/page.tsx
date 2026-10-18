'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import Alert from '@/components/admin/Alert'
import Card, { CardSkeletons } from '@/components/admin/Card'
import EmptyState from '@/components/admin/EmptyState'
import { SearchInput } from '@/components/admin/ListToolbar'
import OfferPrice from '@/components/admin/OfferPrice'
import PageHeader from '@/components/admin/PageHeader'
import StatusBadge, { OfferStatusBadge } from '@/components/admin/StatusBadge'
import { SECTION_HEADING } from '@/components/admin/formStyles'

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
      <PageHeader title="Search" subtitle="Find any store or perk by name, ID, or category." />

      {error && <Alert className="mb-6">{error}</Alert>}

      <SearchInput
        label="Search stores and perks"
        placeholder="Search stores or perks by name, ID, or category…"
        value={query}
        onChange={setQuery}
        autoFocus
        className="mb-8 max-w-2xl"
      />

      {!hasQuery && (
        <EmptyState icon="fa-magnifying-glass" title="Start typing to search" description="Results from stores and perks appear as you type." />
      )}
      {hasQuery && loading && !error && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <CardSkeletons count={3} />
        </div>
      )}
      {noResults && (
        <EmptyState
          icon="fa-face-meh"
          title="No results"
          description={
            <>
              Nothing matches &ldquo;<span dir="auto">{query.trim()}</span>&rdquo;.
            </>
          }
        />
      )}

      {hasQuery && !loading && matchedBusinesses.length > 0 && (
        <section className="mb-10">
          <h2 className={SECTION_HEADING}>Stores ({matchedBusinesses.length})</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {matchedBusinesses.map((business) => (
              <Card key={business.uid} href={`/admin/businesses/${business.uid}`} className="flex flex-col gap-3 p-5">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[#0B1B3D]" dir="auto">{business.businessName}</div>
                  <div className="mt-0.5 truncate text-xs text-[#94A3B8]" dir="ltr">{business.email}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-[#E2E8F0] pt-3">
                  <StatusBadge tone="blue">
                    <span dir="auto">{business.category}</span>
                  </StatusBadge>
                  <StatusBadge tone={business.activePerkCount > 0 ? 'emerald' : 'slate'} icon="fa-tags">
                    {business.activePerkCount} active perks
                  </StatusBadge>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {hasQuery && !loading && matchedOffers.length > 0 && (
        <section>
          <h2 className={SECTION_HEADING}>Perks ({matchedOffers.length})</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {matchedOffers.map((offer) => (
              <Card key={offer.id} href={`/admin/offers/${offer.id}/edit`} className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-[#0B1B3D]" dir="auto">{offer.title}</div>
                    <div className="mt-0.5 truncate text-xs text-[#94A3B8]" dir="auto">{offer.businessName}</div>
                  </div>
                  <OfferStatusBadge offer={offer} />
                </div>
                <div className="border-t border-[#E2E8F0] pt-3">
                  <OfferPrice offerPrice={offer.offerPrice} originalPrice={offer.originalPrice} />
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
