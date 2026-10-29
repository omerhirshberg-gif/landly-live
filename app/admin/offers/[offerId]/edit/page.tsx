'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin/adminSession'
import { formatIsraeliDate } from '@/lib/admin/formatDate'
import OfferFormFields, { OFFER_FORM_TABS, voucherTermsPayload, type OfferFormValue } from '@/components/admin/OfferFormFields'
import { useAdminCrumbs, useAdminParent } from '@/components/admin/AdminCrumbContext'
import Alert from '@/components/admin/Alert'
import BackLink from '@/components/admin/BackLink'
import { CardSkeletons } from '@/components/admin/Card'
import EmptyState from '@/components/admin/EmptyState'
import { ButtonSpinner, FormSection, StickyActionBar } from '@/components/admin/FormSection'
import { FormTabs, TabPanel, useFormTabs } from '@/components/admin/FormTabs'
import PageHeader from '@/components/admin/PageHeader'
import StatusBadge from '@/components/admin/StatusBadge'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/admin/formStyles'
import { getOffer, OfferDocument } from '@/lib/firebase/offers'
import { validateOfferPrices } from '@/lib/admin/validateOfferPrices'
import { confirmLeave, useUnsavedGuard } from '@/lib/admin/useUnsavedGuard'
import { manualOverridesOf } from '@/lib/offers/offerText'

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
    translationOverrides: manualOverridesOf(offer.translations),
  }
}

// Opened from Offers it sits under Offers; opened from its business's page
// (?from=business&businessUid=…) under that business, once the offer is
// confirmed to be its. Back, Cancel and Save all return to that parent, the
// crumb before this page in the breadcrumbs (lib/admin/routes.ts).
function EditOfferForm() {
  const { offerId } = useParams<{ offerId: string }>()
  const router = useRouter()
  const search = useSearchParams()
  const claimedBusiness = search.get('from') === 'business' ? search.get('businessUid') : null
  const tabs = useFormTabs(OFFER_FORM_TABS)

  const [offer, setOffer] = useState<OfferDocument | null | undefined>(undefined)
  const [form, setForm] = useState<OfferFormValue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Saved, but a translation failed: stay to show why instead of leaving at once.
  const [savedWarning, setSavedWarning] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getOffer(offerId).then((result) => {
      if (cancelled) return
      setOffer(result)
      setForm(result ? toFormValue(result) : null)
    })
    return () => { cancelled = true }
  }, [offerId])

  // Under its business only if it really is that business's offer; until it has loaded, as the URL says.
  const businessUid = offer === undefined ? claimedBusiness : offer && claimedBusiness === offer.businessId ? claimedBusiness : null
  useAdminCrumbs(
    useMemo(
      () => ({ businessUid, labels: offer && businessUid ? { [`/admin/businesses/${businessUid}`]: offer.businessName } : undefined }),
      [businessUid, offer]
    )
  )
  const parent = useAdminParent()
  const backHref = parent?.href ?? '/admin/offers'

  const initial = useMemo(() => (offer ? JSON.stringify(toFormValue(offer)) : null), [offer])
  const dirty = !!form && initial !== null && JSON.stringify(form) !== initial && !savedWarning
  useUnsavedGuard(dirty && !submitting)

  const updateForm = <K extends keyof OfferFormValue>(key: K, value: OfferFormValue[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    const originalPrice = Number(form.originalPrice)
    const offerPrice = Number(form.offerPrice)
    const priceError = validateOfferPrices(originalPrice, offerPrice)
    if (priceError) {
      setError(priceError)
      tabs.setActive('pricing')
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
          translationOverrides: form.translationOverrides,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        setSubmitting(false)
        return
      }
      if (data.translationWarning) {
        setSavedWarning(data.translationWarning)
        setSubmitting(false)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      router.push(backHref)
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
        <BackLink />
        <EmptyState icon="fa-tags" title="Offer not found" description="It may have been deleted." />
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <BackLink />
      <PageHeader title="Edit offer" subtitle={<bdi dir="auto">{offer.title}</bdi>} />

      {error && <Alert className="mb-6">{error}</Alert>}
      {savedWarning && (
        <Alert tone="warning" className="mb-6">
          <p>Saved. {savedWarning}</p>
          <Link href={backHref} className={`${SECONDARY_BUTTON} mt-3`}>
            Done
          </Link>
        </Alert>
      )}

      <FormSection icon="fa-store" title="Business" description="Fixed for this offer.">
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Business</dt>
            <dd className="mt-1 font-semibold text-[#0B1B3D]">
              <Link href={`/admin/businesses/${offer.businessId}`} className="hover:text-[#0038B8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8]">
                <bdi dir="auto">{offer.businessName}</bdi>
              </Link>
            </dd>
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
            <dd className="mt-1 font-semibold text-[#0B1B3D]"><bdi dir="ltr">{formatIsraeliDate(offer.createdAt)}</bdi></dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-[#94A3B8]">
          Business, category, and claim count aren&apos;t editable here. Reassigning an offer to a different business is a separate operation.
        </p>
      </FormSection>

      {form && (
        <form className="mt-6" onSubmit={handleSubmit} {...tabs.formProps}>
          <FormTabs state={tabs} label="Offer sections" />
          {OFFER_FORM_TABS.map((tab) => (
            <TabPanel key={tab.id} state={tabs} tab={tab.id}>
              <FormSection icon={tab.icon} title={tab.label} description="Changes apply to new purchases; existing vouchers keep their terms.">
                <OfferFormFields value={form} onChange={updateForm} translations={offer.translations} section={tab.id} />
              </FormSection>
            </TabPanel>
          ))}
          <StickyActionBar status={dirty ? 'Unsaved changes' : 'No changes yet'}>
            <button
              type="button"
              className={SECONDARY_BUTTON}
              disabled={submitting}
              onClick={() => {
                if (confirmLeave(dirty)) router.push(backHref)
              }}
            >
              Cancel
            </button>
            <button type="submit" disabled={submitting} aria-busy={submitting} className={PRIMARY_BUTTON}>
              {submitting && <ButtonSpinner />}
              {submitting ? 'Saving…' : 'Save changes'}
            </button>
          </StickyActionBar>
        </form>
      )}
    </div>
  )
}

export default function EditOfferPage() {
  // useSearchParams needs a Suspense boundary to prerender.
  return (
    <Suspense fallback={null}>
      <EditOfferForm />
    </Suspense>
  )
}
