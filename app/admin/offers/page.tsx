'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/admin/adminSession'
import Alert from '@/components/admin/Alert'
import Card, { CardSkeletons } from '@/components/admin/Card'
import EmptyState from '@/components/admin/EmptyState'
import { FilterChips, ResultCount, SearchInput } from '@/components/admin/ListToolbar'
import PageHeader from '@/components/admin/PageHeader'
import OfferPrice from '@/components/admin/OfferPrice'
import { OfferStatusBadge } from '@/components/admin/StatusBadge'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/admin/formStyles'
import TranslateMissingButton from '@/components/admin/TranslateMissingButton'

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

type StatusFilter = 'all' | 'active' | 'inactive'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Not active' },
] as const

export default function OffersListPage() {
  const router = useRouter()
  const [offers, setOffers] = useState<Offer[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')

  useEffect(() => {
    adminFetch('/api/admin/offers')
      .then((res) => res.json())
      .then((data) => setOffers(data.offers ?? []))
      .catch(() => setError('Failed to load offers.'))
  }, [])

  const filtered = useMemo(() => {
    if (!offers) return []
    const q = query.trim().toLowerCase()
    return offers.filter(
      (o) =>
        (status === 'all' || (status === 'active') === o.active) &&
        (!q || o.title.toLowerCase().includes(q) || o.businessName.toLowerCase().includes(q)),
    )
  }, [offers, query, status])

  const clearFilters = () => {
    setQuery('')
    setStatus('all')
  }

  return (
    <div>
      <PageHeader
        title="Offers"
        subtitle="All perks across every business."
        actions={
          <>
            <TranslateMissingButton className="w-full sm:w-auto" />
            <Link href="/admin/offers/new" className={`${PRIMARY_BUTTON} w-full sm:w-auto`}>
              <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
              Add new offer
            </Link>
          </>
        }
      />

      {error && <Alert className="mb-6">{error}</Alert>}

      {offers !== null && offers.length > 0 && (
        <div className="mb-6 space-y-3">
          <SearchInput label="Search offers" placeholder="Search by offer or business…" value={query} onChange={setQuery} className="max-w-xl" />
          <FilterChips label="Filter by status" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
          <ResultCount shown={filtered.length} total={offers.length} noun="offers" />
        </div>
      )}

      {offers === null && !error && (
        <div className="space-y-3">
          <CardSkeletons count={4} className="h-20" />
        </div>
      )}

      {offers?.length === 0 && (
        <EmptyState
          icon="fa-tags"
          title="No offers yet"
          description="Add an offer to an existing business to see it here."
          action={
            <Link href="/admin/offers/new" className={PRIMARY_BUTTON}>
              <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
              Add offer
            </Link>
          }
        />
      )}

      {offers !== null && offers.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon="fa-magnifying-glass"
          title="No matching offers"
          description="Try a different search or status."
          action={
            <button type="button" onClick={clearFilters} className={SECONDARY_BUTTON}>
              Clear filters
            </button>
          }
        />
      )}

      {filtered.length > 0 && (
        <>
          {/* Desktop: a table. Each row opens the offer's edit page; the title link keeps it keyboard reachable. */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                <tr>
                  <th scope="col" className="px-5 py-3 text-start">Offer</th>
                  <th scope="col" className="px-5 py-3 text-start">Status</th>
                  <th scope="col" className="px-5 py-3 text-end">Price</th>
                  <th scope="col" className="px-5 py-3 text-end">Claimed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filtered.map((offer) => (
                  <tr
                    key={offer.id}
                    onClick={() => router.push(`/admin/offers/${offer.id}/edit`)}
                    className="cursor-pointer transition-colors hover:bg-[#F8FAFC]"
                  >
                    <td className="max-w-0 px-5 py-4">
                      <Link
                        href={`/admin/offers/${offer.id}/edit`}
                        onClick={(e) => e.stopPropagation()}
                        className="block truncate font-semibold text-[#0B1B3D] hover:text-[#0038B8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8]"
                        dir="auto"
                      >
                        {offer.title}
                      </Link>
                      <div className="mt-0.5 truncate text-xs text-[#94A3B8]" dir="auto">{offer.businessName}</div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <OfferStatusBadge offer={offer} />
                    </td>
                    <td className="px-5 py-4 text-end whitespace-nowrap">
                      <OfferPrice offerPrice={offer.offerPrice} originalPrice={offer.originalPrice} />
                    </td>
                    <td className="px-5 py-4 text-end whitespace-nowrap tabular-nums text-[#475569]" dir="ltr">
                      {offer.claimedCount}/{offer.totalQuantity ?? '∞'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Phones: stacked cards. */}
          <div className="space-y-3 md:hidden">
            {filtered.map((offer) => (
              <Card key={offer.id} href={`/admin/offers/${offer.id}/edit`} className="block p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-[#0B1B3D]" dir="auto">{offer.title}</div>
                    <div className="mt-0.5 truncate text-xs text-[#94A3B8]" dir="auto">{offer.businessName}</div>
                  </div>
                  <OfferStatusBadge offer={offer} />
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[#E2E8F0] pt-3">
                  <OfferPrice offerPrice={offer.offerPrice} originalPrice={offer.originalPrice} />
                  <span className="text-xs font-medium text-[#94A3B8] tabular-nums" dir="ltr">
                    {offer.claimedCount}/{offer.totalQuantity ?? '∞'} claimed
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
