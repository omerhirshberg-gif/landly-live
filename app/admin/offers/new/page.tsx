'use client'

import { useEffect, useMemo, useState } from 'react'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin/adminSession'
import OfferFormFields, { EMPTY_OFFER_TRANSLATIONS, EMPTY_VOUCHER_TERMS, voucherTermsPayload, type OfferFormValue } from '@/components/admin/OfferFormFields'
import Alert from '@/components/admin/Alert'
import BackLink from '@/components/admin/BackLink'
import Card from '@/components/admin/Card'
import { ButtonSpinner, FormActions, FormSection } from '@/components/admin/FormSection'
import { SearchInput } from '@/components/admin/ListToolbar'
import PageHeader from '@/components/admin/PageHeader'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/admin/formStyles'
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
  ...EMPTY_VOUCHER_TERMS,
  ...EMPTY_OFFER_TRANSLATIONS,
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
  const [result, setResult] = useState<{ offerId: string; offerTitle: string; businessName: string; translationWarning?: string | null } | null>(null)

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

  const updateOffer = <K extends keyof OfferFormValue>(key: K, value: OfferFormValue[K]) =>
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
            ...voucherTermsPayload(offer),
          },
          translationOverrides: offer.translationOverrides,
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
      <div className="max-w-2xl">
        <BackLink href={backHref}>Back</BackLink>
        <Card className="overflow-hidden">
          <div className="flex items-start gap-4 border-b border-[#E2E8F0] bg-[#ECFDF5] px-5 py-5 sm:px-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <i className="fa-solid fa-check text-lg" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#0B1B3D]">Offer created</h1>
              <p className="mt-0.5 text-sm text-emerald-800">It&apos;s live for members now.</p>
            </div>
          </div>
          <dl className="divide-y divide-[#E2E8F0]">
            <div className="px-5 py-4 sm:px-6">
              <dt className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Business</dt>
              <dd className="mt-1 font-semibold text-[#0B1B3D]" dir="auto">{result.businessName}</dd>
            </div>
            <div className="px-5 py-4 sm:px-6">
              <dt className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Offer</dt>
              <dd className="mt-1">
                <div className="font-semibold text-[#0B1B3D]" dir="auto">{result.offerTitle}</div>
                <div className="font-mono text-xs text-[#94A3B8]">{result.offerId}</div>
              </dd>
            </div>
          </dl>
        </Card>
        {result.translationWarning && (
          <Alert tone="warning" className="mt-6">
            {result.translationWarning}
          </Alert>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className={PRIMARY_BUTTON}
            onClick={() => {
              setOffer(emptyOffer)
              setResult(null)
            }}
          >
            <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
            Add another offer
          </button>
          <Link href={backHref} className={SECONDARY_BUTTON}>
            Done
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <BackLink href={backHref}>Back</BackLink>
      <PageHeader title="Add offer to existing business" subtitle="Pick the business, then describe the perk." />

      {(error || loadError) && <Alert className="mb-6">{error ?? loadError}</Alert>}

      <div className="space-y-6">
        <FormSection icon="fa-store" title="Business" description="Which business is offering this perk.">
          {selected ? (
            <div className="flex flex-col gap-3 rounded-xl border border-[#0038B8]/20 bg-[#F0F7FF] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="truncate font-semibold text-[#0B1B3D]" dir="auto">{selected.businessName}</div>
                <div className="text-xs text-[#475569]" dir="ltr">{selected.businessId}</div>
              </div>
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setSelectedUid(null)}>
                Change
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <SearchInput label="Search businesses" placeholder="Search by business name or ID…" value={search} onChange={setSearch} />
              <div className="max-h-80 overflow-y-auto overscroll-contain rounded-xl border border-[#E2E8F0]" role="group" aria-label="Businesses">
                {businesses === null ? (
                  <p className="px-4 py-3 text-sm text-[#94A3B8]">Loading businesses…</p>
                ) : filtered.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-[#94A3B8]">No businesses found</p>
                ) : (
                  <ul className="divide-y divide-[#E2E8F0]">
                    {filtered.map((b) => (
                      <li key={b.uid}>
                        <button
                          type="button"
                          onClick={() => setSelectedUid(b.uid)}
                          className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2.5 text-start transition-colors hover:bg-[#F8FAFC] focus-visible:bg-[#F0F7FF] focus-visible:outline-none"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-[#0B1B3D]" dir="auto">{b.businessName}</span>
                            <span className="block text-xs text-[#94A3B8]" dir="ltr">{b.businessId}</span>
                          </span>
                          <i className="fa-solid fa-chevron-right text-xs text-[#CBD5E1] rtl:-scale-x-100" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {businesses !== null && filtered.length > 0 && (
                <p className="text-xs text-[#94A3B8]">
                  {filtered.length} business{filtered.length === 1 ? '' : 'es'}
                </p>
              )}
            </div>
          )}
        </FormSection>

        {selected && (
          <form className="space-y-6" onSubmit={handleSubmit}>
            <FormSection icon="fa-tags" title="Offer" description="The perk members will see.">
              <OfferFormFields value={offer} onChange={updateOffer} />
            </FormSection>
            <FormActions>
              <button type="submit" disabled={submitting} aria-busy={submitting} className={`${PRIMARY_BUTTON} w-full`}>
                {submitting && <ButtonSpinner />}
                {submitting ? 'Creating…' : 'Create offer'}
              </button>
            </FormActions>
          </form>
        )}
      </div>
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
