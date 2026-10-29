'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin/adminSession'
import { formatIsraeliDate } from '@/lib/admin/formatDate'
import Alert from '@/components/admin/Alert'
import { CardSkeletons } from '@/components/admin/Card'
import DataTable from '@/components/admin/DataTable'
import EmptyState from '@/components/admin/EmptyState'
import { FilterChips, ResultCount, SearchInput } from '@/components/admin/ListToolbar'
import PageHeader from '@/components/admin/PageHeader'
import OfferPrice from '@/components/admin/OfferPrice'
import { OfferStatusBadge } from '@/components/admin/StatusBadge'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/admin/formStyles'
import BidiText from '@/components/admin/BidiText'
import OfferThumb from '@/components/admin/OfferThumb'

interface Offer {
  id: string
  title: string
  businessId: string
  businessName: string
  imageUrl: string
  businessLogoUrl: string
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

  const deleteOffer = async (offer: Offer) => {
    const warning =
      offer.claimedCount > 0
        ? `${offer.claimedCount} customer(s) have already claimed "${offer.title}". Delete it anyway?`
        : `Delete "${offer.title}"?`
    if (!window.confirm(warning)) return
    const res = await adminFetch(`/api/admin/offers/${offer.id}`, { method: 'DELETE' })
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Failed to delete offer.')
      return
    }
    setOffers((prev) => prev?.filter((o) => o.id !== offer.id) ?? null)
  }

  return (
    <div>
      <PageHeader
        title="Offers"
        subtitle="All perks across every business."
        actions={
          <Link href="/admin/offers/new" className={`${PRIMARY_BUTTON} w-full sm:w-auto`}>
            <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
            Add new offer
          </Link>
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
        <DataTable
          label="Offers"
          rows={filtered}
          rowKey={(offer) => offer.id}
          rowHref={(offer) => `/admin/offers/${offer.id}/edit`}
          columns={[
            {
              id: 'offer',
              header: 'Offer',
              sortValue: (offer) => offer.title,
              cell: (offer) => <OfferIdentity offer={offer} />,
            },
            { id: 'status', header: 'Status', width: 'w-28', sortValue: (offer) => (offer.active ? 0 : 1), cell: (offer) => <OfferStatusBadge offer={offer} /> },
            {
              id: 'price',
              header: 'Price',
              align: 'end',
              width: 'w-32',
              sortValue: (offer) => offer.offerPrice,
              cell: (offer) => <OfferPrice offerPrice={offer.offerPrice} originalPrice={offer.originalPrice} align="end" />,
            },
            {
              id: 'claimed',
              header: 'Claimed',
              align: 'end',
              width: 'w-24',
              sortValue: (offer) => offer.claimedCount,
              cell: (offer) => <Claimed offer={offer} />,
            },
            {
              id: 'expires',
              header: 'Expires',
              align: 'end',
              width: 'w-28',
              // Shown on desktop widths; tablets beside the sidebar give the title the room.
              className: 'hidden xl:table-cell',
              sortValue: (offer) => (offer.expiryDate ? new Date(offer.expiryDate).getTime() : Number.MAX_SAFE_INTEGER),
              cell: (offer) => (
                <bdi dir="ltr" className="tabular-nums text-[#475569]">
                  {formatIsraeliDate(offer.expiryDate)}
                </bdi>
              ),
            },
          ]}
          actions={(offer) => [
            { label: 'Edit offer', icon: 'fa-pen', href: `/admin/offers/${offer.id}/edit` },
            { label: 'View business', icon: 'fa-store', href: `/admin/businesses/${offer.businessId}` },
            { label: 'Delete offer', icon: 'fa-trash', danger: true, onSelect: () => void deleteOffer(offer) },
          ]}
          card={(offer) => (
            <>
              <div className="flex items-start justify-between gap-3">
                <OfferIdentity offer={offer} />
                <OfferStatusBadge offer={offer} />
              </div>
              <div className="mt-3 flex items-end justify-between gap-3 border-t border-[#E2E8F0] pt-3">
                <OfferPrice offerPrice={offer.offerPrice} originalPrice={offer.originalPrice} />
                <span className="text-end text-xs text-[#94A3B8]">
                  <Claimed offer={offer} /> claimed
                  {offer.expiryDate && (
                    <span className="block">
                      expires <bdi dir="ltr" className="tabular-nums">{formatIsraeliDate(offer.expiryDate)}</bdi>
                    </span>
                  )}
                </span>
              </div>
            </>
          )}
        />
      )}
    </div>
  )
}

/** Thumbnail, then the title over its business: a row's first cell, and a phone card's top. */
function OfferIdentity({ offer }: { offer: Offer }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <OfferThumb imageUrl={offer.imageUrl} logoUrl={offer.businessLogoUrl} />
      <span className="min-w-0 flex-1">
        <BidiText className="font-semibold text-[#0B1B3D] hover:text-[#0038B8]">{offer.title}</BidiText>
        <BidiText className="mt-0.5 text-xs text-[#94A3B8]">{offer.businessName}</BidiText>
      </span>
    </span>
  )
}

/** "12/50" claimed ("∞" when unlimited), as one LTR run. */
function Claimed({ offer }: { offer: Offer }) {
  return (
    <bdi dir="ltr" className="font-semibold tabular-nums text-[#475569]">
      {offer.claimedCount}/{offer.totalQuantity ?? '∞'}
    </bdi>
  )
}
