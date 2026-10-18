'use client'

import { useEffect, useId, useState } from 'react'
import { DEFAULT_VOUCHER_VALIDITY_DAYS, MAX_REDEMPTION_TERMS_LENGTH, MAX_VOUCHER_VALIDITY_DAYS } from '@/lib/payments/voucherTerms'
import { imageUrlProblem, normalizeImageUrl } from '@/lib/offers/imageUrl'
import {
  DEFAULT_REDEMPTION_METHOD,
  MAX_REDEMPTION_INSTRUCTIONS_LENGTH,
  REDEMPTION_METHODS,
  type RedemptionMethod,
} from '@/lib/offers/redemption'
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL } from './formStyles'

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
  redemptionMethod: RedemptionMethod
  redemptionInstructions: string
}

/** The voucher-terms and redemption fields of a blank offer form. */
export const EMPTY_VOUCHER_TERMS = {
  validityDays: String(DEFAULT_VOUCHER_VALIDITY_DAYS),
  redemptionTerms: '',
  redemptionMethod: DEFAULT_REDEMPTION_METHOD as RedemptionMethod,
  redemptionInstructions: '',
}

/** The form's voucher terms and redemption method as the admin offer routes take them. */
export function voucherTermsPayload(value: OfferFormValue) {
  return {
    validityDays: Number(value.validityDays),
    redemptionTerms: value.redemptionTerms,
    redemptionMethod: value.redemptionMethod,
    redemptionInstructions: value.redemptionInstructions,
  }
}

const METHOD_OPTIONS: Record<RedemptionMethod, { label: string; hint: string; icon: string }> = {
  in_store: { label: 'In store', hint: 'Shown at the counter', icon: 'fa-store' },
  online: { label: 'Online', hint: 'Code used on their site', icon: 'fa-globe' },
  phone_booking: { label: 'By phone', hint: 'Booked by phone first', icon: 'fa-phone' },
}

interface Props {
  value: OfferFormValue
  onChange: <K extends keyof OfferFormValue>(key: K, value: OfferFormValue[K]) => void
}

const CHECKBOX_ROW =
  'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white px-4 text-sm font-semibold text-[#0B1B3D] transition-colors hover:bg-[#F8FAFC] has-[:checked]:border-[#0038B8]/40 has-[:checked]:bg-[#F0F7FF]'
const CHECKBOX = 'h-5 w-5 shrink-0 cursor-pointer accent-[#0038B8]'

