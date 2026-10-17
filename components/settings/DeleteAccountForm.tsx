'use client'

import { useState } from 'react'
import type { User } from 'firebase/auth'
import { useLang } from '@/lib/i18n/useLang'
import { SUPPORT_EMAIL } from '@/lib/config'
import { DELETION_DETAILS_MAX, DELETION_REASONS, DELETION_REASON_KEYS, isDeletionReason } from '@/lib/account/deletionReasons'
import { requestAccountDeletion, type DeletionRequestResult } from '@/lib/account/requestAccountDeletion'

// The Delete Account request form on /settings/delete-account (app:
// DeleteAccountSheet): the account email (read-only), an optional reason and
// note, and a required "I understand" box; submitting emails the team, who
// delete the account. Once sent the form gives way to a confirmation. It
// sits on its own page, never in a dialog; Cancel and Done leave it.
export default function DeleteAccountForm({ user, onLeave }: { user: User; onLeave: () => void }) {
  const { t, lang } = useLang()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<DeletionRequestResult | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!confirmed || sending) return
    setSending(true)
    setResult(null)
    try {
      const idToken = await user.getIdToken()
      setResult(await requestAccountDeletion(idToken, { reason: isDeletionReason(reason) ? reason : null, details: details.trim(), lang }))
    } catch {
      setResult('unauthorized')
    } finally {
      setSending(false)
    }
  }

  const error =
    result === 'rateLimited' ? t('del_rate_limited') : result === 'unauthorized' ? t('del_session_expired') : result === 'failed' || result === 'offline' ? t('del_error') : null

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <span className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-red-50 text-red-600" aria-hidden="true">
          <i className={`fa-solid ${result === 'sent' ? 'fa-check' : 'fa-trash-can'}`}></i>
        </span>
        <h2 className="flex-1 min-w-0 text-lg font-bold text-ink">
          {result === 'sent' ? t('del_success_title') : t('del_title')}
        </h2>
      </div>

      {result === 'sent' ? (
        <div role="status">
          <p className="text-[15px] text-body">{t('del_success_body')}</p>
          <button type="button" onClick={onLeave} className="ds-btn ds-btn-primary w-full mt-6">{t('del_done')}</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-[15px] text-body">{t('del_intro')}</p>

          <div>
            <label htmlFor="delete-email" className="block mb-1.5 text-sm font-semibold text-slate-700">{t('del_email_label')}</label>
            <input id="delete-email" type="email" readOnly dir="ltr" value={user.email ?? ''} className="inp bg-slate-100 text-slate-600 cursor-default" />
          </div>

          <div>
            <label htmlFor="delete-reason" className="block mb-1.5 text-sm font-semibold text-slate-700">{t('del_reason_label')}</label>
            <select id="delete-reason" className="inp" value={reason} onChange={(e) => setReason(e.target.value)} disabled={sending}>
              <option value="">{t('del_reason_placeholder')}</option>
              {DELETION_REASONS.map((r) => <option key={r} value={r}>{t(DELETION_REASON_KEYS[r])}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="delete-details" className="block mb-1.5 text-sm font-semibold text-slate-700">{t('del_details_label')}</label>
            <textarea
              id="delete-details"
              rows={3}
              dir="auto"
              maxLength={DELETION_DETAILS_MAX}
              className="inp resize-none"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              disabled={sending}
            ></textarea>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/60 p-3 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={sending}
              className="mt-0.5 h-5 w-5 flex-shrink-0 accent-red-600"
            />
            <span className="text-sm font-medium text-ink">{t('del_confirm')}</span>
          </label>

          {error && (
            <p role="alert" className="text-sm font-semibold rounded-xl px-4 py-3 border text-red-600 bg-red-50 border-red-200">
              {error}
              {(result === 'failed' || result === 'offline') && (
                <> <a href={`mailto:${SUPPORT_EMAIL}`} className="underline"><bdi>{SUPPORT_EMAIL}</bdi></a></>
              )}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button type="button" onClick={onLeave} disabled={sending} className="ds-btn ds-btn-secondary w-full sm:flex-1">{t('del_cancel')}</button>
            <button
              type="submit"
              disabled={!confirmed || sending}
              aria-busy={sending || undefined}
              className="tap-target inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-red-600 px-5 text-[15px] font-semibold text-white transition-colors [@media(hover:hover)]:hover:enabled:bg-red-700 active:enabled:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed sm:flex-1"
            >
              {sending && <span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin" />}
              {sending ? t('del_sending') : t('del_submit')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
