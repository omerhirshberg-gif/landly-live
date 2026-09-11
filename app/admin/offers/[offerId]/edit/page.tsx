'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ADMIN_SESSION_KEY } from '@/components/admin/AdminGate'
import OfferFormFields, { type OfferFormValue } from '@/components/admin/OfferFormFields'
import BackLink from '@/components/admin/BackLink'
import { getOffer, OfferDocument } from '@/lib/firebase/offers'
import { validateOfferPrices } from '@/lib/admin/validateOfferPrices'

function authHeader() {
  const password = sessionStorage.getItem(ADMIN_SESSION_KEY) ?? ''
  return { Authorization: `Bearer ${password}` }
}

function toFormValue(offer: OfferDocument): OfferFormValue {
  return {
    title: offer.title,
    description: offer.description,
    originalPrice: String(offer.originalPrice),
    offerPrice: String(offer.offerPrice),
    imageUrl: offer.imageUrl,
    expiryDate: offer.expiryDate ? offer.expiryDate.toISOString().slice(0, 10) : '',
    totalQuantity: offer.totalQuantity !== null ? String(offer.totalQuantity) : '',
    unlimited: offer.totalQuantity === null,
    isBestseller: offer.isBestseller,
  }
}

export default function EditOfferPage() {
  const { offerId } = useParams<{ offerId: string }>()
  const router = useRouter()

  const [offer, setOffer] = useState<OfferDocument | null | undefined>(undefined)
  const [form, setForm] = useState<OfferFormValue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    getOffer(offerId).then((result) => {
      if (cancelled) return
      setOffer(result)
      setForm(result ? toFormValue(result) : null)
    })
    return () => { cancelled = true }
  }, [offerId])

  const updateForm = (key: keyof OfferFormValue, value: string | boolean) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    const originalPrice = Number(form.originalPrice)
    const offerPrice = Number(form.offerPrice)
    const priceError = validateOfferPrices(originalPrice, offerPrice)
    if (priceError) {
      setError(priceError)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/offers/${offerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          offer: {
            title: form.title,
            description: form.description,
            originalPrice,
            offerPrice,
            imageUrl: form.imageUrl,
            expiryDate: form.expiryDate || null,
            totalQuantity: form.unlimited || !form.totalQuantity ? null : Number(form.totalQuantity),
            isBestseller: form.isBestseller,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        setSubmitting(false)
        return
      }
      router.push(`/admin/businesses/${offer!.businessId}`)
    } catch {
      setError('Something went wrong. Try again.')
      setSubmitting(false)
    }
  }

  if (offer === undefined) return <p className="text-slate-400">Loading…</p>
  if (offer === null) return <p className="text-slate-400">Offer not found.</p>

  const backHref = `/admin/businesses/${offer.businessId}`

  return (
    <div className="max-w-2xl">
      <BackLink href={backHref}>Business</BackLink>
      <h1 className="text-2xl font-black text-white mb-6">Edit offer</h1>

      {error && (
        <div className="mb-4 text-sm font-semibold text-red-400 bg-red-950/40 border border-red-900 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-sm mb-6">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-5 pb-3 border-b border-slate-800">
          Business
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase">Business</div>
            <div className="text-white font-semibold">{offer.businessName}</div>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase">Category</div>
            <div className="text-white font-semibold">{offer.category}</div>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase">Created</div>
            <div className="text-white font-semibold">{offer.createdAt ? offer.createdAt.toLocaleDateString() : '—'}</div>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-4">
          Business, category, and claim count aren&apos;t editable here. Reassigning an offer to a different business is a separate operation.
        </p>
      </section>

      {form && (
        <form className="space-y-6" onSubmit={handleSubmit}>
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-5 pb-3 border-b border-slate-800">
              Offer
            </h2>
            <OfferFormFields value={form} onChange={updateForm} />
          </section>
          <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-70">
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      )}
    </div>
  )
}
