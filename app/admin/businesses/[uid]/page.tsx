'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin/adminSession'
import BackLink from '@/components/admin/BackLink'
import Card from '@/components/admin/Card'
import PageHeader from '@/components/admin/PageHeader'
import { formatPrice } from '@/lib/format'
import { getOfferDiscountPercent } from '@/lib/firebase/offers'

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

  if (business === undefined) return <p className="text-slate-400">Loading…</p>
  if (business === null) return <p className="text-slate-400">Business not found.</p>

  const activeOffers = offers?.filter((o) => o.active) ?? []
  const inactiveOffers = offers?.filter((o) => !o.active) ?? []

  return (
    <div>
      <BackLink href="/admin/businesses">Back</BackLink>

      {error && (
        <div className="mb-4 text-sm font-semibold text-red-400 bg-red-950/40 border border-red-900 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <PageHeader
        className="mb-8"
        title={business.businessName}
        subtitle={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[11px] font-bold uppercase tracking-wide text-brand bg-brand/10 border border-brand/30 rounded-full px-2 py-0.5">
              {business.category}
            </span>
            <span className="text-slate-500 text-xs">{business.businessId} · {business.location}</span>
          </div>
        }
        actions={
          <>
            <Link
              href={`/admin/offers/new?businessUid=${uid}`}
              className="btn-primary !min-h-0 !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
              Add offer
            </Link>
            <button
              className="inline-flex items-center gap-2 text-sm font-bold text-red-400 border-2 border-red-900/60 rounded-full px-4 py-2.5 transition-colors hover:bg-red-950/50 hover:border-red-800"
              onClick={deleteBusiness}
            >
              <i className="fa-solid fa-trash text-xs" aria-hidden="true" />
              Delete business
            </button>
          </>
        }
      />

      {offers === null && <p className="text-slate-400">Loading offers…</p>}

      {offers !== null && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section>
            <h2 className="text-sm font-bold text-emerald-400 uppercase mb-3">Active perks ({activeOffers.length})</h2>
            {activeOffers.length === 0 && <p className="text-slate-500 text-sm">None.</p>}
            <div className="space-y-2">
              {activeOffers.map((offer) => (
                <OfferRow key={offer.id} offer={offer} onDelete={() => deleteOffer(offer)} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold text-slate-500 uppercase mb-3">Not active perks ({inactiveOffers.length})</h2>
            {inactiveOffers.length === 0 && <p className="text-slate-500 text-sm">None.</p>}
            <div className="space-y-2">
              {inactiveOffers.map((offer) => (
                <OfferRow key={offer.id} offer={offer} onDelete={() => deleteOffer(offer)} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function OfferRow({ offer, onDelete }: { offer: Offer; onDelete: () => void }) {
  return (
    <Card className="flex items-center justify-between px-4 py-3">
      <div>
        <div className="text-white font-semibold">{offer.title}</div>
        <div className="text-slate-500 text-xs">
          <span dir="ltr">
            {formatPrice(offer.offerPrice)} <span className="line-through">{formatPrice(offer.originalPrice)}</span> (-{getOfferDiscountPercent(offer.originalPrice, offer.offerPrice)}%)
          </span>
          {' · '}{offer.claimedCount}/{offer.totalQuantity ?? '∞'} claimed
          {offer.expiryDate ? ` · expires ${new Date(offer.expiryDate).toLocaleDateString()}` : ''}
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <Link href={`/admin/offers/${offer.id}/edit`} className="text-slate-300 font-semibold text-sm hover:underline">
          Edit
        </Link>
        <button className="text-red-400 font-semibold text-sm hover:underline" onClick={onDelete}>
          Delete
        </button>
      </div>
    </Card>
  )
}
