'use client'

import { useState, type ChangeEvent, type FormEvent } from 'react'
import Navbar from '@/components/layout/Navbar'
import Notice from '@/components/auth/entrance/Notice'
import { BUSINESS_CATEGORIES, type BusinessCategory } from '@/lib/business/inquiryCategories'
import { CATEGORY_TILES } from '@/lib/categories'
import { useLang } from '@/lib/i18n/useLang'
import type { TranslationKey } from '@/lib/i18n/translations'

const EMPTY_FIELDS = { businessName: '', category: '', contactName: '', phone: '', email: '', message: '', website: '' }

const BENEFITS: { emoji: string; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { emoji: '🎯', titleKey: 'biz_page_card1_title', descKey: 'biz_page_card1_desc' },
  { emoji: '📈', titleKey: 'biz_page_card2_title', descKey: 'biz_page_card2_desc' },
  { emoji: '💬', titleKey: 'biz_page_card3_title', descKey: 'biz_page_card3_desc' },
]

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
            <div className="text-4xl sm:text-5xl mb-4">🤝</div>
            <h1 className="text-3xl sm:text-4xl font-black text-ink mb-4" style={{ letterSpacing: '-0.02em' }}>{t('biz_page_title')}</h1>
            <p className="text-body max-w-xl mx-auto leading-relaxed text-[15px] sm:text-base">{t('biz_page_intro')}</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 sm:gap-5 mb-10 sm:mb-12">
            {BENEFITS.map((b) => (
              <div key={b.titleKey} className="bg-brandLight border border-brand/20 rounded-2xl p-5 sm:p-6 text-center">
                <div className="text-3xl mb-3">{b.emoji}</div>
                <h3 className="font-bold text-ink mb-2">{t(b.titleKey)}</h3>
                <p className="text-sm text-body">{t(b.descKey)}</p>
              </div>
            ))}
          </div>
          <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm">
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
