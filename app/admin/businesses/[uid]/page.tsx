'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin/adminSession'
import Alert from '@/components/admin/Alert'
import BackLink from '@/components/admin/BackLink'
import Card, { CardSkeletons } from '@/components/admin/Card'
import EmptyState from '@/components/admin/EmptyState'
import OfferPrice from '@/components/admin/OfferPrice'
import PageHeader from '@/components/admin/PageHeader'
import StatusBadge, { OfferStatusBadge } from '@/components/admin/StatusBadge'
import { DANGER_BUTTON, PRIMARY_BUTTON, SECTION_HEADING } from '@/components/admin/formStyles'

interface Business {
  uid: string
  businessName: string
  businessId: string
  category: string
  location: string
}

interface Offer {
  id: string
  title: string
  originalPrice: number
  offerPrice: number
  expiryDate: string | null
  totalQuantity: number | null
  claimedCount: number
  active: boolean
}

export default function BusinessDetailPage() {
  const { uid } = useParams<{ uid: string }>()
  const router = useRouter()

  const [business, setBusiness] = useState<Business | null | undefined>(undefined)
  const [offers, setOffers] = useState<Offer[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminFetch('/api/admin/businesses')
      .then((res) => res.json())
      .then((data) => setBusiness((data.businesses ?? []).find((b: Business) => b.uid === uid) ?? null))
      .catch(() => setError('Failed to load business.'))

    adminFetch(`/api/admin/offers?businessUid=${uid}`)
      .then((res) => res.json())
      .then((data) => setOffers(data.offers ?? []))
      .catch(() => setError('Failed to load offers.'))
  }, [uid])

  const deleteOffer = async (offer: Offer) => {
    const warning =
      offer.claimedCount > 0
        ? `${offer.claimedCount} customer(s) have already claimed "${offer.title}". Delete it anyway?`
        : `Delete "${offer.title}"?`
    if (!window.confirm(warning)) return

    const res = await adminFetch(`/api/admin/offers/${offer.id}`, { method: 'DELETE' })
    if (!res.ok) {
      setError((await res.json()).error ?? 'Failed to delete offer.')
      return
    }
    setOffers((prev) => prev?.filter((o) => o.id !== offer.id) ?? null)
  }

  const deleteBusiness = async () => {
    if (!business) return
    const offerCount = offers?.length ?? 0
    const offerText = offerCount > 0 ? ` and its ${offerCount} offer(s)` : ''
    if (!window.confirm(`Delete "${business.businessName}"${offerText}? This cannot be undone.`)) return

    const res = await adminFetch(`/api/admin/businesses/${uid}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to delete business.')
      return
    }
    router.push('/admin/businesses')
  }

  if (business === undefined) {
    return error ? (
      <Alert>{error}</Alert>
    ) : (
      <div className="space-y-4">
        <CardSkeletons count={1} className="h-24" />
        <CardSkeletons count={2} className="h-20" />
      </div>
    )
  }
  if (business === null) {
    return (
      <div>
        <BackLink href="/admin/businesses">Back to businesses</BackLink>
        <EmptyState icon="fa-store-slash" title="Business not found" description="It may have been deleted." />
      </div>
    )
  }

  const activeOffers = offers?.filter((o) => o.active) ?? []
  const inactiveOffers = offers?.filter((o) => !o.active) ?? []

  return (
    <div>
      <BackLink href="/admin/businesses">Back to businesses</BackLink>

      {error && <Alert className="mb-6">{error}</Alert>}

      <PageHeader
        className="mb-8"
        title={<span dir="auto">{business.businessName}</span>}
        subtitle={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="blue">
              <span dir="auto">{business.category}</span>
            </StatusBadge>
            <span className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8]">
              <i className="fa-solid fa-hashtag text-[10px]" aria-hidden="true" />
              <span dir="ltr">{business.businessId}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8]">
              <i className="fa-solid fa-location-dot text-[10px]" aria-hidden="true" />
              <span dir="auto">{business.location}</span>
            </span>
          </div>
        }
        actions={
          <>
            <Link href={`/admin/offers/new?businessUid=${uid}`} className={`${PRIMARY_BUTTON} flex-1 sm:flex-none`}>
              <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
              Add offer
            </Link>
            <button type="button" className={`${DANGER_BUTTON} flex-1 sm:flex-none`} onClick={deleteBusiness}>
              <i className="fa-solid fa-trash text-xs" aria-hidden="true" />
              Delete business
            </button>
          </>
        }
      />

      {offers === null && !error && (
        <div className="space-y-2">
          <CardSkeletons count={3} className="h-20" />
        </div>
      )}

      {offers !== null && offers.length === 0 && (
        <EmptyState
          icon="fa-tags"
          title="No offers yet"
          description="This business doesn't have any perks. Add one to get it live."
          action={
            <Link href={`/admin/offers/new?businessUid=${uid}`} className={PRIMARY_BUTTON}>
              <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
              Add offer
            </Link>
          }
        />
      )}

      {offers !== null && offers.length > 0 && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <OfferSection title={`Active perks (${activeOffers.length})`} offers={activeOffers} onDelete={deleteOffer} />
          <OfferSection title={`Not active perks (${inactiveOffers.length})`} offers={inactiveOffers} onDelete={deleteOffer} />
        </div>
      )}
    </div>
  )
}

function OfferSection({ title, offers, onDelete }: { title: string; offers: Offer[]; onDelete: (offer: Offer) => void }) {
  return (
    <section>
      <h2 className={SECTION_HEADING}>{title}</h2>
      {offers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#CBD5E1] px-5 py-6 text-center text-sm text-[#94A3B8]">None.</p>
      ) : (
        <Card className="divide-y divide-[#E2E8F0] overflow-hidden">
          {offers.map((offer) => (
            <OfferRow key={offer.id} offer={offer} onDelete={() => onDelete(offer)} />
          ))}
        </Card>
      )}
    </section>
  )
}

function OfferRow({ offer, onDelete }: { offer: Offer; onDelete: () => void }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold text-[#0B1B3D]" dir="auto">{offer.title}</span>
          <OfferStatusBadge offer={offer} />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#94A3B8]">
          <OfferPrice offerPrice={offer.offerPrice} originalPrice={offer.originalPrice} />
          <span dir="ltr">{offer.claimedCount}/{offer.totalQuantity ?? '∞'} claimed</span>
          {offer.expiryDate && <span>expires {new Date(offer.expiryDate).toLocaleDateString()}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Link
          href={`/admin/offers/${offer.id}/edit`}
          className="inline-flex min-h-12 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-[#0038B8] transition-colors hover:bg-[#F0F7FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8]"
        >
          <i className="fa-solid fa-pen text-xs" aria-hidden="true" />
          Edit
        </Link>
        <button
          type="button"
          className="inline-flex min-h-12 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-[#B91C1C] transition-colors hover:bg-[#FEF2F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8]"
          onClick={onDelete}
        >
          <i className="fa-solid fa-trash text-xs" aria-hidden="true" />
          Delete
        </button>
      </div>
    </div>
  )
}
