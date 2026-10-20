'use client'

import { useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { BUSINESS_CATEGORIES } from '@/lib/categories'
import type { GeoAddress } from '@/lib/geo'
import { businessNameOverridesOf, type BusinessTranslations } from '@/lib/business/businessText'
import AddressAutocomplete from './AddressAutocomplete'
import BusinessNameTranslations from './BusinessNameTranslations'
import Alert from './Alert'
import { ButtonSpinner, FormSection } from './FormSection'
import { ADMIN_INPUT, ADMIN_LABEL, PRIMARY_BUTTON, SECONDARY_BUTTON } from './formStyles'

export interface EditableBusiness {
  businessName: string
  category: string
  location: string
  address: GeoAddress | null
  translations?: BusinessTranslations | null
}

// The business page's "Edit details": name (and its translations), category
// and address. Saving rewrites the copies on every offer of the business too
// (PATCH /api/admin/businesses/[uid]), so members see the change and Near me
// uses the new position. Vouchers already bought keep the name they were sold under.
export default function BusinessEditForm({
  uid,
  business,
  onSaved,
  onCancel,
}: {
  uid: string
  business: EditableBusiness
  onSaved: (next: EditableBusiness, translationWarning: string | null) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<EditableBusiness>(business)
  const [nameOverrides, setNameOverrides] = useState(() => businessNameOverridesOf(business.translations))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
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
          business: { businessName: form.businessName, category: form.category, location: form.location, address: form.address },
          businessNameOverrides: nameOverrides,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Saving failed.')
        return
      }
      onSaved({ ...form, translations: data.translations ?? form.translations }, data.translationWarning ?? null)
    } catch {
      setError('Saving failed. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="mb-8">
      <FormSection icon="fa-pen" title="Edit details" description="Changes also update this business's offers.">
        {error && <Alert className="mb-5">{error}</Alert>}
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
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <BusinessNameTranslations name={form.businessName} stored={business.translations} overrides={nameOverrides} onChange={setNameOverrides} />
          </div>
          <div className="sm:col-span-2">
            <AddressAutocomplete
              id="edit-biz-location"
              required
              value={{ text: form.location, address: form.address }}
              onChange={({ text, address }) => setForm((prev) => ({ ...prev, location: text, address }))}
            />
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button type="button" className={SECONDARY_BUTTON} onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={PRIMARY_BUTTON} disabled={saving} aria-busy={saving}>
            {saving && <ButtonSpinner />}
            {saving ? 'Saving…' : 'Save details'}
          </button>
        </div>
      </FormSection>
    </form>
  )
}
