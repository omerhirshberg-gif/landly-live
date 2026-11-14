'use client'

import { useEffect, useMemo, useState } from 'react'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin/adminSession'
import OfferFormFields, { NationwideField, StoresField, EMPTY_OFFER_TRANSLATIONS, EMPTY_VOUCHER_TERMS, voucherTermsPayload, type OfferFormValue } from '@/components/admin/OfferFormFields'
import { useAdminCrumbs, useAdminParent } from '@/components/admin/AdminCrumbContext'
import Alert from '@/components/admin/Alert'
import BackLink from '@/components/admin/BackLink'
import Card from '@/components/admin/Card'
import BidiText from '@/components/admin/BidiText'
import { ButtonSpinner, FormSection, StickyActionBar } from '@/components/admin/FormSection'
import PageHeader from '@/components/admin/PageHeader'
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/admin/formStyles'
import { BusinessPicker, DirectScopePicker, EMPTY_MULTIPASS_SCOPE, FulfillmentPicker, MultipassPerkFields, MultipassScopePicker, TermsFields, WizardStepper, type MultipassScopeValue, Fulfillment, type WizardBusiness } from '@/components/admin/offers/WizardParts'
import WizardCodeDropzone, { type WizardCodes } from '@/components/admin/offers/WizardCodeDropzone'
import { useAdminT } from '@/lib/admin/translations'
import { isCommissionRate, type PaymentTerms } from '@/lib/merchants/terms'
import { validateOfferPrices } from '@/lib/admin/validateOfferPrices'
import { confirmLeave, useUnsavedGuard } from '@/lib/admin/useUnsavedGuard'

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
  isNationwide: false,
  participatingChains: [],
  participatingPlaces: [],
  brandName: '',
  guideHe: '',
  guideEn: '',
  ...EMPTY_VOUCHER_TERMS,
  ...EMPTY_OFFER_TRANSLATIONS,
}

