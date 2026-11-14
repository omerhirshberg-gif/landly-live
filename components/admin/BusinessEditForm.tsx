'use client'

import { useMemo, useState } from 'react'
import { confirmLeave, useUnsavedGuard } from '@/lib/admin/useUnsavedGuard'
import { adminFetch } from '@/lib/admin/adminSession'
import { BUSINESS_CATEGORIES } from '@/lib/categories'
import type { GeoAddress } from '@/lib/geo'
import { businessNameOverridesOf, type BusinessTranslations } from '@/lib/business/businessText'
import AddressAutocomplete from './AddressAutocomplete'
import BusinessLogoField from './BusinessLogoField'
import BusinessPhoneField from './BusinessPhoneField'
import { categoryEmoji } from './CategoryBadge'
import BusinessNameTranslations from './BusinessNameTranslations'
import Alert from './Alert'
import { ButtonSpinner, FormSection, StickyActionBar } from './FormSection'
import { ADMIN_INPUT, ADMIN_SELECT, ADMIN_LABEL, PRIMARY_BUTTON, SECONDARY_BUTTON } from './formStyles'
import { useAdminT } from '@/lib/admin/translations'

export interface EditableBusiness {
  businessName: string
  category: string
  location: string
  address: GeoAddress | null
  translations?: BusinessTranslations | null
  /** '' = no logo. */
  logoUrl: string
  /** E.164, or '' for none. */
  phone: string
}

// The business page's Details tab: name (and its translations), category,
// phone, address and logo, in three cards over one sticky Save bar. Saving rewrites
// the copies on every offer of the business too (PATCH
// /api/admin/businesses/[uid]), so members see the change and Near me uses
// the new position. Vouchers already bought keep the name they were sold
// under. "Discard" puts the saved details back.
export default function BusinessEditForm({
  uid,
  business,
  onSaved,
}: {
  uid: string
  business: EditableBusiness
  onSaved: (next: EditableBusiness, translationWarning: string | null) => void
}) {
  const [form, setForm] = useState<EditableBusiness>(business)
  const { t } = useAdminT()
  const [nameOverrides, setNameOverrides] = useState(() => businessNameOverridesOf(business.translations))
  const saved = useMemo(() => JSON.stringify([business, businessNameOverridesOf(business.translations)]), [business])
  const dirty = JSON.stringify([form, nameOverrides]) !== saved
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useUnsavedGuard(dirty && !saving)
  // Categories outside the list (set by hand in Firestore) stay selectable.
  const categories: string[] = BUSINESS_CATEGORIES.includes(business.category as never)
    ? [...BUSINESS_CATEGORIES]
    : [business.category, ...BUSINESS_CATEGORIES]

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await adminFetch(`/api/admin/businesses/${uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business: { businessName: form.businessName, category: form.category, location: form.location, address: form.address, logoUrl: form.logoUrl, phone: form.phone },
          businessNameOverrides: nameOverrides,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? t('bizEdit.saveFailed'))
        return
      }
      onSaved({ ...form, translations: data.translations ?? form.translations, logoUrl: data.logoUrl ?? form.logoUrl, phone: data.phone ?? form.phone }, data.translationWarning ?? null)
    } catch {
      setError(t('bizEdit.saveFailedRetry'))
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    if (!confirmLeave(dirty)) return
    setForm(business)
    setNameOverrides(businessNameOverridesOf(business.translations))
    setError(null)
  }

  return (
    <form onSubmit={save} className="space-y-6 pb-28">
      {error && <Alert>{error}</Alert>}
      <FormSection icon="fa-store" title={t('newBiz.basicsTitle')} description={t('bizEdit.basicsDesc')}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-biz-name" className={ADMIN_LABEL}>{t('newBiz.businessName')}</label>
            <input
              id="edit-biz-name"
              required
              dir="auto"
              className={ADMIN_INPUT}
              value={form.businessName}
              onChange={(e) => setForm((prev) => ({ ...prev, businessName: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="edit-biz-category" className={ADMIN_LABEL}>{t('newBiz.category')}</label>
            <select
              id="edit-biz-category"
              required
              className={`${ADMIN_SELECT}`}
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{`${categoryEmoji(cat)} ${cat}`.trim()}</option>
              ))}
            </select>
          </div>
          <BusinessPhoneField id="edit-biz-phone" value={form.phone} onChange={(phone) => setForm((prev) => ({ ...prev, phone }))} />
          <div className="sm:col-span-2">
            <BusinessNameTranslations name={form.businessName} stored={business.translations} overrides={nameOverrides} onChange={setNameOverrides} />
          </div>
        </div>
      </FormSection>

      <FormSection icon="fa-location-dot" title={t('bizEdit.locationTitle')} description={t('bizEdit.locationDesc')}>
        <AddressAutocomplete
          id="edit-biz-location"
          required
          value={{ text: form.location, address: form.address }}
          onChange={({ text, address }) => setForm((prev) => ({ ...prev, location: text, address }))}
        />
      </FormSection>

      <FormSection icon="fa-image" title={t('bizEdit.logoTitle')} description={t('newBiz.logoDesc')}>
        <BusinessLogoField value={form.logoUrl} onChange={(logoUrl) => setForm((prev) => ({ ...prev, logoUrl }))} />
      </FormSection>

      <StickyActionBar status={dirty ? t('bizEdit.unsaved') : t('bizEdit.saved')}>
        <button type="button" className={SECONDARY_BUTTON} onClick={discard} disabled={saving || !dirty}>
          {t('bizEdit.discard')}
        </button>
        <button type="submit" className={PRIMARY_BUTTON} disabled={saving || !dirty} aria-busy={saving}>
          {saving && <ButtonSpinner />}
          {saving ? t('editOffer.saving') : t('bizEdit.save')}
        </button>
      </StickyActionBar>
    </form>
  )
}
