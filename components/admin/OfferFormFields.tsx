'use client'

import Switch from '@/components/admin/Switch'
import { useEffect, useId, useState } from 'react'
import { DEFAULT_VOUCHER_VALIDITY_DAYS, MAX_REDEMPTION_TERMS_LENGTH, MAX_VOUCHER_VALIDITY_DAYS } from '@/lib/payments/voucherTerms'
import { imageUrlProblem, normalizeImageUrl } from '@/lib/offers/imageUrl'
import {
  DEFAULT_REDEMPTION_METHOD,
  MAX_REDEMPTION_INSTRUCTIONS_LENGTH,
  REDEMPTION_METHODS,
  type RedemptionMethod,
} from '@/lib/offers/redemption'
import type { OfferTranslations, TranslationOverrides } from '@/lib/offers/offerText'
import ChipsInput from './ChipsInput'
import BranchPlacesPicker, { type BranchesValue } from './BranchPlacesPicker'
import { placeChainName, type ParticipatingPlace } from '@/lib/geo'
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL } from './formStyles'
import ImageUploadField from './ImageUploadField'
import { useAdminT, type AdminKey } from '@/lib/admin/translations'
import OfferTranslationsEditor from './OfferTranslationsEditor'
import { directionalProps } from '@/lib/directionalInput'

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
  /** A direct-merchant chain redeemable across its branches: hides the offer's single address and Waze / Maps buttons. */
  isNationwide: boolean
  /** The stores (or chains) that honour a nationwide or Multipass offer; empty means every store. */
  participatingChains: string[]
  /** The branches picked from Google Places; `participatingChains` lists their names too, plus any typed names. */
  participatingPlaces: ParticipatingPlace[]
  /** A perk with no business: the issuer's name, and for a multi-chain pass the guide on how to redeem it at any chain. */
  brandName: string
  guideHe: string
  guideEn: string
  validityDays: string
  redemptionTerms: string
  redemptionMethod: RedemptionMethod
  redemptionInstructions: string
  /** The admin's own translations (lib/offers/offerText.ts); everything else is Google's. */
  translationOverrides: TranslationOverrides
}

/** A new offer's translations: none of the admin's own yet. */
export const EMPTY_OFFER_TRANSLATIONS = { translationOverrides: {} as TranslationOverrides }

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

const METHOD_ICONS: Record<RedemptionMethod, string> = { in_store: 'fa-store', online: 'fa-globe', phone_booking: 'fa-phone' }

/**
 * The form's parts, one per tab of the offer forms (FormTabs.tsx): the text,
 * the image, prices and availability, how it's redeemed and its terms, and
 * the translations. Without `section`, every part in one column.
 */
export type OfferFormSection = 'basics' | 'media' | 'pricing' | 'commercial' | 'inventory' | 'terms' | 'translations'

/** The offer forms' tabs, in order. */
export const offerFormTabs = (t: (key: AdminKey) => string) => [
  { id: 'basics', label: t('form.tab.basics'), icon: 'fa-pen' },
  { id: 'media', label: t('form.tab.media'), icon: 'fa-image' },
  { id: 'pricing', label: t('form.tab.pricing'), icon: 'fa-shekel-sign' },
  { id: 'terms', label: t('form.tab.terms'), icon: 'fa-ticket' },
  { id: 'translations', label: t('form.tab.translations'), icon: 'fa-language' },
] as const satisfies readonly { id: OfferFormSection; label: string; icon: string }[]

interface Props {
  value: OfferFormValue
  onChange: <K extends keyof OfferFormValue>(key: K, value: OfferFormValue[K]) => void
  /** The offer's stored translations (edit form), to show Google's wording; none for a new offer. */
  translations?: OfferTranslations | null
  section?: OfferFormSection
  /** A Multipass offer's stock is its pool, so the quantity fields are left out. */
  poolManaged?: boolean
  /** The nationwide switch, for a local-business offer being edited (the new-offer wizard puts it in its channel step). */
  showNationwide?: boolean
  /** The list of participating stores or chains: for a nationwide local offer, an optional Multipass one, or a multi-chain voucher's chains; none to leave it out. */
  storesField?: StoresMode
  /** The issuer's name (a Multipass or multi-chain perk), and with 'chain' the redemption guide too; none for a perk of a business. */
  issuerFields?: 'brand' | 'chain'
}

const CHECKBOX_ROW =
  'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white px-4 text-sm font-semibold text-[#0B1B3D] transition-colors hover:bg-[#F8FAFC] has-[:checked]:border-[#0038B8]/40 has-[:checked]:bg-[#F0F7FF]'

