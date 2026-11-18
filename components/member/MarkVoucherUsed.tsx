'use client'

import { useState } from 'react'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { markVoucherUsed } from '@/lib/vouchers/markUsedClient'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'

// A code-only voucher (Raayonit) is used at a till nobody here sees, so the member says so (native:
// landly-mobile/src/components/MarkVoucherUsed.tsx). Two taps on purpose: the first asks, the second
// does it, and the voucher's live subscription then flips the page to "already redeemed".
export default function MarkVoucherUsed({ voucherId }: { voucherId: string }) {
  const { t } = useLang()
  const { user } = useAuth()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const confirm = async () => {
    if (!user || busy) return
    setBusy(true)
    setFailed(false)
    const ok = await markVoucherUsed(await user.getIdToken(), voucherId, '').catch(() => false)
    if (!ok) {
      setFailed(true)
      setBusy(false)
    }
  }

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={`tap-target mx-auto mt-4 flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-bold text-brand [@media(hover:hover)]:hover:underline ${FOCUS}`}>
        {t('voucher_mark_used')}
      </button>
    )
  }
  return (
    <div role="alert" className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-start">
      <p className="text-[15px] font-extrabold text-slate-900">{t('voucher_mark_used_title')}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{t('voucher_mark_used_body')}</p>
      {failed && <p className="mt-2 text-[13px] text-red-600">{t('voucher_mark_used_error')}</p>}
      <div className="mt-3.5 flex gap-2.5">
        <button type="button" disabled={busy} onClick={() => setAsking(false)} className={`tap-target min-h-12 flex-1 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-800 ${FOCUS}`}>{t('voucher_mark_used_cancel')}</button>
        <button type="button" disabled={busy} aria-busy={busy} onClick={confirm} className={`tap-target min-h-12 flex-1 rounded-xl bg-brand text-sm font-bold text-white disabled:opacity-60 ${FOCUS}`}>{t('voucher_mark_used_confirm')}</button>
      </div>
    </div>
  )
}
