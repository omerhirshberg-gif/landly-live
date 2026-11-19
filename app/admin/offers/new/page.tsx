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
import { BusinessPicker, DirectScopePicker, EMPTY_RAAYONIT_SCOPE, RaayonitPerkFields, RaayonitScopePicker, TermsFields, WizardStepper, type RaayonitScopeValue, Fulfillment, type WizardBusiness } from '@/components/admin/offers/WizardParts'
import { ADMIN_SELECT } from '@/components/admin/formStyles'
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
  const [scope, setScope] = useState<RaayonitScopeValue>(EMPTY_RAAYONIT_SCOPE)
  const [offer, setOffer] = useState<OfferFormValue>(emptyOffer)
  const [commission, setCommission] = useState('')
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms | ''>('')
  const [termsSeededFor, setTermsSeededFor] = useState<string | null>(null)
  // The shared voucher stocks a Raayonit offer can draw from, and the one chosen (it dictates the value and price).
  const [stocks, setStocks] = useState<{ poolId: string; title: string; faceValueAgorot: number; priceAgorot: number; remainingCount: number }[]>([])
  const [poolId, setPoolId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ offerId: string; offerTitle: string; businessName: string; translationWarning?: string | null; warnings: string[]; raayonit: boolean; noBusiness: boolean } | null>(null)

  useEffect(() => {
    adminFetch('/api/admin/businesses')
      .then((res) => res.json())
      .then((data) => setBusinesses(data.businesses ?? []))
      .catch(() => setLoadError(t('wizard.loadBusinessesFailed')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    adminFetch('/api/admin/pools')
      .then((res) => res.json())
      .then((data) => setStocks((data.pools ?? []).filter((p: { faceValueAgorot?: number | null; priceAgorot?: number | null; status?: string }) => p.faceValueAgorot != null && p.priceAgorot != null && p.status !== 'archived')))
      .catch(() => setLoadError(t('inv.loadFailed')))
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
    // A chain's offer is nationwide unless the admin turns that off here.
    setOffer((prev) => ({ ...prev, isNationwide: selected.isChain === true }))
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
  const dirty = !result && (JSON.stringify(offer) !== JSON.stringify(emptyOffer) || selectedUid !== null || JSON.stringify(scope) !== JSON.stringify(EMPTY_RAAYONIT_SCOPE))
  useUnsavedGuard(dirty && !submitting)

  const updateOffer = <K extends keyof OfferFormValue>(key: K, value: OfferFormValue[K]) =>
    setOffer((prev) => ({ ...prev, [key]: value }))

  const raayonit = fulfillment === 'raayonit_pool'
  const manualChain = !raayonit && chainPass
  // A Raayonit perk and a manual multi-chain pass have no business: whatever was picked for a local one is ignored.
  const noBusiness = raayonit || manualChain
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
    if (n >= 3 && raayonit && !poolId) return t('wizard.stockNeeded')
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
            totalQuantity: raayonit || offer.unlimited || !offer.totalQuantity ? null : Number(offer.totalQuantity),
            isBestseller: offer.isBestseller,
            ...(noBusiness ? {} : { isNationwide: offer.isNationwide, participatingChains: offer.isNationwide ? offer.participatingChains : [], participatingPlaces: offer.isNationwide ? offer.participatingPlaces : [] }),
            ...voucherTermsPayload(offer),
          },
          translationOverrides: offer.translationOverrides,
          ...(raayonit ? { poolId } : {}),
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
      setResult({ ...data, warnings, raayonit, noBusiness })
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
          <div className="flex items-start gap-4 border-b border-adm-line bg-adm-ok-soft px-5 py-5 sm:px-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <i className="fa-solid fa-check text-lg" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-adm-text">{t('wizard.created')}</h1>
              <p className="mt-0.5 text-sm text-adm-ok">{result.raayonit && result.warnings.length === 0 ? t('wizard.poolReady') : t('wizard.live')}</p>
            </div>
          </div>
          <dl className="divide-y divide-adm-line">
            <div className="px-5 py-4 sm:px-6">
              <dt className="text-xs font-semibold uppercase tracking-wider text-adm-muted">{result.noBusiness ? t('wizard.brandName') : t('wizard.business')}</dt>
              <dd className="mt-1 font-semibold text-adm-text">
                <BidiText>{result.businessName}</BidiText>
              </dd>
            </div>
            <div className="px-5 py-4 sm:px-6">
              <dt className="text-xs font-semibold uppercase tracking-wider text-adm-muted">{t('wizard.offer')}</dt>
              <dd className="mt-1">
                <BidiText lines={2} className="font-semibold text-adm-text">{result.offerTitle}</BidiText>
                <div className="font-mono text-xs text-adm-muted"><bdi dir="ltr">{result.offerId}</bdi></div>
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
          <button
            type="button"
            className={PRIMARY_BUTTON}
            onClick={() => {
              setOffer(emptyOffer)
              setResult(null)
              setStep(1)
              setMaxReached(1)
              setSelectedUid(null)
              setScope(EMPTY_RAAYONIT_SCOPE)
              setPoolId('')
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
            <div className="border-b border-adm-line px-5 py-4 sm:px-6">
              <h2 className="text-lg font-bold text-adm-text xl:text-xl">{t('wizard.stepOf', { n: 1, total: 4 })}: {t('wizard.step1')}</h2>
            </div>
            <div className="space-y-8 p-5 sm:p-6">
              <section aria-labelledby="wiz-sec-channel" className="space-y-5">
                <h3 id="wiz-sec-channel" className="text-sm font-bold text-adm-text">{t('wizard.sectionChannel')}</h3>
                {!raayonit && <DirectScopePicker chain={chainPass} onChange={setChainPass} />}
                {raayonit && <RaayonitScopePicker value={scope.perkScope} onChange={(perkScope) => setScope((prev) => ({ ...prev, perkScope }))} />}
                {raayonit && <p className="rounded-xl border border-adm-line bg-adm-sunken px-4 py-3 text-sm text-adm-text-2">{t('wizard.raayonitNoBusiness')} {t('wizard.raayonitNavHidden')}</p>}
                {manualChain && <p className="rounded-xl border border-adm-line bg-adm-sunken px-4 py-3 text-sm text-adm-text-2">{t('wizard.chainNoBusiness')}</p>}
                {!noBusiness && <NationwideField checked={offer.isNationwide} onChange={(v) => updateOffer('isNationwide', v)} />}
                {!noBusiness && offer.isNationwide && <StoresField mode="nationwide" chains={offer.participatingChains} places={offer.participatingPlaces} onChange={(next) => { updateOffer('participatingChains', next.chains); updateOffer('participatingPlaces', next.places) }} />}
              </section>
              <section aria-labelledby="wiz-sec-perk" className="space-y-5 border-t border-adm-line pt-8">
                <h3 id="wiz-sec-perk" className="text-sm font-bold text-adm-text">{t('wizard.sectionPerk')}</h3>
                {noBusiness ? (
                  <RaayonitPerkFields value={{ ...scope, perkScope }} onChange={setScope} />
                ) : (
                  <div>
                    <p className={ADMIN_LABEL}>{t('wizard.business')}</p>
                    <p className="-mt-1 mb-3 text-[13px] text-adm-muted">{t('wizard.businessHint')}</p>
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
              <OfferFormFields value={offer} onChange={updateOffer} section="inventory" poolManaged={raayonit} />
              {raayonit && (
                <fieldset className="min-w-0">
                  <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-adm-muted">{t('wizard.stock')}</legend>
                  <p className={`${ADMIN_HINT} mb-3`}>{t('wizard.stockHint')}</p>
                  {stocks.length === 0 ? (
                    <Alert tone="warning">
                      {t('wizard.stockNone')} <Link href="/admin/inventory" className="font-semibold underline">{t('route.Inventory')}</Link>
                    </Alert>
                  ) : (
                    <>
                      <label htmlFor="wiz-stock" className={ADMIN_LABEL}>{t('wizard.stockPick')}</label>
                      <select
                        id="wiz-stock"
                        required
                        className={ADMIN_SELECT}
                        value={poolId}
                        onChange={(e) => {
                          const stock = stocks.find((x) => x.poolId === e.target.value)
                          setPoolId(e.target.value)
                          // The stock dictates what the voucher is worth and what it sells for.
                          if (stock) setOffer((prev) => ({ ...prev, originalPrice: String(stock.faceValueAgorot / 100), offerPrice: String(stock.priceAgorot / 100) }))
                        }}
                      >
                        <option value="">{t('wizard.stockPick')}</option>
                        {stocks.map((stock) => (
                          <option key={stock.poolId} value={stock.poolId}>
                            {t('wizard.stockOption', { name: stock.title, value: stock.faceValueAgorot / 100, price: stock.priceAgorot / 100, n: stock.remainingCount })}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  <p className="mt-4 rounded-xl border border-adm-line bg-adm-sunken px-4 py-3 text-sm text-adm-text-2">{t('wizard.poolNote')}</p>
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
