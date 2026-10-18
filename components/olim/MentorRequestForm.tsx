'use client'

import { useState, type ChangeEvent, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import Notice from '@/components/auth/entrance/Notice'
import { fullName } from '@/lib/auth/names'
import { useMemberProfile } from '@/lib/firebase/useMemberProfile'
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

// Limits match MENTOR_LIMITS in lib/email/sendMentorRequest.ts.
const NOTES_MAX = 1000

const EMPTY_FIELDS = { mentorLanguage: '', aliyahDate: '', notes: '', website: '' }

// The signed-in mentor request form. The name starts as the member's profile
// name and can be edited; the email is the account's, read-only, since the
// server takes it from the ID token anyway.
export default function MentorRequestForm({ user }: { user: User }) {
  const { t, lang } = useLang()
  const { profile } = useMemberProfile(user)
  // null until the member types, so the profile name fills in once it loads.
  const [typedName, setTypedName] = useState<string | null>(null)
  const [fields, setFields] = useState(EMPTY_FIELDS)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sent'>('idle')
  // A key rather than text, so an error already on screen follows a language switch.
  const [error, setError] = useState<TranslationKey | null>(null)

  const profileName = fullName(profile?.firstName ?? '', profile?.lastName ?? '') || profile?.displayName || user.displayName || ''
  const name = typedName ?? profileName

  const update = (key: keyof typeof EMPTY_FIELDS) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setFields((prev) => ({ ...prev, [key]: e.target.value }))
      if (status === 'sent') setStatus('idle')
    }

  // POSTs to /api/mentor/inquiry with the member's ID token; the route emails
  // team.landly@gmail.com with Reply-To set to the account email. Inputs are
  // only cleared once the send succeeds.
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setError(null)
    setStatus('idle')
    setIsSubmitting(true)
    try {
      let idToken: string
      try {
        idToken = await user.getIdToken()
      } catch {
        return setError('olim_form_session_expired')
      }
      const res = await fetch('/api/mentor/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ ...fields, name, lang }),
        signal: AbortSignal.timeout(20_000),
      })
      if (res.status === 401) return setError('olim_form_session_expired')
      if (res.status === 429) return setError('olim_form_rate_limited')
      if (res.status === 400) return setError('olim_form_invalid')
      if (!res.ok) throw new Error('request failed')
      setFields(EMPTY_FIELDS)
      setTypedName(null)
      setStatus('sent')
    } catch {
      setError('olim_form_error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {status === 'sent' && <Notice tone="success">{t('olim_form_success')}</Notice>}
      {error && <Notice>{t(error)}</Notice>}
      <form onSubmit={handleSubmit} className="space-y-4" aria-busy={isSubmitting || undefined}>
        {/* Honeypot: hidden from people and assistive tech; bots that fill it are dropped server-side. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={fields.website} onChange={update('website')} />
        <div className="grid sm:grid-cols-2 gap-4">
          <input
            type="text" name="name" required maxLength={100} autoComplete="name" dir="auto" aria-label={t('form_name')} placeholder={t('form_name_ph')}
            className="inp" style={ON_BRAND} value={name}
            onChange={(e) => { setTypedName(e.target.value); if (status === 'sent') setStatus('idle') }}
          />
          <input type="email" name="email" readOnly dir="ltr" aria-label={t('form_email')} className="inp rtl:text-right cursor-default opacity-80" style={ON_BRAND} value={user.email ?? ''} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Options get dark text: some browsers draw the open list on white using the select's own (white) color. */}
          <select name="mentorLanguage" aria-label={t('olim_lang_placeholder')} className="inp [&>option]:text-slate-900" style={ON_BRAND} value={fields.mentorLanguage} onChange={update('mentorLanguage')}>
            <option value="">{t('olim_lang_placeholder')}</option>
            {MENTOR_LANGUAGE_OPTIONS.map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}
          </select>
          <input type="text" name="aliyahDate" maxLength={60} dir="auto" aria-label={t('olim_date_ph')} placeholder={t('olim_date_ph')} className="inp" style={ON_BRAND} value={fields.aliyahDate} onChange={update('aliyahDate')} />
        </div>
        <textarea name="notes" rows={3} maxLength={NOTES_MAX} dir="auto" aria-label={t('olim_notes_ph')} placeholder={t('olim_notes_ph')} className="inp resize-y" style={ON_BRAND} value={fields.notes} onChange={update('notes')} />
        <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting || undefined} className="tap-target w-full flex items-center text-center justify-center bg-white text-brand font-bold py-3.5 rounded-full hover:enabled:bg-brandLight transition shadow-lg disabled:opacity-80 disabled:cursor-not-allowed">
          {isSubmitting && <span aria-hidden="true" className="me-2 h-5 w-5 rounded-full border-2 border-current border-r-transparent animate-spin" />}
          {t(isSubmitting ? 'support_form_sending' : 'olim_request_btn')}
        </button>
      </form>
    </>
  )
}
