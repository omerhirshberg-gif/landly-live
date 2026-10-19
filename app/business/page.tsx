'use client'

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import Navbar from '@/components/layout/Navbar'
import Notice from '@/components/auth/entrance/Notice'
import CountUp from '@/components/ui/CountUp'
import Reveal from '@/components/ui/Reveal'
import SectionDivider from '@/components/ui/SectionDivider'
import { BUSINESS_CATEGORIES, type BusinessCategory } from '@/lib/business/inquiryCategories'
import { CATEGORY_TILES } from '@/lib/categories'
import { CUSTOMER_TYPES, OTHER_CUSTOMER_TYPE } from '@/lib/customerTypes'
import { getAllOffers } from '@/lib/firebase/offers'
import { LANGUAGES } from '@/lib/i18n/languages'
import { useLang } from '@/lib/i18n/useLang'
import type { TranslationKey } from '@/lib/i18n/translations'

const EMPTY_FIELDS = { businessName: '', category: '', contactName: '', phone: '', email: '', message: '', website: '' }

const BENEFITS: { icon: string; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { icon: 'fa-bullseye', titleKey: 'biz_page_card1_title', descKey: 'biz_page_card1_desc' },
  { icon: 'fa-chart-line', titleKey: 'biz_page_card2_title', descKey: 'biz_page_card2_desc' },
  { icon: 'fa-comments', titleKey: 'biz_page_card3_title', descKey: 'biz_page_card3_desc' },
]

// Landly today, for a partner deciding: facts about the product only (the
// live perks, its categories, languages and the member types it serves; "Other"
// isn't one), never revenue or audience figures we don't have.
const STATIC_STATS: { icon: string; value: number; labelKey: TranslationKey }[] = [
  { icon: 'fa-layer-group', value: CATEGORY_TILES.length, labelKey: 'biz_stat_categories' },
  { icon: 'fa-language', value: LANGUAGES.length, labelKey: 'biz_stat_languages' },
  { icon: 'fa-users', value: CUSTOMER_TYPES.filter((c) => c.value !== OTHER_CUSTOMER_TYPE).length, labelKey: 'biz_stat_segments' },
]
const statCard = 'flex basis-[calc(50%-6px)] lg:basis-[calc(25%-12px)] flex-col items-center rounded-2xl border border-slate-200/80 bg-white p-5 text-center shadow-sm'

// Dropdown labels reuse the customer-facing category names (lib/categories.ts);
// "Other" is the one inquiry-only option.
const CATEGORY_LABEL_KEYS = Object.fromEntries(
  BUSINESS_CATEGORIES.map((c) => [c, CATEGORY_TILES.find((tile) => tile.category === c)?.labelKey ?? 'biz_form_cat_other'])
) as Record<BusinessCategory, TranslationKey>

