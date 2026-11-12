'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PasswordField from '@/components/admin/PasswordField'
import RevealableText, { CopyButton } from '@/components/admin/RevealableText'
import { adminFetch } from '@/lib/admin/adminSession'
import Link from 'next/link'
import { BUSINESS_CATEGORIES } from '@/lib/categories'
import OfferFormFields, { EMPTY_OFFER_TRANSLATIONS, EMPTY_VOUCHER_TERMS, voucherTermsPayload, type OfferFormValue } from '@/components/admin/OfferFormFields'
import AddressAutocomplete from '@/components/admin/AddressAutocomplete'
import type { GeoAddress } from '@/lib/geo'
import type { BusinessNameOverrides } from '@/lib/business/businessText'
import BusinessLogoField from '@/components/admin/BusinessLogoField'
import BusinessNameTranslations from '@/components/admin/BusinessNameTranslations'
import Alert from '@/components/admin/Alert'
import BackLink from '@/components/admin/BackLink'
import Card from '@/components/admin/Card'
import { ButtonSpinner, FormSection, StickyActionBar } from '@/components/admin/FormSection'
import { FormTabs, TabPanel, useFormTabs } from '@/components/admin/FormTabs'
import { useAdminParent } from '@/components/admin/AdminCrumbContext'
import PageHeader from '@/components/admin/PageHeader'
import BusinessPhoneField from '@/components/admin/BusinessPhoneField'
import { categoryEmoji } from '@/components/admin/CategoryBadge'
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/admin/formStyles'
import { validateOfferPrices } from '@/lib/admin/validateOfferPrices'
import { confirmLeave, useUnsavedGuard } from '@/lib/admin/useUnsavedGuard'
import { useAdminT, type AdminKey } from '@/lib/admin/translations'

interface SuccessResult {
  uid: string
  offerId: string
  offerTitle: string
  businessName: string
  loginEmail: string
  loginPassword: string
  translationWarning?: string | null
}

const emptyForm = {
  businessName: '',
  businessId: '',
  category: BUSINESS_CATEGORIES[0] as string,
  location: '',
  address: null as GeoAddress | null,
  businessNameOverrides: {} as BusinessNameOverrides,
  logoUrl: '',
  phone: '',
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
  ...EMPTY_VOUCHER_TERMS,
  ...EMPTY_OFFER_TRANSLATIONS,
}

// The business, its login and its first offer, in tabs rather than one long
// scroll; the whole form still submits (and validates) as one.
const newBusinessTabs = (t: (key: AdminKey) => string) => [
  { id: 'basics', label: t('newBiz.tab.basics'), icon: 'fa-store' },
  { id: 'media', label: t('newBiz.tab.media'), icon: 'fa-image' },
  { id: 'login', label: t('newBiz.tab.login'), icon: 'fa-key' },
  { id: 'offer', label: t('newBiz.tab.offer'), icon: 'fa-tags' },
  { id: 'pricing', label: t('newBiz.tab.pricing'), icon: 'fa-shekel-sign' },
  { id: 'translations', label: t('newBiz.tab.translations'), icon: 'fa-language' },
] as const

