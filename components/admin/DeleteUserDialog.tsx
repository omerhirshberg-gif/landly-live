'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { formatIsraeliDate } from '@/lib/admin/formatDate'
import { formatIls } from '@/lib/usage/pricing'
import { useAdminT } from '@/lib/admin/translations'
import Alert from './Alert'
import BidiText from './BidiText'
import { ADMIN_INPUT, DANGER_BUTTON, SECONDARY_BUTTON } from './formStyles'

// The double confirmation behind "Delete permanently" on /admin/users/{uid}.
// It first asks the server what deletion would do (?preview=1): how many
// vouchers are cancelled or kept, and every PAID voucher still unredeemed,
// which deletion cancels without refunding. The final button stays off until
// the admin types DELETE and, when paid vouchers exist, ticks the refund
// acknowledgment; the server enforces both again. A bottom sheet on phones
// (safe-area aware), a centred dialog from sm. Escape and the backdrop cancel,
// except while the deletion is running.
export const DELETE_WORD = 'DELETE'

interface PaidVoucher {
  voucherId: string
  orderNumber: string | null
  tranzilaTxnId: string | null
  offerTitle: string
  businessName: string
  amountAgorot: number
  purchasedAt: string | null
}
interface Preview {
  name: string
  email: string
  appleLinked: boolean
  activeVouchers: number
  redeemedVouchers: number
  paidOrders: number
  paidActiveVouchers: PaidVoucher[]
  isBusiness: boolean
}

/** s•••f@icloud.com: enough to recognise the member, not to read the address aloud. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at < 1) return email
  const local = email.slice(0, at)
  return `${local.length <= 2 ? local[0] : `${local[0]}•••${local[local.length - 1]}`}${email.slice(at)}`
}

export default function DeleteUserDialog({ uid, onClose, onDeleted }: { uid: string; onClose: () => void; onDeleted: () => void }) {
  const { t } = useAdminT()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [typed, setTyped] = useState('')
  const [refundAck, setRefundAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    let live = true
    adminFetch(`/api/admin/users/${encodeURIComponent(uid)}?preview=1`)
      .then(async (res) => {
        if (!res.ok) throw new Error()
        if (live) setPreview((await res.json()) as Preview)
      })
      .catch(() => live && setLoadError(true))
    return () => { live = false }
  }, [uid])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => { document.body.style.overflow = previous }
  }, [])

  const close = () => { if (!busy) onClose() }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
      if (event.key === 'Tab' && panelRef.current) {
        // Keep focus inside the dialog.
        const items = [...panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]')]
        if (!items.length) return
        const first = items[0]!
        const last = items[items.length - 1]!
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const paid = preview?.paidActiveVouchers ?? []
  const ready = !!preview && !preview.isBusiness && typed === DELETE_WORD && (paid.length === 0 || refundAck) && !busy

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!ready) return
    setBusy(true)
    setError(null)
    const res = await adminFetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: typed, refundAcknowledged: refundAck }),
    }).catch(() => null)
    if (res?.ok) return onDeleted()
    const body = await res?.json().catch(() => null)
    setError(body?.error ?? t('member.delete.failed'))
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[calc(var(--app-dvh)-0.5rem)] w-full overflow-y-auto rounded-t-3xl border border-adm-line bg-adm-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl focus:outline-none sm:max-h-[calc(var(--app-dvh)-3rem)] sm:max-w-lg sm:rounded-3xl sm:p-6"
      >
        <form onSubmit={submit} className="space-y-4">
          <div>
            <h2 id={titleId} className="text-lg font-bold tracking-tight text-adm-text">
              {t('member.delete.title')}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-adm-text-2">{t('member.delete.intro')}</p>
          </div>

          {loadError && <Alert>{t('member.delete.loadFailed')}</Alert>}
          {!preview && !loadError && <p className="py-6 text-center text-sm text-adm-muted" aria-busy="true">{t('member.delete.loading')}</p>}

          {preview?.isBusiness && <Alert>{t('member.delete.business')}</Alert>}
          {preview && !preview.isBusiness && (
            <>
              <div className="rounded-2xl border border-adm-line bg-adm-sunken/60 p-4">
                <p className="font-semibold text-adm-text"><BidiText>{preview.name || '—'}</BidiText></p>
                <bdi dir="ltr" className="block truncate text-sm text-adm-text-2">{maskEmail(preview.email)}</bdi>
                <dl className="mt-3 space-y-1.5 text-sm">
                  {([
                    ['member.delete.active', preview.activeVouchers],
                    ['member.delete.redeemed', preview.redeemedVouchers],
                    ['member.delete.paidOrders', preview.paidOrders],
                  ] as const).map(([key, value]) => (
                    <div key={key} className="flex items-baseline justify-between gap-3">
                      <dt className="min-w-0 text-adm-text-2">{t(key)}</dt>
                      <dd className="shrink-0 font-semibold tabular-nums text-adm-text"><bdi dir="ltr">{value}</bdi></dd>
                    </div>
                  ))}
                </dl>
              </div>

              {paid.length > 0 && (
                <Alert tone="warning">
                  <p className="font-bold">{t('member.delete.paidTitle')}</p>
                  <p className="mt-1 font-normal">{t('member.delete.paidBody')}</p>
                  <ul className="mt-3 space-y-2">
                    {paid.map((voucher) => (
                      <li key={voucher.voucherId} className="rounded-xl border border-adm-warn-line/70 px-3 py-2 font-normal">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate font-semibold" dir="auto">{voucher.offerTitle || voucher.businessName}</span>
                          <bdi dir="ltr" className="shrink-0 font-bold tabular-nums">{formatIls(voucher.amountAgorot / 100)}</bdi>
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums">
                          <span>{t('member.delete.order')} <bdi dir="ltr">{voucher.orderNumber ?? voucher.voucherId}</bdi></span>
                          {voucher.tranzilaTxnId && <span>{t('member.delete.txn')} <bdi dir="ltr">{voucher.tranzilaTxnId}</bdi></span>}
                          <span>{t('member.delete.purchased')} <bdi dir="ltr">{formatIsraeliDate(voucher.purchasedAt)}</bdi></span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 py-1 font-semibold">
                    <input type="checkbox" checked={refundAck} onChange={(event) => setRefundAck(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--adm-danger,#dc2626)]" />
                    <span>{t('member.delete.refundAck')}</span>
                  </label>
                </Alert>
              )}

              {preview.appleLinked && (
                <p className="rounded-xl border border-adm-line bg-adm-sunken/60 px-4 py-3 text-sm leading-relaxed text-adm-text-2">{t('member.delete.apple')}</p>
              )}

              <div>
                <label htmlFor="delete-confirm" className="mb-1.5 block text-sm font-semibold text-adm-text">
                  {t('member.delete.typeLabel', { word: `⁦${DELETE_WORD}⁩` })}
                </label>
                <input
                  id="delete-confirm"
                  dir="ltr"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  className={`${ADMIN_INPUT} font-mono tracking-wide`}
                />
              </div>
            </>
          )}

          {error && <Alert>{error}</Alert>}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button type="button" className={`${SECONDARY_BUTTON} w-full sm:w-auto`} onClick={close} disabled={busy}>{t('common.cancel')}</button>
            <button type="submit" className={`${DANGER_BUTTON} w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-50`} disabled={!ready}>
              {busy ? t('member.delete.deleting') : t('member.delete')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
