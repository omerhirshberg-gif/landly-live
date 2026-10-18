'use client'

import { useId } from 'react'
import { DEFAULT_VOUCHER_VALIDITY_DAYS, MAX_REDEMPTION_TERMS_LENGTH, MAX_VOUCHER_VALIDITY_DAYS } from '@/lib/payments/voucherTerms'

export interface OfferFormValue {
  title: string
  description: string
  originalPrice: string
  offerPrice: string
  imageUrl: string
  expiryDate: string
  totalQuantity: string
  unlimited: boolean
  isBestseller: boolean
  validityDays: string
  redemptionTerms: string
}

/** The voucher-terms fields of a blank offer form. */
export const EMPTY_VOUCHER_TERMS = { validityDays: String(DEFAULT_VOUCHER_VALIDITY_DAYS), redemptionTerms: '' }

/** The form's voucher terms as the admin offer routes take them. */
export function voucherTermsPayload(value: OfferFormValue) {
  return { validityDays: Number(value.validityDays), redemptionTerms: value.redemptionTerms }
}

interface Props {
  value: OfferFormValue
  onChange: <K extends keyof OfferFormValue>(key: K, value: OfferFormValue[K]) => void
}

const LABEL = 'block mb-1.5 text-sm font-bold text-slate-300'

export default function OfferFormFields({ value, onChange }: Props) {
  const id = useId()
  const field = (name: string) => `${id}-${name}`

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <div className="sm:col-span-2">
        <label htmlFor={field('title')} className={LABEL}>Title</label>
        <input id={field('title')} required className="inp inp-dark !py-3.5" value={value.title} onChange={(e) => onChange('title', e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={field('description')} className={LABEL}>Description</label>
        <textarea id={field('description')} className="inp inp-dark" rows={3} value={value.description} onChange={(e) => onChange('description', e.target.value)} />
      </div>
      <div>
        <label htmlFor={field('originalPrice')} className={LABEL}>Original price</label>
        <input
          id={field('originalPrice')}
          type="number"
          min={0}
          step="0.01"
          required
          className="inp inp-dark !py-3.5"
          value={value.originalPrice}
          onChange={(e) => onChange('originalPrice', e.target.value)}
        />
      </div>
      <div>
        <label htmlFor={field('offerPrice')} className={LABEL}>Offer price (incl. VAT)</label>
        <input
          id={field('offerPrice')}
          type="number"
          min={0}
          step="0.01"
          required
          className="inp inp-dark !py-3.5"
          value={value.offerPrice}
          onChange={(e) => onChange('offerPrice', e.target.value)}
        />
      </div>
      <div>
        <label htmlFor={field('expiryDate')} className={LABEL}>Expiry date</label>
        <input id={field('expiryDate')} type="date" className="inp inp-dark !py-3.5" value={value.expiryDate} onChange={(e) => onChange('expiryDate', e.target.value)} />
      </div>
      <div>
        <label htmlFor={field('validityDays')} className={LABEL}>Voucher valid for (days after purchase)</label>
        <input
          id={field('validityDays')}
          type="number"
          min={1}
          max={MAX_VOUCHER_VALIDITY_DAYS}
          step={1}
          required
          className="inp inp-dark !py-3.5"
          value={value.validityDays}
          onChange={(e) => onChange('validityDays', e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={field('redemptionTerms')} className={LABEL}>Redemption terms</label>
        <textarea
          id={field('redemptionTerms')}
          className="inp inp-dark"
          rows={3}
          maxLength={MAX_REDEMPTION_TERMS_LENGTH}
          placeholder="e.g. Dine-in only, Sun–Thu. Book ahead by phone. One voucher per table."
          value={value.redemptionTerms}
          onChange={(e) => onChange('redemptionTerms', e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={field('imageUrl')} className={LABEL}>Image URL</label>
        <input
          id={field('imageUrl')}
          type="url"
          className="inp inp-dark !py-3.5"
          placeholder="https://... (link to an externally-hosted photo, e.g. Drive or Imgur)"
          value={value.imageUrl}
          onChange={(e) => onChange('imageUrl', e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={field('totalQuantity')} className={LABEL}>Total quantity</label>
        <input
          id={field('totalQuantity')}
          type="number"
          min={1}
          className="inp inp-dark !py-3.5 disabled:opacity-50"
          disabled={value.unlimited}
          value={value.totalQuantity}
          onChange={(e) => onChange('totalQuantity', e.target.value)}
        />
        <label className="mt-2.5 flex items-center gap-2 text-sm font-semibold text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={value.unlimited}
            onChange={(e) => onChange('unlimited', e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-brand focus:ring-brand"
          />
          Leave blank for unlimited
        </label>
      </div>
      <div className="sm:col-span-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={value.isBestseller}
            onChange={(e) => onChange('isBestseller', e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-brand focus:ring-brand"
          />
          Bestseller
        </label>
      </div>
    </div>
  )
}
