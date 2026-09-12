'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/firebase/useAuth'
import { useBusinessLang } from '@/lib/business/BusinessLangProvider'
import type { TranslationKey } from '@/lib/i18n/translations'

interface BusinessVoucher {
  id: string
  offerTitle: string
  takenAt: string | null
  redeemedAt: string | null
}

interface VoucherListProps {
  status: 'active' | 'redeemed'
  emptyKey: TranslationKey
  errorKey: TranslationKey
  dateColumnKey: TranslationKey
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id
}

// Shared by the Active Vouchers and Redemption History pages -- same shape of
// data, same /api/business/vouchers route, differing only in which status
// they ask for and which date column they show.
export default function VoucherList({ status, emptyKey, errorKey, dateColumnKey }: VoucherListProps) {
  const { t } = useBusinessLang()
  const { user } = useAuth()
  const [vouchers, setVouchers] = useState<BusinessVoucher[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setVouchers(null)
    setError(null)
    ;(async () => {
      try {
        const idToken = await user.getIdToken()
        const res = await fetch(`/api/business/vouchers?status=${status}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(data.error ?? t(errorKey))
          return
        }
        setVouchers(data.vouchers ?? [])
      } catch {
        if (!cancelled) setError(t(errorKey))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, status, errorKey, t])

  const dateField = status === 'redeemed' ? 'redeemedAt' : 'takenAt'

  return (
    <div>
      {error && (
        <div className="mb-4 text-sm font-semibold text-red-400 bg-red-950/40 border border-red-900 rounded-xl px-4 py-3">
          {error}
        </div>
      )}
      {vouchers === null && !error && <p className="text-slate-400">{t('bizdash_loading')}</p>}
      {vouchers?.length === 0 && <p className="text-slate-400">{t(emptyKey)}</p>}

      {vouchers && vouchers.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-900 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-500 text-xs uppercase tracking-wide">
                <th className="text-start font-bold px-4 py-3">{t('bizdash_vouchers_col_id')}</th>
                <th className="text-start font-bold px-4 py-3">{t('bizdash_vouchers_col_offer')}</th>
                <th className="text-start font-bold px-4 py-3">{t(dateColumnKey)}</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((voucher) => (
                <tr key={voucher.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 font-mono text-slate-300" dir="ltr">
                    {shortId(voucher.id)}
                  </td>
                  <td className="px-4 py-3 text-white font-semibold">{voucher.offerTitle}</td>
                  <td className="px-4 py-3 text-slate-400" dir="ltr">
                    {formatDate(voucher[dateField])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