export default function BusinessPage() {
  const { t } = useLang()
  const [fields, setFields] = useState(EMPTY_FIELDS)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sent'>('idle')
  // Live perks on Landly right now: null while loading; the tile steps aside at 0.
  const [livePerks, setLivePerks] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    getAllOffers()
      .then((offers) => { if (!cancelled) setLivePerks(offers.length) })
      .catch(() => { if (!cancelled) setLivePerks(0) })
    return () => { cancelled = true }
  }, [])
  // A key rather than text, so an error already on screen follows a language switch.
  const [error, setError] = useState<TranslationKey | null>(null)

  const update = (key: keyof typeof EMPTY_FIELDS) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setFields((prev) => ({ ...prev, [key]: e.target.value }))
      if (status === 'sent') setStatus('idle')
    }

  // POSTs to /api/business/inquiry, which emails team.landly@gmail.com with
  // Reply-To set to the lead. Inputs are only cleared once the send succeeds.
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setError(null)
    setStatus('idle')
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/business/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
        signal: AbortSignal.timeout(20_000),
      })
      if (res.status === 429) return setError('biz_form_rate_limited')
      if (res.status === 400) return setError('biz_form_invalid')
      if (!res.ok) throw new Error('request failed')
      setFields(EMPTY_FIELDS)
      setStatus('sent')
    } catch {
      setError('biz_form_error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Navbar />
      <div className="below-header member-canvas">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
          <div className="text-center mb-10 sm:mb-12">
            <span aria-hidden="true" className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-[0_10px_24px_-8px_rgba(0,56,184,.55)]">
              <i className="fa-solid fa-handshake text-xl"></i>
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-ink mb-4" style={{ letterSpacing: '-0.02em' }}>{t('biz_page_title')}</h1>
            <p className="text-body max-w-xl mx-auto leading-relaxed text-[15px] sm:text-base">{t('biz_page_intro')}</p>
          </div>

          {/* A soft hairline between each block, as on the home page. */}
          <SectionDivider className="mb-10 sm:mb-12" />

          {/* Value pillars: numbered, lifting on hover with a real pointer. */}
          <div className="grid sm:grid-cols-3 gap-4 sm:gap-5 mb-10 sm:mb-12">
            {BENEFITS.map((b, i) => (
              <Reveal key={b.titleKey} delay={i * 60} className="h-full">
                <div className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 text-start shadow-sm transition-[transform,box-shadow,border-color] duration-200 [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:border-brand/25 [@media(hover:hover)]:hover:shadow-md motion-reduce:transition-none motion-reduce:[@media(hover:hover)]:hover:translate-y-0">
                  <span className="flex items-center justify-between gap-3 mb-4">
                    <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-brandTint text-brand ring-1 ring-inset ring-brand/10">
                      <i className={`fa-solid ${b.icon} text-base`}></i>
                    </span>
                    <span aria-hidden="true" className="font-display text-2xl font-extrabold text-slate-200 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  </span>
                  <h3 className="font-bold text-ink mb-2">{t(b.titleKey)}</h3>
                  <p className="text-sm leading-relaxed text-body">{t(b.descKey)}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <SectionDivider className="mb-10 sm:mb-12" />

          {/* Landly today: real product facts, counting up as they're reached. */}
          <section aria-labelledby="biz-stats-title" className="mb-10 sm:mb-12">
            <h2 id="biz-stats-title" className="text-center text-xl sm:text-2xl font-black text-ink mb-5">{t('biz_stats_title')}</h2>
            <dl className="flex flex-wrap justify-center gap-3 lg:gap-4">
              {livePerks !== 0 && (
                <div className={statCard}>
                  <dt className="order-2 mt-1 text-sm leading-snug text-body">{t('biz_stat_perks')}</dt>
                  <dd className="order-1 flex flex-col items-center">
                    <span aria-hidden="true" className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-[#ECFDF5] text-[#047857]"><i className="fa-solid fa-bolt text-sm"></i></span>
                    {livePerks === null ? (
                      <span aria-hidden="true" className="my-1.5 h-7 w-12 rounded-lg bg-slate-100 animate-pulse motion-reduce:animate-none" />
                    ) : (
                      <CountUp value={livePerks} className="font-display text-3xl sm:text-4xl font-extrabold text-brand" />
                    )}
                  </dd>
                </div>
              )}
              {STATIC_STATS.map((s) => (
                <div key={s.labelKey} className={statCard}>
                  <dt className="order-2 mt-1 text-sm leading-snug text-body">{t(s.labelKey)}</dt>
                  <dd className="order-1 flex flex-col items-center">
                    <span aria-hidden="true" className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-brandTint text-brand"><i className={`fa-solid ${s.icon} text-sm`}></i></span>
                    <CountUp value={s.value} className="font-display text-3xl sm:text-4xl font-extrabold text-brand" />
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <SectionDivider className="mb-10 sm:mb-12" />

          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl sm:text-2xl font-bold text-ink mb-2">{t('biz_form_title')}</h2>
            <p className="text-body text-sm mb-6 sm:mb-7">{t('biz_form_sub')}</p>
            {status === 'sent' && <Notice tone="success">{t('biz_form_success')}</Notice>}
            {error && <Notice>{t(error)}</Notice>}
            <form onSubmit={handleSubmit} className="space-y-4" aria-busy={isSubmitting || undefined}>
              {/* Honeypot: hidden from people and assistive tech; bots that fill it are dropped server-side. */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={fields.website} onChange={update('website')} />
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label htmlFor="biz-name" className="block text-sm font-semibold text-ink mb-1.5">{t('biz_form_business_name')}</label><input id="biz-name" type="text" name="businessName" required maxLength={120} autoComplete="organization" dir="auto" placeholder={t('biz_form_business_name_ph')} className="inp" value={fields.businessName} onChange={update('businessName')} /></div>
                <div>
                  <label htmlFor="biz-category" className="block text-sm font-semibold text-ink mb-1.5">{t('biz_form_category')}</label>
                  {/* Option values stay the English category names the API accepts; only the labels translate. */}
                  <select id="biz-category" name="category" className="inp" value={fields.category} onChange={update('category')}>
                    <option value="">{t('biz_form_category_ph')}</option>
                    {BUSINESS_CATEGORIES.map((c) => <option key={c} value={c}>{t(CATEGORY_LABEL_KEYS[c])}</option>)}
                  </select>
                </div>
                <div><label htmlFor="biz-contact" className="block text-sm font-semibold text-ink mb-1.5">{t('biz_form_contact')}</label><input id="biz-contact" type="text" name="contactName" required maxLength={100} autoComplete="name" dir="auto" placeholder={t('biz_form_contact_ph')} className="inp" value={fields.contactName} onChange={update('contactName')} /></div>
                <div><label htmlFor="biz-phone" className="block text-sm font-semibold text-ink mb-1.5">{t('biz_form_phone')}</label><input id="biz-phone" type="tel" name="phone" required maxLength={30} autoComplete="tel" inputMode="tel" dir="ltr" placeholder="+972 50 000 0000" className="inp rtl:text-right" value={fields.phone} onChange={update('phone')} /></div>
                <div className="sm:col-span-2"><label htmlFor="biz-email" className="block text-sm font-semibold text-ink mb-1.5">{t('biz_form_email')}</label><input id="biz-email" type="email" name="email" required maxLength={254} autoComplete="email" inputMode="email" dir="ltr" placeholder="business@example.com" className="inp rtl:text-right" value={fields.email} onChange={update('email')} /></div>
                <div className="sm:col-span-2"><label htmlFor="biz-message" className="block text-sm font-semibold text-ink mb-1.5">{t('biz_form_message')}</label><textarea id="biz-message" name="message" rows={3} maxLength={3000} dir="auto" placeholder={t('biz_form_message_ph')} className="inp resize-none" value={fields.message} onChange={update('message')}></textarea></div>
              </div>
              <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting || undefined} className="ds-btn ds-btn-primary ds-btn-wrap w-full mt-2">
                {isSubmitting && <span aria-hidden="true" className="me-2 h-5 w-5 rounded-full border-2 border-current border-r-transparent animate-spin" />}
                {t(isSubmitting ? 'support_form_sending' : 'biz_form_submit')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
