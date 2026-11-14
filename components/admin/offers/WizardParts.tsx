'use client'

import { useMemo, useState } from 'react'
import { useAdminT, type AdminKey } from '@/lib/admin/translations'
import BidiText from '@/components/admin/BidiText'
import { StoresField } from '@/components/admin/OfferFormFields'
import { SearchInput } from '@/components/admin/ListToolbar'
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_SELECT, ADMIN_LABEL, SECONDARY_BUTTON } from '@/components/admin/formStyles'
import { BUSINESS_CATEGORIES } from '@/lib/categories'
import type { PerkScope } from '@/lib/offers/perkScope'
import type { ParticipatingPlace } from '@/lib/geo'
import { PAYMENT_TERMS, paymentTermsDays, type PaymentTerms } from '@/lib/merchants/terms'

export type Fulfillment = 'direct_merchant' | 'multipass_pool'

export interface WizardBusiness {
  uid: string
  businessName: string
  businessId: string
  category: string
  commissionRate: number | null
  paymentTerms: PaymentTerms | null
}

const STEP_KEYS = ['wizard.step1', 'wizard.step2', 'wizard.step3', 'wizard.step4'] as const satisfies readonly AdminKey[]

/** The four steps as numbered nodes on a line from md; a "Step n of 4" bar on phones. */
export function WizardStepper({ step, maxReached, onGo }: { step: number; maxReached: number; onGo: (step: number) => void }) {
  const { t } = useAdminT()
  return (
    <nav aria-label={t('wizard.steps')} className="mb-6">
      <p className="mb-2 text-sm font-semibold text-[#0B1B3D] md:hidden">
        {t('wizard.stepOf', { n: step, total: STEP_KEYS.length })} · {t(STEP_KEYS[step - 1]!)}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 md:hidden" aria-hidden="true">
        <div className="h-full rounded-full bg-[#0038B8] transition-[width] duration-300" style={{ width: `${(step / STEP_KEYS.length) * 100}%` }} />
      </div>
      <ol className="hidden items-center md:flex">
        {STEP_KEYS.map((key, i) => {
          const n = i + 1
          const current = n === step
          const reachable = n <= maxReached
          return (
            <li key={key} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                disabled={!reachable}
                aria-current={current ? 'step' : undefined}
                onClick={() => onGo(n)}
                className="flex min-h-11 items-center gap-3 rounded-xl pe-3 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8] disabled:cursor-default"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    current ? 'bg-[#0038B8] text-white shadow-sm shadow-[#0038B8]/25' : n < step ? 'bg-emerald-600 text-white' : 'border border-[#CBD5E1] bg-white text-[#64748B]'
                  }`}
                >
                  {n < step ? <i className="fa-solid fa-check text-xs" aria-hidden="true" /> : <bdi dir="ltr">{n}</bdi>}
                </span>
                <span className={`text-sm font-semibold ${current ? 'text-[#0B1B3D]' : 'text-[#475569]'}`}>{t(key)}</span>
              </button>
              {n < STEP_KEYS.length && <span className={`mx-2 h-px flex-1 ${n < step ? 'bg-emerald-600' : 'bg-[#E2E8F0]'}`} aria-hidden="true" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** Pick one business from a searchable list, or show the chosen one with a Change button. */
export function BusinessPicker({
  businesses,
  selected,
  onSelect,
}: {
  businesses: WizardBusiness[] | null
  selected: WizardBusiness | null
  onSelect: (uid: string | null) => void
}) {
  const { t, tn, dir } = useAdminT()
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    if (!businesses) return []
    const q = search.trim().toLowerCase()
    return q ? businesses.filter((b) => b.businessName.toLowerCase().includes(q) || b.businessId.toLowerCase().includes(q)) : businesses
  }, [businesses, search])

  if (selected) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-[#0038B8]/20 bg-[#F0F7FF] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <BidiText lines={2} className="font-semibold text-[#0B1B3D]">{selected.businessName}</BidiText>
          <div className="text-xs text-[#475569]"><bdi dir="ltr">{selected.businessId}</bdi></div>
        </div>
        <button type="button" className={SECONDARY_BUTTON} onClick={() => onSelect(null)}>
          {t('common.change')}
        </button>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <SearchInput label={t('wizard.searchBusiness')} placeholder={t('wizard.searchBusinessPlaceholder')} value={search} onChange={setSearch} />
      <div className="max-h-80 overflow-y-auto overscroll-y-contain rounded-xl border border-[#E2E8F0]" role="group" aria-label={t('wizard.businessesLabel')}>
        {businesses === null ? (
          <p className="px-4 py-3 text-sm text-[#64748B]">{t('wizard.loadingBusinesses')}</p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-3 text-sm text-[#64748B]">{t('wizard.noBusinesses')}</p>
        ) : (
          <ul className="divide-y divide-[#E2E8F0]">
            {filtered.map((b) => (
              <li key={b.uid}>
                <button
                  type="button"
                  onClick={() => onSelect(b.uid)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2.5 text-start transition-colors hover:bg-[#F8FAFC] focus-visible:bg-[#F0F7FF] focus-visible:outline-none"
                >
                  <span className="min-w-0">
                    <BidiText lines={2} className="font-semibold text-[#0B1B3D]">{b.businessName}</BidiText>
                    <span className="block text-xs text-[#64748B]"><bdi dir="ltr">{b.businessId}</bdi></span>
                  </span>
                  <i className={`fa-solid fa-chevron-right text-xs text-[#CBD5E1] ${dir === 'rtl' ? '-scale-x-100' : ''}`} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {businesses !== null && filtered.length > 0 && <p className="text-xs text-[#64748B]">{tn('wizard.businessCount', filtered.length)}</p>}
    </div>
  )
}

/** Direct local merchant or Multipass wholesale pool, as two large radio cards. */
export function FulfillmentPicker({ value, onChange }: { value: Fulfillment; onChange: (value: Fulfillment) => void }) {
  const { t } = useAdminT()
  const options: { value: Fulfillment; icon: string; title: AdminKey; hint: AdminKey }[] = [
    { value: 'direct_merchant', icon: 'fa-store', title: 'wizard.fulfillmentDirect', hint: 'wizard.fulfillmentDirectHint' },
    { value: 'multipass_pool', icon: 'fa-boxes-stacked', title: 'wizard.fulfillmentMultipass', hint: 'wizard.fulfillmentMultipassHint' },
  ]
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#64748B]">{t('wizard.fulfillment')}</legend>
      <div role="radiogroup" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const selected = value === option.value
          return (
            <label
              key={option.value}
              className={`flex min-h-24 cursor-pointer items-start gap-3 rounded-2xl border px-4 py-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#0038B8] ${
                selected ? 'border-[#0038B8] bg-[#F0F7FF]' : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]'
              }`}
            >
              <input type="radio" name="fulfillment" value={option.value} checked={selected} onChange={() => onChange(option.value)} className="sr-only" />
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${selected ? 'bg-[#0038B8] text-white' : 'bg-[#F1F5F9] text-[#475569]'}`}>
                <i className={`fa-solid ${option.icon} text-sm`} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#0B1B3D]">{t(option.title)}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[#475569]">{t(option.hint)}</span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export function termsLabel(t: ReturnType<typeof useAdminT>['t'], terms: PaymentTerms) {
  const days = paymentTermsDays(terms)
  return days === 0 ? t('wizard.termsImmediate') : t('wizard.termsDays', { n: days })
}

/** Commission (%) and payment terms of the chosen business; saved with the offer only when changed. */
export function TermsFields({
  commission,
  paymentTerms,
  onCommission,
  onPaymentTerms,
}: {
  commission: string
  paymentTerms: PaymentTerms | ''
  onCommission: (value: string) => void
  onPaymentTerms: (value: PaymentTerms | '') => void
}) {
  const { t } = useAdminT()
  return (
    <fieldset className="min-w-0">
      <legend className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#64748B]">{t('wizard.commission')} · {t('wizard.paymentTerms')}</legend>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="wiz-commission" className={ADMIN_LABEL}>{t('wizard.commission')}</label>
          <div className="relative" dir="ltr">
            <input
              id="wiz-commission"
              type="number"
              inputMode="decimal"
              min={0}
              max={50}
              step="0.5"
              className={`${ADMIN_INPUT} pe-10 tabular-nums`}
              value={commission}
              onChange={(e) => onCommission(e.target.value)}
            />
            <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-[#64748B]" aria-hidden="true">%</span>
          </div>
          <p className={ADMIN_HINT}>{t('wizard.commissionHint')}</p>
        </div>
        <div>
          <label htmlFor="wiz-terms" className={ADMIN_LABEL}>{t('wizard.paymentTerms')}</label>
          <select id="wiz-terms" value={paymentTerms} onChange={(e) => onPaymentTerms(e.target.value as PaymentTerms | '')} className={ADMIN_SELECT}>
            <option value="">{t('wizard.termsUnset')}</option>
            {PAYMENT_TERMS.map((terms) => (
              <option key={terms} value={terms}>{termsLabel(t, terms)}</option>
            ))}
          </select>
        </div>
      </div>
    </fieldset>
  )
}

export interface MultipassScopeValue {
  perkScope: PerkScope
  brandName: string
  chains: string[]
  /** Branches picked from Google Places (a single-brand Multipass perk); `chains` lists their names too. */
  places: ParticipatingPlace[]
  guideHe: string
  guideEn: string
  category: string
}

export const EMPTY_MULTIPASS_SCOPE: MultipassScopeValue = { perkScope: 'single_business', brandName: '', chains: [], places: [], guideHe: '', guideEn: '', category: '' }

/** A local perk of one business, or a multi-chain / multi-brand pass with an issuer and no business, as two radio cards. */
export function DirectScopePicker({ chain, onChange }: { chain: boolean; onChange: (chain: boolean) => void }) {
  const { t } = useAdminT()
  const options: { chain: boolean; icon: string; title: AdminKey; hint: AdminKey }[] = [
    { chain: false, icon: 'fa-store', title: 'wizard.directScopeSingle', hint: 'wizard.directScopeSingleHint' },
    { chain: true, icon: 'fa-network-wired', title: 'wizard.directScopeChain', hint: 'wizard.directScopeChainHint' },
  ]
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#64748B]">{t('wizard.directScope')}</legend>
      <div role="radiogroup" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const selected = chain === option.chain
          return (
            <label
              key={String(option.chain)}
              className={`flex min-h-24 cursor-pointer items-start gap-3 rounded-2xl border px-4 py-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#0038B8] ${
                selected ? 'border-[#0038B8] bg-[#F0F7FF]' : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]'
              }`}
            >
              <input type="radio" name="direct-scope" checked={selected} onChange={() => onChange(option.chain)} className="sr-only" />
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${selected ? 'bg-[#0038B8] text-white' : 'bg-[#F1F5F9] text-[#475569]'}`}>
                <i className={`fa-solid ${option.icon} text-sm`} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#0B1B3D]">{t(option.title)}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[#475569]">{t(option.hint)}</span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/** The Multipass scope choice: one brand or store, or a voucher honoured by several chains. Replaces the business picker's place in step 1. */
export function MultipassScopePicker({ value, onChange }: { value: PerkScope; onChange: (next: PerkScope) => void }) {
  const { t } = useAdminT()
  const options: { value: PerkScope; icon: string; title: AdminKey; hint: AdminKey }[] = [
    { value: 'single_business', icon: 'fa-store', title: 'wizard.scopeSingle', hint: 'wizard.scopeSingleHint' },
    { value: 'multi_chain', icon: 'fa-network-wired', title: 'wizard.scopeMulti', hint: 'wizard.scopeMultiHint' },
  ]
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 text-[13px] font-semibold text-[#475569]">{t('wizard.scope')}</legend>
      <div role="radiogroup" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const on = value === option.value
          return (
            <label
              key={option.value}
              className={`flex min-h-20 cursor-pointer items-start gap-3 rounded-2xl border px-4 py-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#0038B8] ${on ? 'border-[#0038B8] bg-[#F0F7FF]' : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]'}`}
            >
              <input type="radio" name="perk-scope" value={option.value} checked={on} onChange={() => onChange(option.value)} className="sr-only" />
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${on ? 'bg-[#0038B8] text-white' : 'bg-[#F1F5F9] text-[#475569]'}`}>
                <i className={`fa-solid ${option.icon} text-sm`} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#0B1B3D]">{t(option.title)}</span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-[#475569]">{t(option.hint)}</span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/** A Multipass perk's own details in place of a business: brand, category, and for a multi-chain voucher its chains and the shared redemption guide. */
export function MultipassPerkFields({ value, onChange }: { value: MultipassScopeValue; onChange: (next: MultipassScopeValue) => void }) {
  const { t } = useAdminT()
  const set = <K extends keyof MultipassScopeValue>(key: K, v: MultipassScopeValue[K]) => onChange({ ...value, [key]: v })
  const multi = value.perkScope === 'multi_chain'
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="wiz-brand" className={ADMIN_LABEL}>{t('wizard.brandName')}</label>
          <input id="wiz-brand" required maxLength={80} dir="auto" autoComplete="off" className={ADMIN_INPUT} value={value.brandName} onChange={(e) => set('brandName', e.target.value)} />
          <p className={ADMIN_HINT}>{multi ? t('wizard.brandNameMultiHint') : t('wizard.brandNameHint')}</p>
        </div>
        <div>
          <label htmlFor="wiz-category" className={ADMIN_LABEL}>{t('wizard.category')}</label>
          <select id="wiz-category" required className={ADMIN_SELECT} value={value.category} onChange={(e) => set('category', e.target.value)}>
            <option value="">{t('wizard.pickCategory')}</option>
            {BUSINESS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <StoresField
        mode={multi ? 'chains' : 'multipass'}
        chains={value.chains}
        places={multi ? [] : value.places}
        onChange={(next) => onChange({ ...value, chains: next.chains, places: next.places })}
      />
      {multi && (
        <>
          <fieldset className="min-w-0">
            <legend className="mb-3 text-[13px] font-semibold text-[#475569]">{t('wizard.guideTitle')}</legend>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="wiz-guide-he" className={ADMIN_LABEL}>{t('wizard.guideHe')}</label>
                <textarea id="wiz-guide-he" rows={4} maxLength={1000} dir="rtl" className={ADMIN_INPUT} value={value.guideHe} onChange={(e) => set('guideHe', e.target.value)} />
              </div>
              <div>
                <label htmlFor="wiz-guide-en" className={ADMIN_LABEL}>{t('wizard.guideEn')}</label>
                <textarea id="wiz-guide-en" rows={4} maxLength={1000} dir="ltr" className={ADMIN_INPUT} value={value.guideEn} onChange={(e) => set('guideEn', e.target.value)} />
              </div>
            </div>
            <p className={ADMIN_HINT}>{t('wizard.guideHint')}</p>
          </fieldset>
        </>
      )}
    </div>
  )
}