export default function NewBusinessPage() {
  const router = useRouter()
  const { t } = useAdminT()
  const tabs = useFormTabs(newBusinessTabs(t))
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SuccessResult | null>(null)
  const backHref = useAdminParent()?.href ?? '/admin/businesses'
  const dirty = !result && JSON.stringify(form) !== JSON.stringify(emptyForm)
  useUnsavedGuard(dirty && !submitting)

  const update = <K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))
  const updateOffer = <K extends keyof OfferFormValue>(key: K, value: OfferFormValue[K]) => update(key, value as never)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
      const res = await adminFetch('/api/admin/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business: {
            businessName: form.businessName,
            businessId: form.businessId,
            category: form.category,
            location: form.location,
            address: form.address,
            logoUrl: form.logoUrl,
            phone: form.phone,
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
            ...voucherTermsPayload(form),
          },
          translationOverrides: form.translationOverrides,
          businessNameOverrides: form.businessNameOverrides,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t('newBiz.errorGeneric'))
        setSubmitting(false)
        return
      }
      setResult(data)
    } catch {
      setError(t('newBiz.errorRetry'))
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
              <h1 className="text-xl font-bold text-[#0B1B3D]">{t('newBiz.created')}</h1>
              <p className="mt-0.5 text-sm text-emerald-800">{t('newBiz.createdSub')}</p>
            </div>
          </div>

          <dl className="divide-y divide-[#E2E8F0]">
            <ResultRow label={t('newBiz.business')}>
              <span className="font-semibold text-[#0B1B3D]" dir="auto">{result.businessName}</span>
            </ResultRow>
            <ResultRow label={t('newBiz.loginEmail')}>
              <div className="flex items-center gap-1">
                <span className="min-w-0 break-all font-mono text-[#0B1B3D]" dir="ltr">{result.loginEmail}</span>
                <CopyButton value={result.loginEmail} label={t('newBiz.copyEmail')} />
              </div>
            </ResultRow>
            <ResultRow label={t('newBiz.loginPassword')}>
              <RevealableText className="font-mono text-[#0B1B3D]">{result.loginPassword}</RevealableText>
            </ResultRow>
            <ResultRow label={t('newBiz.firstOffer')}>
              <div className="font-semibold text-[#0B1B3D]" dir="auto">{result.offerTitle}</div>
              <div className="font-mono text-xs text-[#64748B]">{result.offerId}</div>
            </ResultRow>
          </dl>
        </Card>

        {result.translationWarning && (
          <Alert tone="warning" className="mt-6">
            {result.translationWarning}
          </Alert>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href={`/admin/offers/new?businessUid=${result.uid}`} className={PRIMARY_BUTTON}>
            <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
            Add another offer to this business
          </Link>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={() => {
              setForm(emptyForm)
              setResult(null)
            }}
          >
            Add another business
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <BackLink />
      <PageHeader title={t('newBiz.title')} subtitle={t('newBiz.subtitle')} />

      {error && <Alert className="mb-6">{error}</Alert>}

      <form onSubmit={handleSubmit} {...tabs.formProps}>
        <FormTabs state={tabs} label={t('newBiz.sections')} />

        <TabPanel state={tabs} tab="basics">
          <FormSection icon="fa-store" title={t('newBiz.basicsTitle')} description={t('newBiz.basicsDesc')}>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="biz-name" className={ADMIN_LABEL}>{t('newBiz.businessName')}</label>
                <input id="biz-name" required dir="auto" className={ADMIN_INPUT} value={form.businessName} onChange={(e) => update('businessName', e.target.value)} />
              </div>
              <div>
                <label htmlFor="biz-id" className={ADMIN_LABEL}>{t('newBiz.businessId')}</label>
                <input id="biz-id" required inputMode="numeric" dir="ltr" className={ADMIN_INPUT} value={form.businessId} onChange={(e) => update('businessId', e.target.value)} />
              </div>
              <div>
                <label htmlFor="biz-category" className={ADMIN_LABEL}>{t('newBiz.category')}</label>
                <select id="biz-category" required className={`${ADMIN_INPUT} cursor-pointer`} value={form.category} onChange={(e) => update('category', e.target.value)}>
                  {BUSINESS_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{`${categoryEmoji(cat)} ${cat}`.trim()}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <AddressAutocomplete
                  id="biz-location"
                  required
                  value={{ text: form.location, address: form.address }}
                  onChange={({ text, address }) => setForm((prev) => ({ ...prev, location: text, address }))}
                />
              </div>
              <BusinessPhoneField id="biz-phone" value={form.phone} onChange={(value) => update('phone', value)} />
            </div>
          </FormSection>
        </TabPanel>

        <TabPanel state={tabs} tab="media">
          <FormSection icon="fa-image" title={t('newBiz.logoTitle')} description={t('newBiz.logoDesc')}>
            <BusinessLogoField value={form.logoUrl} onChange={(url) => update('logoUrl', url)} />
          </FormSection>
          <FormSection icon="fa-panorama" title={t('newBiz.imageTitle')} description={t('newBiz.imageDesc')}>
            <OfferFormFields value={form} onChange={updateOffer} section="media" />
          </FormSection>
        </TabPanel>

        <TabPanel state={tabs} tab="login">
          <FormSection icon="fa-key" title={t('newBiz.loginTitle')} description={t('newBiz.loginDesc')}>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="biz-email" className={ADMIN_LABEL}>{t('newBiz.loginEmail')}</label>
                <input id="biz-email" type="email" required dir="ltr" autoComplete="off" className={ADMIN_INPUT} value={form.loginEmail} onChange={(e) => update('loginEmail', e.target.value)} />
              </div>
              <div>
                <label htmlFor="biz-password" className={ADMIN_LABEL}>{t('newBiz.loginPassword')}</label>
                <PasswordField id="biz-password" required minLength={6} autoComplete="new-password" value={form.loginPassword} onChange={(value) => update('loginPassword', value)} />
                <p className={ADMIN_HINT}>{t('newBiz.passwordHint')}</p>
              </div>
            </div>
          </FormSection>
        </TabPanel>

        <TabPanel state={tabs} tab="offer">
          <FormSection icon="fa-tags" title={t('newBiz.firstOffer')} description={t('newBiz.offerDesc')}>
            <OfferFormFields value={form} onChange={updateOffer} section="basics" />
          </FormSection>
        </TabPanel>

        <TabPanel state={tabs} tab="pricing">
          <FormSection icon="fa-shekel-sign" title={t('newBiz.pricingTitle')} description={t('newBiz.pricingDesc')}>
            <OfferFormFields value={form} onChange={updateOffer} section="pricing" />
          </FormSection>
          <FormSection icon="fa-ticket" title={t('newBiz.redemptionTitle')} description={t('newBiz.redemptionDesc')}>
            <OfferFormFields value={form} onChange={updateOffer} section="terms" />
          </FormSection>
        </TabPanel>

        <TabPanel state={tabs} tab="translations">
          <FormSection icon="fa-language" title={t('newBiz.businessName')} description={t('newBiz.nameTransDesc')}>
            <BusinessNameTranslations
              name={form.businessName}
              stored={null}
              overrides={form.businessNameOverrides}
              onChange={(next) => update('businessNameOverrides', next)}
            />
          </FormSection>
          <FormSection icon="fa-language" title={t('newBiz.firstOffer')} description={t('newBiz.offerTransDesc')}>
            <OfferFormFields value={form} onChange={updateOffer} section="translations" />
          </FormSection>
        </TabPanel>

        <StickyActionBar status={dirty ? t('common.notSavedYet') : undefined}>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            disabled={submitting}
            onClick={() => {
              if (confirmLeave(dirty)) router.push(backHref)
            }}
          >
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={submitting} aria-busy={submitting} className={PRIMARY_BUTTON}>
            {submitting && <ButtonSpinner />}
            {submitting ? t('newBiz.creating') : t('newBiz.create')}
          </button>
        </StickyActionBar>
      </form>
    </div>
  )
}

function ResultRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 sm:px-6">
      <dt className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  )
}
