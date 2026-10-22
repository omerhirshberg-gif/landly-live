'use client'

import { Suspense, useState, type ChangeEvent, type FormEvent } from 'react'
import Navbar from '@/components/layout/Navbar'
import MemberPageShell, { PageTitle } from '@/components/layout/MemberPageShell'
import BackToSettings from '@/components/settings/BackToSettings'
import Faq from '@/components/home/Faq'
import Notice from '@/components/auth/entrance/Notice'
import Reveal from '@/components/ui/Reveal'
import SectionDivider from '@/components/ui/SectionDivider'
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

const CHANNELS: { href: string; external: boolean; display: string; dir?: 'ltr'; icon: string; iconClass: string; titleKey: TranslationKey; noteKey: TranslationKey; noteIcon: string }[] = [
  { href: `mailto:${SUPPORT_EMAIL}`, external: false, display: SUPPORT_EMAIL, icon: 'fa-solid fa-envelope', iconClass: 'bg-brandTint text-brand', titleKey: 'support_email_us', noteKey: 'support_email_note', noteIcon: 'fa-clock' },
  { href: SUPPORT_WHATSAPP_LINK, external: true, display: SUPPORT_WHATSAPP_DISPLAY, dir: 'ltr', icon: 'fa-brands fa-whatsapp', iconClass: 'bg-[#E7F8EE] text-[#128C4B]', titleKey: 'support_whatsapp', noteKey: 'support_whatsapp_note', noteIcon: 'fa-comment' },
]

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

  // POSTs to /api/support, which emails contact@golandly.com with Reply-To
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
        <MemberPageShell>
          {/* Narrower than the column, at its start edge, so the title lines up with the other tabs. */}
          <div className="max-w-3xl">
            <Suspense fallback={null}>
              <BackToSettings className="mb-3 sm:mb-6" />
            </Suspense>
            <PageTitle>{t('support_title')}</PageTitle>

            {/* The two ways to reach us, each one whole tappable card: icon,
                channel, address (in <bdi>, so it stays whole in Hebrew), the
                reply note from the copy (no live "online" claim; nothing tracks
                that), and an arrow that nudges toward the reading direction. */}
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-5 mb-8 sm:mb-10">
              {CHANNELS.map((c, i) => (
                <Reveal key={c.titleKey} delay={i * 60} className="h-full">
                  <a
                    href={c.href}
                    {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="group flex h-full min-h-[64px] items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 text-start shadow-sm [-webkit-tap-highlight-color:transparent] transition-[transform,box-shadow,border-color] duration-200 ease-out [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:border-brand/25 [@media(hover:hover)]:hover:shadow-md active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none motion-reduce:[@media(hover:hover)]:hover:translate-y-0 motion-reduce:active:scale-100"
                  >
                    <span aria-hidden="true" className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-xl ${c.iconClass}`}>
                      <i className={c.icon}></i>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-ink">{t(c.titleKey)}</span>
                      <bdi dir={c.dir} className="block break-all text-sm font-semibold text-brand">{c.display}</bdi>
                      <span className="mt-1.5 flex items-start gap-1.5 text-xs leading-snug text-body">
                        <i className={`fa-regular ${c.noteIcon} mt-px flex-shrink-0`} aria-hidden="true"></i>
                        <span>{t(c.noteKey)}</span>
                      </span>
                    </span>
                    <span aria-hidden="true" className="cat-card-nudge flex-shrink-0 text-sm text-slate-300 transition-colors [@media(hover:hover)]:group-hover:text-brand">
                      <i className={`fa-solid ${c.external ? 'fa-arrow-up-right-from-square' : 'fa-arrow-right'} rtl:-scale-x-100`}></i>
                    </span>
                  </a>
                </Reveal>
              ))}
            </div>

            {/* Soft hairlines between the channels, the form and the FAQ, as on the home page. */}
            <SectionDivider className="mb-8 sm:mb-10" />

            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm">
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
        </MemberPageShell>
        <SectionDivider />
        <Faq />
      </div>
    </>
  )
}
