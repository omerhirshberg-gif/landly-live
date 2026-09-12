'use client'

import { useEffect, useMemo, useState } from 'react'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { adminFetch } from '@/lib/admin/adminSession'
import OfferFormFields, { type OfferFormValue } from '@/components/admin/OfferFormFields'
import BackLink from '@/components/admin/BackLink'
import Card from '@/components/admin/Card'
import { validateOfferPrices } from '@/lib/admin/validateOfferPrices'

interface Business {
  uid: string
  businessName: string
  businessId: string
  category: string
}

const emptyOffer: OfferFormValue = {
  title: '',
  description: '',
  originalPrice: '',
  offerPrice: '',
  imageUrl: '',
  expiryDate: '',
  totalQuantity: '',
  unlimited: false,
  isBestseller: false,
}

function NewOfferForm() {
  const searchParams = useSearchParams()
  const preselectUid = searchParams.get('businessUid')

  const [businesses, setBusinesses] = useState<Business[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [offer, setOffer] = useState<OfferFormValue>(emptyOffer)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ offerId: string; offerTitle: string; businessName: string } | null>(null)

  useEffect(() => {
    adminFetch('/api/admin/businesses')
      .then((res) => res.json())
      .then((data) => setBusinesses(data.businesses ?? []))
      .catch(() => setLoadError('Failed to load businesses.'))
  }, [])

  useEffect(() => {
    if (preselectUid && businesses?.some((b) => b.uid === preselectUid)) {
      setSelectedUid(preselectUid)
    }
  }, [preselectUid, businesses])

  const filtered = useMemo(() => {
    if (!businesses) return []
    const q = search.trim().toLowerCase()
    if (!q) return businesses
    return businesses.filter((b) => b.businessName.toLowerCase().includes(q) || b.businessId.toLowerCase().includes(q))
  }, [businesses, search])

  const selected = businesses?.find((b) => b.uid === selectedUid) ?? null
  const backUid = selectedUid ?? preselectUid
  const backHref = backUid ? `/admin/businesses/${backUid}` : '/admin/offers'

  const updateOffer = (key: keyof OfferFormValue, value: string | boolean) =>
    setOffer((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUid) return
    const originalPrice = Number(offer.originalPrice)
    const offerPrice = Number(offer.offerPrice)
    const priceError = validateOfferPrices(originalPrice, offerPrice)
    if (priceError) {
      setError(priceError)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await adminFetch('/api/admin/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessUid: selectedUid,
          offer: {
            title: offer.title,
            description: offer.description,
            originalPrice,
            offerPrice,
            imageUrl: offer.imageUrl,
            expiryDate: offer.expiryDate || null,
            totalQuantity: offer.unlimited || !offer.totalQuantity ? null : Number(offer.totalQuantity),
            isBestseller: offer.isBestseller,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        setSubmitting(false)
        return
      }
      setResult(data)
    } catch {
      setError('Something went wrong. Try again.')
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div>
        <BackLink href={backHref}>Back</BackLink>
        <h1 className="text-2xl font-black text-white mb-1">Offer created</h1>
        <Card className="p-5 space-y-3 mb-6">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase">Business</div>
            <div className="text-white font-semibold">{result.businessName}</div>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase">Offer</div>
            <div className="text-white font-semibold">{result.offerTitle}</div>
            <div className="text-slate-500 text-xs font-mono">{result.offerId}</div>
          </div>
        </Card>
        <button
          className="btn-secondary"
          onClick={() => {
            setOffer(emptyOffer)
            setResult(null)
          }}
        >
          Add another offer
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <BackLink href={backHref}>Back</BackLink>
      <h1 className="text-2xl font-black text-white mb-6">Add offer to existing business</h1>

      {(error || loadError) && (
        <div className="mb-4 text-sm font-semibold text-red-400 bg-red-950/40 border border-red-900 rounded-xl px-4 py-3">
          {error ?? loadError}
        </div>
      )}

      <Card className="p-6 mb-6">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-5 pb-3 border-b border-white/10">
          Business
        </h2>
        {selected ? (
          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3.5">
            <div>
              <div className="text-white font-semibold">{selected.businessName}</div>
              <div className="text-slate-500 text-xs">{selected.businessId}</div>
            </div>
            <button type="button" className="btn-secondary !min-h-0 !py-2 !px-4 text-sm" onClick={() => setSelectedUid(null)}>
              Change
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              className="inp inp-dark !py-3.5"
              placeholder="Search by business name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              size={6}
              className="inp inp-dark"
              value=""
              onChange={(e) => setSelectedUid(e.target.value)}
            >
              <option value="" disabled>
                {businesses === null
                  ? 'Loading businesses…'
                  : filtered.length === 0
                    ? 'No businesses found'
                    : `${filtered.length} business${filtered.length === 1 ? '' : 'es'}`}
              </option>
              {filtered.map((b) => (
                <option key={b.uid} value={b.uid}>
                  {b.businessName} ({b.businessId})
                </option>
              ))}
            </select>
          </div>
        )}
      </Card>

      {selected && (
        <form className="space-y-6" onSubmit={handleSubmit}>
          <Card className="p-6">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-5 pb-3 border-b border-white/10">
              Offer
            </h2>
            <OfferFormFields value={offer} onChange={updateOffer} />
          </Card>
          <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-70">
            {submitting ? 'Creating…' : 'Create offer'}
          </button>
        </form>
      )}
    </div>
  )
}

export default function NewOfferPage() {
  return (
    <Suspense fallback={null}>
      <NewOfferForm />
    </Suspense>
  )
}
