'use client'

import { useState, type ChangeEvent, type FormEvent } from 'react'
import Navbar from '@/components/layout/Navbar'
import Notice from '@/components/auth/entrance/Notice'
import { useLang } from '@/lib/i18n/useLang'
import type { TranslationKey } from '@/lib/i18n/translations'

// Translucent fields on the brand-blue mentor card.
const ON_BRAND = { background: 'rgba(255,255,255,.12)', borderColor: 'rgba(255,255,255,.28)', color: '#fff' }

// Codes match MENTOR_LANGUAGES in lib/email/sendMentorRequest.ts, so the team
// sees the English language name whatever the site language.
const MENTOR_LANGUAGE_OPTIONS: [string, TranslationKey][] = [
  ['ru', 'lang_russian'],
  ['fr', 'lang_french'],
  ['es', 'lang_spanish'],
  ['en', 'lang_english'],
]

const EMPTY_FIELDS = { name: '', email: '', mentorLanguage: '', aliyahDate: '', website: '' }

export default function OlimPage() {
  const { t, lang } = useLang()
  const [fields, setFields] = useState(EMPTY_FIELDS)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sent'>('idle')
  // A key rather than text, so an error already on screen follows a language switch.
  const [error, setError] = useState<TranslationKey | null>(null)

  const update = (key: keyof typeof EMPTY_FIELDS) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFields((prev) => ({ ...prev, [key]: e.target.value }))
      if (status === 'sent') setStatus('idle')
    }

  // POSTs to /api/mentor/inquiry, which emails team.landly@gmail.com with
  // Reply-To set to the member. Inputs are only cleared once the send succeeds.
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setError(null)
    setStatus('idle')
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/mentor/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, lang }),
        signal: AbortSignal.timeout(20_000),
      })
      if (res.status === 429) return setError('olim_form_rate_limited')
      if (res.status === 400) return setError('olim_form_invalid')
      if (!res.ok) throw new Error('request failed')
      setFields(EMPTY_FIELDS)
      setStatus('sent')
    } catch {
      setError('olim_form_error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Navbar />
      <div className="pt-16 bg-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
          <div className="text-center mb-10 sm:mb-12">
            <div className="text-4xl sm:text-5xl mb-4">✈️ 🇮🇱</div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4" style={{ letterSpacing: '-1px' }}>{t('olim_title')}</h1>
            <p className="text-slate-500 max-w-xl mx-auto leading-relaxed text-[15px] sm:text-base">{t('olim_sub')}</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 sm:gap-5 mb-10 sm:mb-12">
            <div className="bg-brandLight border border-brand/20 rounded-2xl p-5 sm:p-6 text-center">
              <div className="text-3xl mb-3">🎁</div>
              <h3 className="font-bold text-slate-900 mb-2">{t('olim_card_title')}</h3>
              <p className="text-sm text-slate-500">{t('olim_card_desc')}</p>
            </div>
            <div className="bg-brandLight border border-brand/20 rounded-2xl p-5 sm:p-6 text-center">
              <div className="text-3xl mb-3">⚖️</div>
              <h3 className="font-bold text-slate-900 mb-2">{t('olim_rights_title')}</h3>
              <p className="text-sm text-slate-500">{t('olim_rights_desc')}</p>
            </div>
            <div className="bg-brandLight border border-brand/20 rounded-2xl p-5 sm:p-6 text-center">
              <div className="text-3xl mb-3">🤝</div>
              <h3 className="font-bold text-slate-900 mb-2">{t('olim_mentor_title')}</h3>
              <p className="text-sm text-slate-500">{t('olim_mentor_desc')}</p>
            </div>
          </div>
          <div className="bg-slate-50 rounded-3xl p-6 sm:p-8 mb-10 sm:mb-12">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-6">{t('olim_categories_title')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-white border border-slate-100 rounded-xl p-4 text-center hover:border-brand transition cursor-pointer"><div className="text-2xl mb-2">👶</div><div className="font-semibold text-slate-800 text-sm">{t('cats_kids')}</div></div>
              <div className="bg-white border border-slate-100 rounded-xl p-4 text-center hover:border-brand transition cursor-pointer"><div className="text-2xl mb-2">🏠</div><div className="font-semibold text-slate-800 text-sm">{t('cats_home')}</div></div>
              <div className="bg-white border border-slate-100 rounded-xl p-4 text-center hover:border-brand transition cursor-pointer"><div className="text-2xl mb-2">📊</div><div className="font-semibold text-slate-800 text-sm">{t('cats_insurance')}</div></div>
              <div className="bg-white border border-slate-100 rounded-xl p-4 text-center hover:border-brand transition cursor-pointer"><div className="text-2xl mb-2">🏥</div><div className="font-semibold text-slate-800 text-sm">{t('olim_cat_health')}</div></div>
              <div className="bg-white border border-slate-100 rounded-xl p-4 text-center hover:border-brand transition cursor-pointer"><div className="text-2xl mb-2">📚</div><div className="font-semibold text-slate-800 text-sm">{t('olim_cat_ulpan')}</div></div>
              <div className="bg-white border border-slate-100 rounded-xl p-4 text-center hover:border-brand transition cursor-pointer"><div className="text-2xl mb-2">🚗</div><div className="font-semibold text-slate-800 text-sm">{t('cats_cars')}</div></div>
            </div>
          </div>
          <div className="bg-brand rounded-3xl p-6 sm:p-8 text-white">
            <h2 className="text-xl sm:text-2xl font-black mb-2">{t('olim_mentor_form_title')}</h2>
            <p className="text-blue-100 text-sm mb-6">{t('olim_mentor_form_sub')}</p>
            {status === 'sent' && <Notice tone="success">{t('olim_form_success')}</Notice>}
            {error && <Notice>{t(error)}</Notice>}
            <form onSubmit={handleSubmit} className="space-y-4" aria-busy={isSubmitting || undefined}>
              {/* Honeypot: hidden from people and assistive tech; bots that fill it are dropped server-side. */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={fields.website} onChange={update('website')} />
              <div className="grid sm:grid-cols-2 gap-4">
                <input type="text" name="name" required maxLength={100} autoComplete="name" dir="auto" aria-label={t('form_name')} placeholder={t('form_name_ph')} className="inp" style={ON_BRAND} value={fields.name} onChange={update('name')} />
                <input type="email" name="email" required maxLength={254} autoComplete="email" inputMode="email" dir="ltr" aria-label={t('form_email')} placeholder="your@email.com" className="inp rtl:text-right" style={ON_BRAND} value={fields.email} onChange={update('email')} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Options get dark text: some browsers draw the open list on white using the select's own (white) color. */}
                <select name="mentorLanguage" aria-label={t('olim_lang_placeholder')} className="inp [&>option]:text-slate-900" style={ON_BRAND} value={fields.mentorLanguage} onChange={update('mentorLanguage')}>
                  <option value="">{t('olim_lang_placeholder')}</option>
                  {MENTOR_LANGUAGE_OPTIONS.map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}
                </select>
                <input type="text" name="aliyahDate" maxLength={60} dir="auto" aria-label={t('olim_date_ph')} placeholder={t('olim_date_ph')} className="inp" style={ON_BRAND} value={fields.aliyahDate} onChange={update('aliyahDate')} />
              </div>
              <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting || undefined} className="tap-target w-full flex items-center text-center justify-center bg-white text-brand font-bold py-3.5 rounded-full hover:enabled:bg-brandLight transition shadow-lg disabled:opacity-80 disabled:cursor-not-allowed">
                {isSubmitting && <span aria-hidden="true" className="me-2 h-5 w-5 rounded-full border-2 border-current border-r-transparent animate-spin" />}
                {t(isSubmitting ? 'support_form_sending' : 'olim_request_btn')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
