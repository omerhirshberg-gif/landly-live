'use client'

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Check, Copy, Eye, EyeOff, QrCode, X } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import VoucherQRCode from './VoucherQRCode'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'
const FACE = 'flex flex-col items-center justify-center rounded-2xl border border-slate-200 p-5 text-center'
// A faint diagonal weave on the concealed side, like the security print on a ticket.
const WATERMARK = 'bg-[repeating-linear-gradient(45deg,#F8FAFC_0_10px,#F1F5F9_10px_20px)]'

// The voucher page's two concealed parts (app/member/vouchers/[voucherId]):
// the QR code and the numeric code each sit on the back of a card that turns
// over (a 3D flip, app/globals.css .flip-card) when the member taps to show
// it at the counter, so neither is on screen by default or over a shoulder.
// The back isn't rendered at all until the first reveal; the hidden face is
// inert, and focus follows the turn to the button on the face now showing.
// The Expo voucher screen (landly-mobile/src/components/VoucherReveal.tsx)
// mirrors it.

/** Turns the card and moves focus to the face that comes up (never on the first render). */
function useFlip(frontButton: RefObject<HTMLButtonElement | null>, backButton: RefObject<HTMLButtonElement | null>) {
  const [shown, setShown] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const turned = useRef(false)

  useEffect(() => {
    if (!turned.current) return
    ;(shown ? backButton : frontButton).current?.focus({ preventScroll: true })
  }, [shown, frontButton, backButton])

  const toggle = () => {
    turned.current = true
    // A tap of feedback as the code is revealed, where the browser supports it (Android Chrome).
    if (!shown) navigator.vibrate?.(12)
    setRevealed(true)
    setShown((value) => !value)
  }
  return { shown, revealed, toggle }
}

function FlipCard({ id, flipped, front, back, className = '' }: { id?: string; flipped: boolean; front: ReactNode; back: ReactNode; className?: string }) {
  return (
    <div id={id} className={`flip-card ${flipped ? 'is-flipped' : ''} ${className}`}>
      <div className="flip-card-inner min-w-0">
        <div className="flip-face flip-face-front min-w-0" inert={flipped} aria-hidden={flipped || undefined}>{front}</div>
        <div className="flip-face flip-face-back min-w-0" inert={!flipped} aria-hidden={!flipped || undefined}>{back}</div>
      </div>
    </div>
  )
}

/** A watermarked card until "Show QR Code"; it turns over to the scannable code, black on white. */
export function QrReveal({ redeemKey }: { redeemKey: string }) {
  const { t } = useLang()
  const regionId = useId()
  const frontButton = useRef<HTMLButtonElement>(null)
  const backButton = useRef<HTMLButtonElement>(null)
  const { shown, revealed, toggle } = useFlip(frontButton, backButton)

  return (
    <section aria-label={t('voucher_qr_label')} className="flex flex-col items-center text-center">
      <FlipCard
        id={regionId}
        flipped={shown}
        className="w-[288px] max-w-full"
        front={
          <div className={`${FACE} ${WATERMARK} h-full min-h-[360px] gap-4`}>
            <QrCode aria-hidden="true" className="h-[72px] w-[72px] text-slate-400 opacity-30 blur-[2px]" strokeWidth={1.5} />
            <p className="max-w-[200px] text-sm font-semibold text-slate-600">{t('voucher_qr_tap_reveal')}</p>
            <p className="max-w-[200px] text-xs text-slate-500">{t('voucher_qr_hidden')}</p>
            <button
              ref={frontButton}
              type="button"
              onClick={toggle}
              aria-expanded={false}
              aria-controls={regionId}
              className={`tap-target mt-1 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl [corner-shape:squircle] bg-brand px-6 text-sm font-bold text-white shadow-[0_6px_16px_-4px_rgba(0,56,184,0.4)] transition-[transform,background-color,box-shadow] duration-200 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:bg-brandDark ${FOCUS}`}
            >
              <QrCode aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
              <span>{t('voucher_show_qr')}</span>
            </button>
          </div>
        }
        back={
          <div className={`${FACE} h-full min-h-[360px] bg-white`}>
            {revealed && <VoucherQRCode redeemKey={redeemKey} size={224} />}
            <p className="mt-3 text-xs text-slate-500">{t('voucher_qr_label')}</p>
            <button
              ref={backButton}
              type="button"
              onClick={toggle}
              aria-expanded={true}
              aria-controls={regionId}
              className={`tap-target mt-3 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 text-sm font-bold text-slate-800 transition [@media(hover:hover)]:hover:bg-slate-50 ${FOCUS}`}
            >
              <EyeOff aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
              <span>{t('voucher_hide_qr')}</span>
            </button>
          </div>
        }
      />
    </section>
  )
}

