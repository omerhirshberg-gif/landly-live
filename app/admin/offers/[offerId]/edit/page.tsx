'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/admin/adminSession'
import OfferFormFields, { voucherTermsPayload, type OfferFormValue } from '@/components/admin/OfferFormFields'
import Alert from '@/components/admin/Alert'
import BackLink from '@/components/admin/BackLink'
import { CardSkeletons } from '@/components/admin/Card'
import EmptyState from '@/components/admin/EmptyState'
import { ButtonSpinner, FormActions, FormSection } from '@/components/admin/FormSection'
import PageHeader from '@/components/admin/PageHeader'
import StatusBadge from '@/components/admin/StatusBadge'
import { PRIMARY_BUTTON } from '@/components/admin/formStyles'
import { getOffer, OfferDocument } from '@/lib/firebase/offers'
import { validateOfferPrices } from '@/lib/admin/validateOfferPrices'

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
    validityDays: String(offer.validityDays),
    redemptionTerms: offer.redemptionTerms,
    redemptionMethod: offer.redemptionMethod,
    redemptionInstructions: offer.redemptionInstructions,
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
      const res = await adminFetch(`/api/admin/offers/${offerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
            ...voucherTermsPayload(form),
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

  if (offer === undefined) {
    return (
      <div className="max-w-3xl space-y-4">
        <CardSkeletons count={1} className="h-24" />
        <CardSkeletons count={1} className="h-96" />
      </div>
    )
  }
  if (offer === null) {
    return (
      <div className="max-w-3xl">
        <BackLink href="/admin/offers">Back to offers</BackLink>
        <EmptyState icon="fa-tags" title="Offer not found" description="It may have been deleted." />
      </div>
    )
  }

  const backHref = `/admin/businesses/${offer.businessId}`

  return (
    <div className="max-w-3xl">
      <BackLink href={backHref}>Back to business</BackLink>
      <PageHeader title="Edit offer" subtitle={<span dir="auto">{offer.title}</span>} />

      {error && <Alert className="mb-6">{error}</Alert>}

      <div className="space-y-6">
        <FormSection icon="fa-store" title="Business" description="Fixed for this offer.">
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Business</dt>
              <dd className="mt-1 font-semibold text-[#0B1B3D]" dir="auto">{offer.businessName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Category</dt>
              <dd className="mt-1">
                <StatusBadge tone="blue">
                  <span dir="auto">{offer.category}</span>
                </StatusBadge>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Created</dt>
              <dd className="mt-1 font-semibold text-[#0B1B3D]">{offer.createdAt ? offer.createdAt.toLocaleDateString() : '—'}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-[#94A3B8]">
            Business, category, and claim count aren&apos;t editable here. Reassigning an offer to a different business is a separate operation.
          </p>
        </FormSection>

        {form && (
          <form className="space-y-6" onSubmit={handleSubmit}>
            <FormSection icon="fa-tags" title="Offer" description="Changes apply to new purchases; existing vouchers keep their terms.">
              <OfferFormFields value={form} onChange={updateForm} />
            </FormSection>
            <FormActions>
              <button type="submit" disabled={submitting} aria-busy={submitting} className={`${PRIMARY_BUTTON} w-full`}>
                {submitting && <ButtonSpinner />}
                {submitting ? 'Saving…' : 'Save changes'}
              </button>
            </FormActions>
          </form>
        )}
      </div>
    </div>
  )
}
