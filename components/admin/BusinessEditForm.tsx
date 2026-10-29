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
import { ADMIN_INPUT, ADMIN_LABEL, PRIMARY_BUTTON, SECONDARY_BUTTON } from './formStyles'

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
        setError(data.error ?? 'Saving failed.')
        return
      }
      onSaved({ ...form, translations: data.translations ?? form.translations, logoUrl: data.logoUrl ?? form.logoUrl, phone: data.phone ?? form.phone }, data.translationWarning ?? null)
    } catch {
      setError('Saving failed. Try again.')
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
    <form onSubmit={save} className="space-y-6">
      {error && <Alert>{error}</Alert>}
      <FormSection icon="fa-store" title="Basic info" description="How the business appears to members. Changes also update its offers.">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-biz-name" className={ADMIN_LABEL}>Business name</label>
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
            <label htmlFor="edit-biz-category" className={ADMIN_LABEL}>Category</label>
            <select
              id="edit-biz-category"
              required
              className={`${ADMIN_INPUT} cursor-pointer`}
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

      <FormSection icon="fa-location-dot" title="Location" description="Where members find it, and what Near me measures from.">
        <AddressAutocomplete
          id="edit-biz-location"
          required
          value={{ text: form.location, address: form.address }}
          onChange={({ text, address }) => setForm((prev) => ({ ...prev, location: text, address }))}
        />
      </FormSection>

      <FormSection icon="fa-image" title="Logo" description="Shown whole on every offer's card, in high resolution.">
        <BusinessLogoField value={form.logoUrl} onChange={(logoUrl) => setForm((prev) => ({ ...prev, logoUrl }))} />
      </FormSection>

      <StickyActionBar status={dirty ? 'Unsaved changes' : 'All changes saved'}>
        <button type="button" className={SECONDARY_BUTTON} onClick={discard} disabled={saving || !dirty}>
          Discard
        </button>
        <button type="submit" className={PRIMARY_BUTTON} disabled={saving || !dirty} aria-busy={saving}>
          {saving && <ButtonSpinner />}
          {saving ? 'Saving…' : 'Save details'}
        </button>
      </StickyActionBar>
    </form>
  )
}