function Group({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">{legend}</legend>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

function PriceInput({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative" dir="ltr">
      <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-base font-medium text-[#94A3B8]" aria-hidden="true">
        ₪
      </span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        required
        className={`${ADMIN_INPUT} ps-9 tabular-nums`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export default function OfferFormFields({ value, onChange }: Props) {
  const id = useId()
  const field = (name: string) => `${id}-${name}`

  return (
    <div className="space-y-8">
      <Group legend="Details">
        <div className="sm:col-span-2">
          <label htmlFor={field('title')} className={ADMIN_LABEL}>Title</label>
          <input id={field('title')} required dir="auto" className={ADMIN_INPUT} value={value.title} onChange={(e) => onChange('title', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={field('description')} className={ADMIN_LABEL}>Description</label>
          <textarea
            id={field('description')}
            dir="auto"
            className={`${ADMIN_INPUT} resize-y`}
            rows={3}
            value={value.description}
            onChange={(e) => onChange('description', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={field('imageUrl')} className={ADMIN_LABEL}>Image URL</label>
          <input
            id={field('imageUrl')}
            type="url"
            dir="ltr"
            className={ADMIN_INPUT}
            placeholder="https://…"
            aria-describedby={field('imageUrl-hint')}
            value={value.imageUrl}
            onChange={(e) => onChange('imageUrl', e.target.value)}
          />
          <p id={field('imageUrl-hint')} className={ADMIN_HINT}>
            A direct link to a photo. Google Images, Google Drive (shared with anyone with the link) and Imgur links are converted automatically.
          </p>
          <ImagePreview url={value.imageUrl} />
        </div>
      </Group>

      <Group legend="Pricing">
        <div>
          <label htmlFor={field('originalPrice')} className={ADMIN_LABEL}>Original price</label>
          <PriceInput id={field('originalPrice')} value={value.originalPrice} onChange={(v) => onChange('originalPrice', v)} />
        </div>
        <div>
          <label htmlFor={field('offerPrice')} className={ADMIN_LABEL}>Offer price (incl. VAT)</label>
          <PriceInput id={field('offerPrice')} value={value.offerPrice} onChange={(v) => onChange('offerPrice', v)} />
        </div>
      </Group>

      <Group legend="Availability">
        <div>
          <label htmlFor={field('expiryDate')} className={ADMIN_LABEL}>Expiry date</label>
          <input id={field('expiryDate')} type="date" className={ADMIN_INPUT} value={value.expiryDate} onChange={(e) => onChange('expiryDate', e.target.value)} />
          <p className={ADMIN_HINT}>Leave empty for no expiry.</p>
        </div>
        <div>
          <label htmlFor={field('totalQuantity')} className={ADMIN_LABEL}>Total quantity</label>
          <input
            id={field('totalQuantity')}
            type="number"
            inputMode="numeric"
            min={1}
            className={ADMIN_INPUT}
            disabled={value.unlimited}
            value={value.totalQuantity}
            onChange={(e) => onChange('totalQuantity', e.target.value)}
          />
          <p className={ADMIN_HINT}>Leave blank for unlimited.</p>
        </div>
        <label className={CHECKBOX_ROW}>
          <input type="checkbox" className={CHECKBOX} checked={value.unlimited} onChange={(e) => onChange('unlimited', e.target.checked)} />
          Unlimited quantity
        </label>
        <label className={CHECKBOX_ROW}>
          <input type="checkbox" className={CHECKBOX} checked={value.isBestseller} onChange={(e) => onChange('isBestseller', e.target.checked)} />
          <i className="fa-solid fa-star text-xs text-amber-500" aria-hidden="true" />
          Bestseller
        </label>
      </Group>

      <fieldset className="min-w-0">
        <legend className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">How members redeem</legend>
        <div role="radiogroup" aria-label="Redemption method" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {REDEMPTION_METHODS.map((method) => {
            const option = METHOD_OPTIONS[method]
            const selected = value.redemptionMethod === method
            return (
              <label
                key={method}
                className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#0038B8] ${
                  selected ? 'border-[#0038B8] bg-[#F0F7FF]' : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]'
                }`}
              >
                <input
                  type="radio"
                  name={field('redemptionMethod')}
                  value={method}
                  checked={selected}
                  onChange={() => onChange('redemptionMethod', method)}
                  className="sr-only"
                />
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    selected ? 'bg-[#0038B8] text-white' : 'bg-[#F1F5F9] text-[#475569]'
                  }`}
                >
                  <i className={`fa-solid ${option.icon} text-sm`} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#0B1B3D]">{option.label}</span>
                  <span className="block text-xs text-[#94A3B8]">{option.hint}</span>
                </span>
              </label>
            )
          })}
        </div>
        <div className="mt-5">
          <label htmlFor={field('redemptionInstructions')} className={ADMIN_LABEL}>
            Redemption instructions <span className="font-normal text-[#94A3B8]">(optional)</span>
          </label>
          <textarea
            id={field('redemptionInstructions')}
            dir="auto"
            className={`${ADMIN_INPUT} resize-y`}
            rows={3}
            maxLength={MAX_REDEMPTION_INSTRUCTIONS_LENGTH}
            placeholder={'One step per line, e.g.\nCall 03-555-1234 to book a table\nShow the voucher code when you arrive'}
            aria-describedby={field('redemptionInstructions-hint')}
            value={value.redemptionInstructions}
            onChange={(e) => onChange('redemptionInstructions', e.target.value)}
          />
          <p id={field('redemptionInstructions-hint')} className={ADMIN_HINT}>
            Shown to members as numbered steps. Leave empty to use the standard steps for the chosen method.
          </p>
        </div>
      </fieldset>

      <Group legend="Voucher terms">
        <div className="sm:col-span-2 sm:max-w-xs">
          <label htmlFor={field('validityDays')} className={ADMIN_LABEL}>Voucher valid for</label>
          <div className="relative" dir="ltr">
            <input
              id={field('validityDays')}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_VOUCHER_VALIDITY_DAYS}
              step={1}
              required
              className={`${ADMIN_INPUT} pe-16 tabular-nums`}
              value={value.validityDays}
              onChange={(e) => onChange('validityDays', e.target.value)}
            />
            <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]" aria-hidden="true">
              days
            </span>
          </div>
          <p className={ADMIN_HINT}>Counted from the day of purchase.</p>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={field('redemptionTerms')} className={ADMIN_LABEL}>Redemption terms</label>
          <textarea
            id={field('redemptionTerms')}
            dir="auto"
            className={`${ADMIN_INPUT} resize-y`}
            rows={3}
            maxLength={MAX_REDEMPTION_TERMS_LENGTH}
            placeholder="e.g. Dine-in only, Sun–Thu. Book ahead by phone. One voucher per table."
            value={value.redemptionTerms}
            onChange={(e) => onChange('redemptionTerms', e.target.value)}
          />
          <p className={ADMIN_HINT} dir="ltr">
            {value.redemptionTerms.length}/{MAX_REDEMPTION_TERMS_LENGTH}
          </p>
        </div>
      </Group>
    </div>
  )
}

type PreviewState = 'idle' | 'loading' | 'loaded' | 'failed'

/**
 * What members will see: the link as it will be saved (wrappers unwrapped)
 * and whether it actually loads as an image. A preview, not a gate -- the
 * server does its own checks on save.
 */
function ImagePreview({ url }: { url: string }) {
  const normalized = normalizeImageUrl(url)
  const problem = normalized ? imageUrlProblem(normalized) : null
  const [state, setState] = useState<PreviewState>('idle')

  useEffect(() => {
    setState(normalized && !problem ? 'loading' : 'idle')
  }, [normalized, problem])

  if (!normalized) return null

  return (
    <div className="mt-3 flex items-start gap-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3" aria-live="polite">
      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-[#F0F7FF] to-[#E2E8F0]">
        {!problem && state !== 'failed' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={normalized}
            src={normalized}
            alt=""
            className={`h-full w-full object-cover transition-opacity ${state === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setState('loaded')}
            onError={() => setState('failed')}
          />
        )}
        {(problem || state === 'failed') && (
          <div className="absolute inset-0 flex items-center justify-center text-[#94A3B8]">
            <i className="fa-solid fa-image" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="min-w-0 text-xs">
        {problem ? (
          <p className="font-medium text-[#B91C1C]">{problem}</p>
        ) : state === 'failed' ? (
          <p className="font-medium text-[#B91C1C]">
            This link doesn&apos;t load as an image. Members will see the branded placeholder instead.
          </p>
        ) : state === 'loaded' ? (
          <p className="font-medium text-emerald-700">
            <i className="fa-solid fa-circle-check me-1" aria-hidden="true" />
            Image loads correctly.
          </p>
        ) : (
          <p className="text-[#94A3B8]">Checking image…</p>
        )}
        {normalized !== url.trim() && (
          <p className="mt-1 break-all text-[#94A3B8]" dir="ltr">
            Will be saved as: {normalized}
          </p>
        )}
      </div>
    </div>
  )
}