// The four-step wizard: basics and how the perk is fulfilled, commercial terms
// and pricing, inventory, then media, redemption and translations. Added from a
// business's page (?businessUid=…) it sits under that business (once it's
// found); from Offers, under Offers. Back, Cancel and Done return there.
function NewOfferForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectUid = searchParams.get('businessUid')
  const { t } = useAdminT()

  const [businesses, setBusinesses] = useState<WizardBusiness[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [maxReached, setMaxReached] = useState(1)
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [fulfillment, setFulfillment] = useState<Fulfillment>('direct_merchant')
  // A local perk that is a multi-chain pass: an issuer and its chains instead of a business.
  const [chainPass, setChainPass] = useState(false)
  const [scope, setScope] = useState<MultipassScopeValue>(EMPTY_MULTIPASS_SCOPE)
  const [offer, setOffer] = useState<OfferFormValue>(emptyOffer)
  const [commission, setCommission] = useState('')
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms | ''>('')
  const [termsSeededFor, setTermsSeededFor] = useState<string | null>(null)
  const [pool, setPool] = useState({ unitCost: '', warningThreshold: '10' })
  const [codes, setCodes] = useState<WizardCodes | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ offerId: string; offerTitle: string; businessName: string; translationWarning?: string | null; warnings: string[]; multipass: boolean; noBusiness: boolean; codesAdded: number } | null>(null)

  useEffect(() => {
    adminFetch('/api/admin/businesses')
      .then((res) => res.json())
      .then((data) => setBusinesses(data.businesses ?? []))
      .catch(() => setLoadError(t('wizard.loadBusinessesFailed')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (preselectUid && businesses?.some((b) => b.uid === preselectUid)) setSelectedUid(preselectUid)
  }, [preselectUid, businesses])

  const selected = businesses?.find((b) => b.uid === selectedUid) ?? null

  // The chosen business's agreed terms fill step 2 once, so an edit there isn't overwritten.
  useEffect(() => {
    if (!selected || termsSeededFor === selected.uid) return
    setCommission(selected.commissionRate === null ? '' : String(Number((selected.commissionRate * 100).toFixed(2))))
    setPaymentTerms(selected.paymentTerms ?? '')
    setTermsSeededFor(selected.uid)
  }, [selected, termsSeededFor])

  const preselected = businesses === null ? undefined : (businesses.find((b) => b.uid === preselectUid) ?? null)
  useAdminCrumbs(
    useMemo(
      () =>
        preselected === undefined
          ? { businessUid: preselectUid }
          : { businessUid: preselected?.uid ?? null, labels: preselected ? { [`/admin/businesses/${preselected.uid}`]: preselected.businessName } : undefined },
      [preselected, preselectUid]
    )
  )
  const backHref = useAdminParent()?.href ?? '/admin/offers'
  const dirty = !result && (JSON.stringify(offer) !== JSON.stringify(emptyOffer) || selectedUid !== null || JSON.stringify(scope) !== JSON.stringify(EMPTY_MULTIPASS_SCOPE))
  useUnsavedGuard(dirty && !submitting)

  const updateOffer = <K extends keyof OfferFormValue>(key: K, value: OfferFormValue[K]) =>
    setOffer((prev) => ({ ...prev, [key]: value }))

  const multipass = fulfillment === 'multipass_pool'
  const manualChain = !multipass && chainPass
  // A Multipass perk and a manual multi-chain pass have no business: whatever was picked for a local one is ignored.
  const noBusiness = multipass || manualChain
  const perkScope = manualChain ? 'multi_chain' : scope.perkScope
  const termsChanged = !!selected && !noBusiness && (
    (commission === '' ? null : Number((Number(commission) / 100).toFixed(4))) !== selected.commissionRate ||
    (paymentTerms || null) !== selected.paymentTerms
  )
  const business = noBusiness ? null : selected

  // What stops a step from being left, or null when it is complete.
  const problemWith = (n: number): string | null => {
    if (n >= 1) {
      if (noBusiness) {
        if (!scope.brandName.trim()) return t('wizard.brandNeeded')
        if (!scope.category) return t('wizard.categoryNeeded')
        if (perkScope === 'multi_chain' && scope.chains.length === 0) return t('wizard.chainsNeeded')
      } else if (!selected) return t('wizard.pickBusiness')
      if (!offer.title.trim()) return t('wizard.fixTitle')
    }
    if (n >= 2) {
      const priceError = validateOfferPrices(Number(offer.originalPrice), Number(offer.offerPrice))
      if (priceError) return priceError
      if (!noBusiness && commission !== '' && !isCommissionRate(Number((Number(commission) / 100).toFixed(4)))) return t('wizard.commissionHint')
      if (termsChanged && (commission === '' || !paymentTerms)) return t('wizard.commissionHint')
    }
    if (n >= 3 && multipass) {
      if (pool.unitCost === '' || !(Number(pool.unitCost) >= 0)) return t('wizard.unitCostHint')
      if (!Number.isInteger(Number(pool.warningThreshold)) || Number(pool.warningThreshold) < 0) return t('wizard.warningAt')
    }
    return null
  }

  const go = (target: number) => {
    if (target > step) {
      for (let n = step; n < target; n++) {
        const problem = problemWith(n)
        if (problem) {
          setError(problem)
          setStep(n)
          return
        }
      }
    }
    setError(null)
    setStep(target)
    setMaxReached((prev) => Math.max(prev, target))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submit = async () => {
    const problem = problemWith(4)
    if (problem || (!noBusiness && !selected)) {
      setError(problem)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await adminFetch('/api/admin/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(noBusiness
            ? { perk: { perkScope, brandName: scope.brandName, category: scope.category, participatingChains: scope.chains, participatingPlaces: scope.places, ...(perkScope === 'multi_chain' ? { universalRedemptionGuide: { he: scope.guideHe, en: scope.guideEn } } : {}) } }
            : { businessUid: selected!.uid }),
          offer: {
            title: offer.title,
            description: offer.description,
            originalPrice: Number(offer.originalPrice),
            offerPrice: Number(offer.offerPrice),
            imageUrl: offer.imageUrl,
            expiryDate: offer.expiryDate || null,
            totalQuantity: multipass || offer.unlimited || !offer.totalQuantity ? null : Number(offer.totalQuantity),
            isBestseller: offer.isBestseller,
            ...(noBusiness ? {} : { isNationwide: offer.isNationwide, participatingChains: offer.isNationwide ? offer.participatingChains : [], participatingPlaces: offer.isNationwide ? offer.participatingPlaces : [] }),
            ...voucherTermsPayload(offer),
          },
          translationOverrides: offer.translationOverrides,
          ...(multipass
            ? { pool: { unitCost: Number(pool.unitCost), warningThreshold: Number(pool.warningThreshold) }, codeRows: codes?.sheet.entries ?? [] }
            : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t('wizard.somethingWrong'))
        setSubmitting(false)
        return
      }
      // The offer, its pool and its codes were written together (or not at all). Only the business's terms are a separate write, and a failure of it is reported, not hidden.
      const warnings: string[] = []
      if (selected && termsChanged && commission !== '' && paymentTerms) {
        const termsRes = await adminFetch(`/api/admin/businesses/${selected.uid}/terms`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commissionRate: Number((Number(commission) / 100).toFixed(4)), paymentTerms }),
        }).catch(() => null)
        if (!termsRes?.ok) warnings.push(t('wizard.termsFailed', { error: (await termsRes?.json().catch(() => null))?.error ?? t('wizard.somethingWrong') }))
      }
      setResult({ ...data, warnings, multipass, noBusiness, codesAdded: data.codes?.added ?? 0 })
    } catch {
      setError(t('wizard.somethingWrong'))
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="max-w-2xl">
        <BackLink />
        <Card className="overflow-hidden">
          <div className="flex items-start gap-4 border-b border-[#E2E8F0] bg-[#ECFDF5] px-5 py-5 sm:px-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <i className="fa-solid fa-check text-lg" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#0B1B3D]">{t('wizard.created')}</h1>
              <p className="mt-0.5 text-sm text-emerald-800">{result.multipass && result.warnings.length === 0 && result.codesAdded === 0 ? t('wizard.poolReady') : t('wizard.live')}</p>
            </div>
          </div>
          <dl className="divide-y divide-[#E2E8F0]">
            <div className="px-5 py-4 sm:px-6">
              <dt className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">{result.noBusiness ? t('wizard.brandName') : t('wizard.business')}</dt>
              <dd className="mt-1 font-semibold text-[#0B1B3D]">
                <BidiText>{result.businessName}</BidiText>
              </dd>
            </div>
            <div className="px-5 py-4 sm:px-6">
              <dt className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">{t('wizard.offer')}</dt>
              <dd className="mt-1">
                <BidiText lines={2} className="font-semibold text-[#0B1B3D]">{result.offerTitle}</BidiText>
                <div className="font-mono text-xs text-[#64748B]"><bdi dir="ltr">{result.offerId}</bdi></div>
              </dd>
            </div>
          </dl>
        </Card>
        {result.translationWarning && (
          <Alert tone="warning" className="mt-6">
            {result.translationWarning}
          </Alert>
        )}
        {result.warnings.map((warning) => (
          <Alert key={warning} tone="warning" className="mt-6">
            {warning}
          </Alert>
        ))}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {result.multipass && result.codesAdded === 0 && (
            <Link href="/admin/inventory" className={PRIMARY_BUTTON}>
              <i className="fa-solid fa-file-arrow-up text-xs" aria-hidden="true" />
              {t('wizard.uploadCodes')}
            </Link>
          )}
          <button
            type="button"
            className={result.multipass && result.codesAdded === 0 ? SECONDARY_BUTTON : PRIMARY_BUTTON}
            onClick={() => {
              setOffer(emptyOffer)
              setResult(null)
              setStep(1)
              setMaxReached(1)
              setSelectedUid(null)
              setScope(EMPTY_MULTIPASS_SCOPE)
              setCodes(null)
              setTermsSeededFor(null)
              setSubmitting(false)
            }}
          >
            <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
            {t('wizard.addAnother')}
          </button>
          <Link href={backHref} className={SECONDARY_BUTTON}>
            {t('common.done')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl">
      <BackLink />
      <PageHeader title={t('wizard.title')} subtitle={t('wizard.subtitle')} />

      {(error || loadError) && <Alert className="mb-6">{error ?? loadError}</Alert>}

      <WizardStepper step={step} maxReached={maxReached} onGo={go} />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (step < 4) go(step + 1)
          else void submit()
        }}
        className="space-y-6 pb-28"
      >
        {step === 1 && (
          <Card>
            <div className="border-b border-[#E2E8F0] px-5 py-4 sm:px-6">
              <h2 className="text-lg font-bold text-[#0B1B3D] xl:text-xl">{t('wizard.stepOf', { n: 1, total: 4 })}: {t('wizard.step1')}</h2>
            </div>
            <div className="space-y-8 p-5 sm:p-6">
              <section aria-labelledby="wiz-sec-channel" className="space-y-5">
                <h3 id="wiz-sec-channel" className="text-sm font-bold text-[#0B1B3D]">{t('wizard.sectionChannel')}</h3>
                <FulfillmentPicker value={fulfillment} onChange={setFulfillment} />
                {!multipass && <DirectScopePicker chain={chainPass} onChange={setChainPass} />}
                {multipass && <MultipassScopePicker value={scope.perkScope} onChange={(perkScope) => setScope((prev) => ({ ...prev, perkScope }))} />}
                {multipass && <p className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#475569]">{t('wizard.multipassNoBusiness')} {t('wizard.multipassNavHidden')}</p>}
                {manualChain && <p className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#475569]">{t('wizard.chainNoBusiness')}</p>}
                {!noBusiness && <NationwideField checked={offer.isNationwide} onChange={(v) => updateOffer('isNationwide', v)} />}
                {!noBusiness && offer.isNationwide && <StoresField mode="nationwide" chains={offer.participatingChains} places={offer.participatingPlaces} onChange={(next) => { updateOffer('participatingChains', next.chains); updateOffer('participatingPlaces', next.places) }} />}
              </section>
              <section aria-labelledby="wiz-sec-perk" className="space-y-5 border-t border-[#E2E8F0] pt-8">
                <h3 id="wiz-sec-perk" className="text-sm font-bold text-[#0B1B3D]">{t('wizard.sectionPerk')}</h3>
                {noBusiness ? (
                  <MultipassPerkFields value={{ ...scope, perkScope }} onChange={setScope} />
                ) : (
                  <div>
                    <p className={ADMIN_LABEL}>{t('wizard.business')}</p>
                    <p className="-mt-1 mb-3 text-[13px] text-[#64748B]">{t('wizard.businessHint')}</p>
                    <BusinessPicker businesses={businesses} selected={selected} onSelect={setSelectedUid} />
                  </div>
                )}
                {business || noBusiness ? <OfferFormFields value={offer} onChange={updateOffer} section="basics" /> : null}
              </section>
            </div>
          </Card>
        )}

        {step === 2 && (
          <FormSection icon="fa-shekel-sign" title={t('wizard.step2')}>
            <div className="space-y-8">
              <OfferFormFields value={offer} onChange={updateOffer} section="commercial" />
              {!noBusiness && <TermsFields commission={commission} paymentTerms={paymentTerms} onCommission={setCommission} onPaymentTerms={setPaymentTerms} />}
            </div>
          </FormSection>
        )}

        {step === 3 && (
          <FormSection icon="fa-boxes-stacked" title={t('wizard.step3')}>
            <div className="space-y-8">
              <OfferFormFields value={offer} onChange={updateOffer} section="inventory" poolManaged={multipass} />
              {multipass && (
                <fieldset className="min-w-0">
                  <legend className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#64748B]">{t('wizard.fulfillmentMultipass')}</legend>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="wiz-unit-cost" className={ADMIN_LABEL}>{t('wizard.unitCost')}</label>
                      <input id="wiz-unit-cost" required inputMode="decimal" dir="ltr" className={`${ADMIN_INPUT} tabular-nums`} value={pool.unitCost} onChange={(e) => setPool((p) => ({ ...p, unitCost: e.target.value }))} />
                      <p className={ADMIN_HINT}>{t('wizard.unitCostHint')}</p>
                    </div>
                    <div>
                      <label htmlFor="wiz-warn" className={ADMIN_LABEL}>{t('wizard.warningAt')}</label>
                      <input id="wiz-warn" required inputMode="numeric" dir="ltr" className={`${ADMIN_INPUT} tabular-nums`} value={pool.warningThreshold} onChange={(e) => setPool((p) => ({ ...p, warningThreshold: e.target.value }))} />
                    </div>
                  </div>
                  <div className="mt-6">
                    <WizardCodeDropzone value={codes} onChange={setCodes} />
                  </div>
                  <p className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#475569]">{t('wizard.poolNote')}</p>
                </fieldset>
              )}
            </div>
          </FormSection>
        )}

        {step === 4 && (
          <>
            <FormSection icon="fa-image" title={t('form.image')}>
              <OfferFormFields value={offer} onChange={updateOffer} section="media" />
            </FormSection>
            <FormSection icon="fa-ticket" title={t('form.voucherTerms')}>
              <OfferFormFields value={offer} onChange={updateOffer} section="terms" />
            </FormSection>
            <FormSection icon="fa-language" title={t('form.translations')}>
              <OfferFormFields value={offer} onChange={updateOffer} section="translations" />
            </FormSection>
          </>
        )}

        <StickyActionBar status={dirty ? t('common.notSavedYet') : undefined}>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            disabled={submitting}
            onClick={() => {
              if (step > 1) go(step - 1)
              else if (confirmLeave(dirty)) router.push(backHref)
            }}
          >
            {step > 1 ? t('wizard.back') : t('common.cancel')}
          </button>
          <button type="submit" disabled={submitting || (step === 1 && !noBusiness && !selected)} aria-busy={submitting} className={PRIMARY_BUTTON}>
            {submitting && <ButtonSpinner />}
            {step < 4 ? t('wizard.next') : submitting ? t('wizard.creating') : t('wizard.create')}
          </button>
        </StickyActionBar>
      </form>
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