/** The redemption code masked as dots until "Show Code"; the card turns over to the code and its copy button. */
export function CodeReveal({ code, prominent = false }: { code: string; prominent?: boolean }) {
  const { t } = useLang()
  const frontButton = useRef<HTMLButtonElement>(null)
  const backButton = useRef<HTMLButtonElement>(null)
  const { shown, revealed, toggle } = useFlip(frontButton, backButton)
  const masked = '•'.repeat(Math.max(code.length, 8))
  const toggleClass = `tap-target inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 transition [@media(hover:hover)]:hover:bg-slate-50 ${FOCUS}`

  return (
    <section className="flex flex-col items-center text-center">
      <div className="text-xs text-slate-500 mb-2">{t('voucher_redemption_code_label')}</div>
      <FlipCard
        flipped={shown}
        className={prominent ? 'w-full' : 'w-[320px] max-w-full'}
        front={
          <div className={`${FACE} ${WATERMARK} h-full min-h-[148px]`}>
            <div className="text-3xl font-black text-slate-300 tracking-[0.2em]" dir="ltr" role="img" aria-label={t('voucher_code_hidden')}>{masked}</div>
            <button ref={frontButton} type="button" onClick={toggle} aria-pressed={false} className={`mt-3 ${toggleClass}`}>
              <Eye aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
              <span>{t('voucher_show_code')}</span>
            </button>
          </div>
        }
        back={
          <div className={`${FACE} h-full min-h-[148px] bg-white`}>
            {/* The code and a small circular copy button on one row (the order number's pattern), Hide Code quietly beneath. */}
            {revealed && (
              <div className="flex w-full items-center justify-center gap-3">
                <bdi dir="ltr" className={`block min-w-0 max-w-full select-all text-center font-black tabular-nums text-slate-900 ${prominent ? `[overflow-wrap:anywhere] leading-tight tracking-[0.04em] ${code.length > 22 ? 'text-[1.0625rem]' : code.length > 16 ? 'text-[1.25rem]' : 'text-[1.5rem] sm:text-[1.625rem]'}` : 'break-all text-2xl tracking-[0.12em] sm:text-3xl'}`}>{code}</bdi>
                <CopyCodeButton code={code} />
              </div>
            )}
            <button ref={backButton} type="button" onClick={toggle} aria-pressed={true} className={`tap-target mt-2 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-slate-500 transition [@media(hover:hover)]:hover:text-slate-800 ${FOCUS}`}>
              <EyeOff aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
              <span>{t('voucher_hide_code')}</span>
            </button>
          </div>
        }
      />
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
      // A tap of feedback where the browser supports it (Android Chrome).
      navigator.vibrate?.(15)
    } catch {
      setStatus('failed')
    }
  }

  const [Icon, tone] = status === 'copied' ? [Check, 'text-emerald-600'] : status === 'failed' ? [X, 'text-red-600'] : [Copy, 'text-brand']
  // A 36px circle, the same as the order number's copy button; the check turns green for two seconds.
  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={t('voucher_copy_code')}
        className={`tap-target inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${status === 'copied' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white [@media(hover:hover)]:hover:bg-brandTint'} ${FOCUS}`}
      >
        <Icon aria-hidden="true" className={`h-[18px] w-[18px] ${tone}`} strokeWidth={1.75} />
      </button>
      <span role="status" className="sr-only">
        {status === 'copied' ? t('voucher_code_copied') : status === 'failed' ? t('voucher_copy_failed') : ''}
      </span>
    </>
  )
}
