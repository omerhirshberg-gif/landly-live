'use client'

import { Suspense, useState, type ChangeEvent, type FormEvent } from 'react'
import Navbar from '@/components/layout/Navbar'
import BackToSettings from '@/components/settings/BackToSettings'
import Faq from '@/components/home/Faq'
import Notice from '@/components/auth/entrance/Notice'
import { useLang } from '@/lib/i18n/useLang'
import type { TranslationKey } from '@/lib/i18n/translations'
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY, SUPPORT_WHATSAPP_LINK } from '@/lib/config'

// Values match SUPPORT_SUBJECTS in lib/email/sendSupportMessage.ts, so the
// team inbox always gets the English topic whatever the site language.
const SUBJECT_OPTIONS: [string, TranslationKey][] = [
  ['general', 'subj_general'],
  ['billing', 'subj_billing'],
  ['voucher', 'subj_voucher'],
  ['partner', 'subj_partner'],
  ['aliyah', 'subj_aliyah'],
]

const EMPTY_FIELDS = { name: '', email: '', subject: 'general', message: '', website: '' }

export default function SupportPage() {
  const { t, lang } = useLang()
  const [fields, setFields] = useState(EMPTY_FIELDS)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  const update = (key: keyof typeof EMPTY_FIELDS) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setFields((prev) => ({ ...prev, [key]: e.target.value }))
      if (status === 'sent') setStatus('idle')
    }

  // POSTs to /api/support, which emails team.landly@gmail.com with Reply-To
  // set to the sender. Inputs are only cleared once the send succeeds.
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setError(null)
    setStatus('idle')
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, lang }),
        signal: AbortSignal.timeout(20_000),
      })
      if (res.status === 429) return setError(t('support_form_rate_limited'))
      if (res.status === 400) return setError(t('support_form_invalid'))
      if (!res.ok) throw new Error('request failed')
      setFields(EMPTY_FIELDS)
      setStatus('sent')
    } catch {
      setError(t('support_form_error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Navbar />
      <div className="below-header member-canvas">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
          <Suspense fallback={null}>
            <BackToSettings className="mb-3 sm:mb-6" />
          </Suspense>
          <h1 className="text-[26px] sm:text-[28px] lg:text-3xl leading-tight font-bold text-ink mb-8">{t('support_title')}</h1>

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-5 mb-8 sm:mb-10">
            <div className="bg-brandLight border border-brand/20 rounded-2xl p-5">
              <div className="text-2xl mb-2">📧</div>
              <div className="font-bold text-ink mb-1">{t('support_email_us')}</div>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand text-sm font-semibold hover:underline">{SUPPORT_EMAIL}</a>
              <p className="text-xs text-body mt-2">{t('support_email_note')}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
              <div className="text-2xl mb-2">💬</div>
              <div className="font-bold text-ink mb-1">{t('support_whatsapp')}</div>
              <a href={SUPPORT_WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" dir="ltr" className="text-brand text-sm font-semibold hover:underline">{SUPPORT_WHATSAPP_DISPLAY}</a>
              <p className="text-sm text-body mt-1">{t('support_whatsapp_note')}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-lg sm:text-xl font-bold text-ink mb-6">{t('support_form_title')}</h2>
            {status === 'sent' && <Notice tone="success">{t('support_form_success')}</Notice>}
            {error && <Notice>{error}</Notice>}
            <form onSubmit={handleSubmit} className="space-y-4" aria-busy={isSubmitting || undefined}>
              {/* Honeypot: hidden from people and assistive tech; bots that fill it are dropped server-side. */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={fields.website} onChange={update('website')} />
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label htmlFor="support-name" className="block text-sm font-semibold text-ink mb-1.5">{t('form_name')}</label><input id="support-name" type="text" name="name" required maxLength={100} autoComplete="name" placeholder={t('form_name_ph')} className="inp" value={fields.name} onChange={update('name')} /></div>
                <div><label htmlFor="support-email" className="block text-sm font-semibold text-ink mb-1.5">{t('form_email')}</label><input id="support-email" type="email" name="email" required maxLength={254} autoComplete="email" inputMode="email" dir="ltr" placeholder="your@email.com" className="inp rtl:text-right" value={fields.email} onChange={update('email')} /></div>
              </div>
              <div>
                <label htmlFor="support-subject" className="block text-sm font-semibold text-ink mb-1.5">{t('form_subject')}</label>
                <select id="support-subject" name="subject" className="inp" value={fields.subject} onChange={update('subject')}>
                  {SUBJECT_OPTIONS.map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}
                </select>
              </div>
              <div><label htmlFor="support-message" className="block text-sm font-semibold text-ink mb-1.5">{t('form_message')}</label><textarea id="support-message" name="message" rows={4} required maxLength={5000} dir="auto" placeholder={t('form_message_ph')} className="inp resize-none" value={fields.message} onChange={update('message')}></textarea></div>
              <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting || undefined} className="ds-btn ds-btn-primary ds-btn-wrap w-full">
                {isSubmitting && <span aria-hidden="true" className="me-2 h-5 w-5 rounded-full border-2 border-current border-r-transparent animate-spin" />}
                {t(isSubmitting ? 'support_form_sending' : 'btn_send_message')}
              </button>
            </form>
          </div>
        </div>
        <Faq />
      </div>
    </>
  )
}
