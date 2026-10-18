'use client'

import { useEffect, useId, useState } from 'react'
import { useLang } from '@/lib/i18n/useLang'
import VoucherQRCode from './VoucherQRCode'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'

// The voucher page's two concealed parts (app/member/vouchers/[voucherId]):
// the QR code and the numeric code each stay hidden until the member taps
// to show them at the counter, so neither is on screen by default or over a
// shoulder. The Expo voucher screen (landly-mobile/src/app/voucher) mirrors it.

/** A placeholder card until "Show QR Code"; then the scannable code, black on white. */
export function QrReveal({ voucherId }: { voucherId: string }) {
  const { t } = useLang()
  const [shown, setShown] = useState(false)
  const regionId = useId()

  return (
    <section aria-label={t('voucher_qr_label')} className="flex flex-col items-center text-center">
      <div id={regionId} className="flex h-[264px] w-[264px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-5">
        {shown ? (
          <VoucherQRCode voucherId={voucherId} size={224} />
        ) : (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <i className="fa-solid fa-qrcode text-6xl opacity-30 blur-[2px]" aria-hidden="true"></i>
            <p className="max-w-[180px] text-xs text-slate-500">{t('voucher_qr_hidden')}</p>
          </div>
        )}
      </div>
      {shown && <p className="mt-3 text-xs text-slate-500">{t('voucher_qr_label')}</p>}
      <button
        type="button"
        onClick={() => setShown((value) => !value)}
        aria-expanded={shown}
        aria-controls={regionId}
        className={`tap-target mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold transition ${
          shown
            ? 'border border-slate-300 bg-white text-slate-800 [@media(hover:hover)]:hover:bg-slate-50'
            : 'bg-brand text-white shadow-md [@media(hover:hover)]:hover:bg-brandDark'
        } ${FOCUS}`}
      >
        <i className={`fa-solid ${shown ? 'fa-eye-slash' : 'fa-qrcode'}`} aria-hidden="true"></i>
        <span>{t(shown ? 'voucher_hide_qr' : 'voucher_show_qr')}</span>
      </button>
    </section>
  )
}

/** The redemption code masked as dots until "Show Code"; copying is offered once it's shown. */
export function CodeReveal({ code }: { code: string }) {
  const { t } = useLang()
  const [shown, setShown] = useState(false)
  const masked = '•'.repeat(Math.max(code.length, 8))

  return (
    <section className="flex flex-col items-center text-center">
      <div className="text-xs text-slate-500 mb-1">{t('voucher_redemption_code_label')}</div>
      {shown ? (
        <div className="text-3xl font-black text-slate-900 tracking-[0.2em] tabular-nums select-all" dir="ltr">{code}</div>
      ) : (
        <div className="text-3xl font-black text-slate-300 tracking-[0.2em]" dir="ltr" role="img" aria-label={t('voucher_code_hidden')}>{masked}</div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setShown((value) => !value)}
          aria-pressed={shown}
          className={`tap-target inline-flex min-h-12 items-center gap-2 rounded-full border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 transition [@media(hover:hover)]:hover:bg-slate-50 ${FOCUS}`}
        >
          <i className={`fa-solid ${shown ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i>
          <span>{t(shown ? 'voucher_hide_code' : 'voucher_show_code')}</span>
        </button>
        {shown && <CopyCodeButton code={code} />}
      </div>
    </section>
  )
}

/**
 * The Clipboard API needs a secure context (https or localhost); on a LAN
 * http address it reports a failure and the code stays readable above.
 */
function CopyCodeButton({ code }: { code: string }) {
  const { t } = useLang()
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (status === 'idle') return
    const timer = setTimeout(() => setStatus('idle'), 2000)
    return () => clearTimeout(timer)
  }, [status])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
  }

  const icon = status === 'copied' ? 'fa-check text-emerald-600' : status === 'failed' ? 'fa-xmark text-red-600' : 'fa-copy text-brand'
  return (
    <>
      <button
        type="button"
        onClick={copy}
        className={`tap-target inline-flex min-h-12 items-center gap-2 rounded-full bg-[#F0F7FF] px-5 text-sm font-bold text-[#0038B8] transition [@media(hover:hover)]:hover:bg-[#E0EDFF] ${FOCUS}`}
      >
        <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
        <span>{t('voucher_copy_code')}</span>
      </button>
      <span role="status" className="sr-only">
        {status === 'copied' ? t('voucher_code_copied') : status === 'failed' ? t('voucher_copy_failed') : ''}
      </span>
    </>
  )
}