function Group({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#64748B]">{legend}</legend>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

function PriceInput({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative" dir="ltr">
      <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-base font-medium text-[#64748B]" aria-hidden="true">
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

/** Hides the offer's single address and navigation buttons; a Multipass perk does this on its own, so it has no switch. */
export function NationwideField({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const { t } = useAdminT()
  return (
    <div>
      <label className={CHECKBOX_ROW}>
        <Switch checked={checked} onChange={onChange} />
        <i className="fa-solid fa-globe text-xs text-[#0038B8]" aria-hidden="true" />
        {t('form.nationwide')}
      </label>
      <p className={ADMIN_HINT}>{t('form.nationwideHint')}</p>
    </div>
  )
}

/** The stores or chains that honour the offer. Empty means every store. */
export type StoresMode = 'nationwide' | 'multipass' | 'chains'

export function StoresField({ mode, chains, places, onChange }: { mode: StoresMode; chains: string[]; places: ParticipatingPlace[]; onChange: (next: { chains: string[]; places: ParticipatingPlace[] }) => void }) {
  const { t } = useAdminT()
  // A multi-chain pass lists brands (FOX, Castro), which are typed and kept exactly as written.
  if (mode === 'chains') {
    return (
      <ChipsInput
        id="offer-stores"
        label={t('wizard.chains')}
        hint={t('wizard.chainsHint')}
        placeholder={t('wizard.chainsPlaceholder')}
        value={chains}
        onChange={(next) => onChange({ chains: next, places: [] })}
      />
    )
  }
  return (
    <BranchPlacesPicker
      id="offer-stores"
      label={mode === 'multipass' ? t('form.storesMultipass') : t('form.stores')}
      value={branchesOf(chains, places)}
      onChange={(next) => onChange(chainsOf(next))}
    />
  )
}

/** The picker's view of the form's two lists: the picked branches, and the chain names that are not one of them. */
export function branchesOf(chains: string[], places: ParticipatingPlace[]): BranchesValue {
  const picked = new Set(places.map((place) => placeChainName(place).toLowerCase()))
  return { places, typed: chains.filter((name) => !picked.has(name.toLowerCase())) }
}

/** The form's two lists from the picker's value; the server derives the same chain names when it saves. */
export function chainsOf({ places, typed }: BranchesValue): { chains: string[]; places: ParticipatingPlace[] } {
  return { chains: [...places.map(placeChainName), ...typed], places }
}

export default function OfferFormFields({ value, onChange, translations, section, poolManaged = false, showNationwide = false, storesField, issuerFields }: Props) {
  const { t, dir: uiDir } = useAdminT()
  const id = useId()
  const field = (name: string) => `${id}-${name}`
  const show = (part: OfferFormSection) => !section || section === part
  // The edit form's single "pricing" tab holds both halves; the wizard splits them into its steps.
  const showPrice = show('pricing') || show('commercial')
  const showAvailability = show('pricing') || show('inventory')

  return (
    <div className="space-y-8">
      {show('basics') && (
        <Group legend={t('form.details')}>
          {issuerFields && (
            <div className="sm:col-span-2">
              <label htmlFor={field('brandName')} className={ADMIN_LABEL}>{t('wizard.brandName')}</label>
              <input id={field('brandName')} required maxLength={80} dir="auto" autoComplete="off" className={ADMIN_INPUT} value={value.brandName} onChange={(e) => onChange('brandName', e.target.value)} />
              <p className={ADMIN_HINT}>{t('form.brandEditHint')}</p>
            </div>
          )}
          <div className="sm:col-span-2">
            <label htmlFor={field('title')} className={ADMIN_LABEL}>{t('form.title')}</label>
            <input id={field('title')} required dir="auto" className={ADMIN_INPUT} value={value.title} onChange={(e) => onChange('title', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={field('description')} className={ADMIN_LABEL}>{t('form.description')}</label>
            <textarea
              id={field('description')}
              dir="auto"
              className={`${ADMIN_INPUT} resize-y`}
              rows={3}
              value={value.description}
              onChange={(e) => onChange('description', e.target.value)}
            />
          </div>
          {issuerFields === 'chain' && (
            <>
              <div>
                <label htmlFor={field('guideHe')} className={ADMIN_LABEL}>{t('wizard.guideHe')}</label>
                <textarea id={field('guideHe')} rows={4} maxLength={1000} dir="rtl" className={ADMIN_INPUT} value={value.guideHe} onChange={(e) => onChange('guideHe', e.target.value)} />
              </div>
              <div>
                <label htmlFor={field('guideEn')} className={ADMIN_LABEL}>{t('wizard.guideEn')}</label>
                <textarea id={field('guideEn')} rows={4} maxLength={1000} dir="ltr" className={ADMIN_INPUT} value={value.guideEn} onChange={(e) => onChange('guideEn', e.target.value)} />
              </div>
              <p className={`${ADMIN_HINT} sm:col-span-2`}>{t('wizard.guideHint')}</p>
            </>
          )}
        </Group>
      )}

      {show('media') && (
        <Group legend={t('form.image')}>
          <div className="sm:col-span-2">
            <ImageUploadField
              value={value.imageUrl}
              onChange={(url) => onChange('imageUrl', url)}
              linkInput={
                <>
                  <label htmlFor={field('imageUrl')} className={ADMIN_LABEL}>{t('form.imageUrl')}</label>
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
                </>
              }
            />
          </div>
        </Group>
      )}

      {showPrice && (
        <>
          <Group legend={t('form.pricing')}>
            <div>
              <label htmlFor={field('originalPrice')} className={ADMIN_LABEL}>{t('form.originalPrice')}</label>
              <PriceInput id={field('originalPrice')} value={value.originalPrice} onChange={(v) => onChange('originalPrice', v)} />
            </div>
            <div>
              <label htmlFor={field('offerPrice')} className={ADMIN_LABEL}>{t('form.offerPrice')}</label>
              <PriceInput id={field('offerPrice')} value={value.offerPrice} onChange={(v) => onChange('offerPrice', v)} />
            </div>
          </Group>
        </>
      )}

      {showAvailability && (
        <>
          <Group legend={t('form.availability')}>
            <div>
              <label htmlFor={field('expiryDate')} className={ADMIN_LABEL}>{t('form.expiry')}</label>
              <input id={field('expiryDate')} type="date" dir="ltr" className={ADMIN_INPUT} value={value.expiryDate} onChange={(e) => onChange('expiryDate', e.target.value)} />
              <p className={ADMIN_HINT}>{t('form.expiryHint')}</p>
            </div>
            {poolManaged ? (
              <p className="sm:col-span-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#475569]">{t('form.poolManaged')}</p>
            ) : (
              <>
            <div>
              <label htmlFor={field('totalQuantity')} className={ADMIN_LABEL}>{t('form.totalQuantity')}</label>
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
              <p className={ADMIN_HINT}>{t('form.totalQuantityHint')}</p>
            </div>
            <label className={CHECKBOX_ROW}>
              <Switch checked={value.unlimited} onChange={(v) => onChange('unlimited', v)} />
              {t('form.unlimited')}
            </label>
              </>
            )}
            <label className={CHECKBOX_ROW}>
              <Switch checked={value.isBestseller} onChange={(v) => onChange('isBestseller', v)} />
              <i className="fa-solid fa-star text-xs text-amber-500" aria-hidden="true" />
              {t('form.bestseller')}
            </label>
            {showNationwide && !poolManaged && (
              <div className="sm:col-span-2">
                <NationwideField checked={value.isNationwide} onChange={(v) => onChange('isNationwide', v)} />
              </div>
            )}
            {storesField && (
              <div className="sm:col-span-2">
                <StoresField mode={storesField} chains={value.participatingChains} places={value.participatingPlaces} onChange={(next) => { onChange('participatingChains', next.chains); onChange('participatingPlaces', next.places) }} />
              </div>
            )}
          </Group>
        </>
      )}

      {show('terms') && (
        <>
          <fieldset className="min-w-0">
            <legend className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#64748B]">{t('form.redeemHow')}</legend>
            <div role="radiogroup" aria-label={t('form.redemptionMethod')} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {REDEMPTION_METHODS.map((method) => {
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
                      <i className={`fa-solid ${METHOD_ICONS[method]} text-sm`} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[#0B1B3D]">{t(`form.method.${method}` as AdminKey)}</span>
                      <span className="block text-xs text-[#64748B]">{t(`form.method.${method}.hint` as AdminKey)}</span>
                    </span>
                  </label>
                )
              })}
            </div>
            <div className="mt-5">
              <label htmlFor={field('redemptionInstructions')} className={ADMIN_LABEL}>
                {t('form.instructions')} <span className="font-normal text-[#64748B]">{t('form.optional')}</span>
              </label>
              <textarea
                id={field('redemptionInstructions')}
                {...directionalProps(value.redemptionInstructions, t('form.instructionsPlaceholder'), uiDir === 'rtl')}
                className={`${ADMIN_INPUT} resize-y`}
                rows={3}
                maxLength={MAX_REDEMPTION_INSTRUCTIONS_LENGTH}
                placeholder={t('form.instructionsPlaceholder')}
                aria-describedby={field('redemptionInstructions-hint')}
                value={value.redemptionInstructions}
                onChange={(e) => onChange('redemptionInstructions', e.target.value)}
              />
              <p id={field('redemptionInstructions-hint')} className={ADMIN_HINT}>
                {t('form.instructionsHint')}
              </p>
            </div>
          </fieldset>

          <Group legend={t('form.voucherTerms')}>
            <div className="sm:col-span-2 sm:max-w-xs">
              <label htmlFor={field('validityDays')} className={ADMIN_LABEL}>{t('form.validFor')}</label>
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
                <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-sm text-[#64748B]" aria-hidden="true">
                  {t('form.days')}
                </span>
              </div>
              <p className={ADMIN_HINT}>{t('form.validHint')}</p>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor={field('redemptionTerms')} className={ADMIN_LABEL}>{t('form.redemptionTerms')}</label>
              <textarea
                id={field('redemptionTerms')}
                {...directionalProps(value.redemptionTerms, t('form.termsPlaceholder'), uiDir === 'rtl')}
                className={`${ADMIN_INPUT} resize-y`}
                rows={3}
                maxLength={MAX_REDEMPTION_TERMS_LENGTH}
                placeholder={t('form.termsPlaceholder')}
                value={value.redemptionTerms}
                onChange={(e) => onChange('redemptionTerms', e.target.value)}
              />
              <p className={ADMIN_HINT} dir="ltr">
                {value.redemptionTerms.length}/{MAX_REDEMPTION_TERMS_LENGTH}
              </p>
            </div>
          </Group>
        </>
      )}

      {show('translations') && (
        <OfferTranslationsEditor
          source={{
            title: value.title,
            description: value.description,
            redemptionTerms: value.redemptionTerms,
            redemptionInstructions: value.redemptionInstructions,
          }}
          stored={translations}
          overrides={value.translationOverrides}
          onChange={(next) => onChange('translationOverrides', next)}
        />
      )}
    </div>
  )
}

type PreviewState = 'idle' | 'loading' | 'loaded' | 'failed'

/**
 * What members will see: the link as it will be saved (wrappers unwrapped)
 * and whether it actually loads as an image. A preview, not a gate -- the
 * server does its own checks on save.
 */
export function ImagePreview({ url, shape = 'banner' }: { url: string; shape?: 'banner' | 'logo' }) {
  const logo = shape === 'logo'
  const normalized = normalizeImageUrl(url)
  const problem = normalized ? imageUrlProblem(normalized) : null
  const [state, setState] = useState<PreviewState>('idle')

  useEffect(() => {
    setState(normalized && !problem ? 'loading' : 'idle')
  }, [normalized, problem])

  if (!normalized) return null

  return (
    <div className="mt-3 flex items-start gap-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3" aria-live="polite">
      <div
        className={`relative shrink-0 overflow-hidden ${
          logo ? 'h-20 w-20 rounded-2xl border border-black/[0.06] bg-white p-2 shadow-sm' : 'h-20 w-28 rounded-lg bg-gradient-to-br from-[#F0F7FF] to-[#E2E8F0]'
        }`}
      >
        {!problem && state !== 'failed' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={normalized}
            src={normalized}
            alt=""
            className={`h-full w-full ${logo ? 'object-contain' : 'object-cover'} transition-opacity ${state === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setState('loaded')}
            onError={() => setState('failed')}
          />
        )}
        {(problem || state === 'failed') && (
          <div className="absolute inset-0 flex items-center justify-center text-[#64748B]">
            <i className="fa-solid fa-image" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="min-w-0 text-xs">
        {problem ? (
          <p className="font-medium text-[#B91C1C]">{problem}</p>
        ) : state === 'failed' ? (
          <p className="font-medium text-[#B91C1C]">
            This link doesn&apos;t load as an image. Members will see {logo ? 'the business’s initial' : 'the branded placeholder'} instead.
          </p>
        ) : state === 'loaded' ? (
          <p className="font-medium text-emerald-700">
            <i className="fa-solid fa-circle-check me-1" aria-hidden="true" />
            {logo ? 'Logo' : 'Image'} loads correctly.
          </p>
        ) : (
          <p className="text-[#64748B]">Checking image…</p>
        )}
        {normalized !== url.trim() && (
          <p className="mt-1 break-all text-[#64748B]" dir="ltr">
            Will be saved as: {normalized}
          </p>
        )}
      </div>
    </div>
  )
}
