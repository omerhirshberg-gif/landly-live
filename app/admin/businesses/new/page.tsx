'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BUSINESS_CATEGORIES } from '@/lib/categories'
import { ADMIN_SESSION_KEY } from '@/components/admin/AdminGate'
import OfferFormFields, { type OfferFormValue } from '@/components/admin/OfferFormFields'
import BackLink from '@/components/admin/BackLink'
import { validateOfferPrices } from '@/lib/admin/validateOfferPrices'

interface SuccessResult {
  uid: string
  offerId: string
  offerTitle: string
  businessName: string
  loginEmail: string
  loginPassword: string
}

const emptyForm = {
  businessName: '',
  businessId: '',
  category: BUSINESS_CATEGORIES[0] as string,
  location: '',
  loginEmail: '',
  loginPassword: '',
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

export default function NewBusinessPage() {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SuccessResult | null>(null)

  const update = <K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))
  const updateOffer = (key: keyof OfferFormValue, value: string | boolean) => update(key, value as never)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
      const password = sessionStorage.getItem(ADMIN_SESSION_KEY) ?? ''
      const res = await fetch('/api/admin/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` },
        body: JSON.stringify({
          business: {
            businessName: form.businessName,
            businessId: form.businessId,
            category: form.category,
            location: form.location,
            loginEmail: form.loginEmail,
            loginPassword: form.loginPassword,
          },
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
      setResult(data)
    } catch {
      setError('Something went wrong. Try again.')
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="max-w-lg">
        <BackLink href="/admin">Dashboard</BackLink>
        <h1 className="text-2xl font-black text-white mb-1">Business created</h1>
        <p className="text-sm text-slate-400 mb-6">Relay these login details to the business owner.</p>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-3 mb-6">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase">Business</div>
            <div className="text-white font-semibold">{result.businessName}</div>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase">Login email</div>
            <div className="text-white font-mono">{result.loginEmail}</div>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase">Login password</div>
            <div className="text-white font-mono">{result.loginPassword}</div>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase">First offer</div>
            <div className="text-white font-semibold">{result.offerTitle}</div>
            <div className="text-slate-500 text-xs font-mono">{result.offerId}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="btn-secondary"
            onClick={() => {
              setForm(emptyForm)
              setResult(null)
            }}
          >
            Add another business
          </button>
          <Link href={`/admin/offers/new?businessUid=${result.uid}`} className="btn-primary">
            Add another offer to this business
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <BackLink href="/admin">Dashboard</BackLink>
      <h1 className="text-2xl font-black text-white mb-6">Add new business</h1>

      {error && (
        <div className="mb-4 text-sm font-semibold text-red-400 bg-red-950/40 border border-red-900 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-5 pb-3 border-b border-slate-800">
            Business details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block mb-1.5 text-sm font-bold text-slate-300">Business name</label>
              <input required className="inp inp-dark !py-3.5" value={form.businessName} onChange={(e) => update('businessName', e.target.value)} />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-bold text-slate-300">Business ID (ח.פ)</label>
              <input required className="inp inp-dark !py-3.5" value={form.businessId} onChange={(e) => update('businessId', e.target.value)} />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-bold text-slate-300">Category</label>
              <select required className="inp inp-dark !py-3.5" value={form.category} onChange={(e) => update('category', e.target.value)}>
                {BUSINESS_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block mb-1.5 text-sm font-bold text-slate-300">Location</label>
              <input required className="inp inp-dark !py-3.5" placeholder="City / address" value={form.location} onChange={(e) => update('location', e.target.value)} />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-bold text-slate-300">Login email</label>
              <input type="email" required className="inp inp-dark !py-3.5" value={form.loginEmail} onChange={(e) => update('loginEmail', e.target.value)} />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-bold text-slate-300">Login password</label>
              <input type="text" required minLength={6} className="inp inp-dark !py-3.5" value={form.loginPassword} onChange={(e) => update('loginPassword', e.target.value)} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-5 pb-3 border-b border-slate-800">
            First offer
          </h2>
          <OfferFormFields value={form} onChange={updateOffer} />
        </section>

        <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-70">
          {submitting ? 'Creating…' : 'Create business'}
        </button>
      </form>
    </div>
  )
}
