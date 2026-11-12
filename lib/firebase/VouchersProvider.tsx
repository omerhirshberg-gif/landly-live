'use client'

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './useAuth'
import { subscribeToUserVouchers, type VoucherDocument } from './vouchers'

export type MemberVoucher = VoucherDocument & { id: string }

interface VouchersContextValue {
  /** null until the first snapshot, and after a refused read. */
  active: MemberVoucher[] | null
  /** null until loaded (or never asked for: see useVouchers). */
  redeemed: MemberVoucher[] | null
  /** A listener was refused or failed; `reload` opens them again. */
  failed: boolean
  reload: () => void
  /** Registers interest in a list; returns the release. */
  watch: (list: 'active' | 'redeemed') => () => void
}

const VouchersContext = createContext<VouchersContextValue | null>(null)

// One pair of voucher listeners for the whole signed-in session. Home, the
// wallet and the member page used to open their own on the same queries (three
// listeners, each re-fired on every change); now they share these. A list opens
// only while some screen is using it (so the provider costs nothing on pages
// that never ask) and detaches on sign-out or when the last user unmounts.
export function VouchersProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const uid = user?.uid ?? null
  const [active, setActive] = useState<MemberVoucher[] | null>(null)
  const [redeemed, setRedeemed] = useState<MemberVoucher[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [watchers, setWatchers] = useState({ active: 0, redeemed: 0 })

  const watchingActive = watchers.active > 0
  useEffect(() => {
    setActive(null)
    setFailed(false)
    if (!uid || !watchingActive) return
    return subscribeToUserVouchers(
      uid,
      'active',
      (next) => {
        setActive(next)
        setFailed(false)
      },
      () => {
        setActive(null)
        setFailed(true)
      }
    )
  }, [uid, watchingActive, attempt])

  const watchingRedeemed = watchers.redeemed > 0
  useEffect(() => {
    setRedeemed(null)
    if (!uid || !watchingRedeemed) return
    return subscribeToUserVouchers(uid, 'redeemed', setRedeemed, () => {
      setRedeemed(null)
      setFailed(true)
    })
  }, [uid, watchingRedeemed, attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const watch = useCallback((list: 'active' | 'redeemed') => {
    setWatchers((w) => ({ ...w, [list]: w[list] + 1 }))
    return () => setWatchers((w) => ({ ...w, [list]: w[list] - 1 }))
  }, [])

  const value = useMemo(() => ({ active, redeemed, failed, reload, watch }), [active, redeemed, failed, reload, watch])
  return <VouchersContext.Provider value={value}>{children}</VouchersContext.Provider>
}

/**
 * The member's vouchers from the shared listeners. The active list opens for
 * any caller; pass `redeemed: true` from a screen that shows the redeemed list
 * (the wallet, the member page) to open that one too.
 */
export function useVouchers({ redeemed = false }: { redeemed?: boolean } = {}) {
  const context = useContext(VouchersContext)
  if (!context) throw new Error('useVouchers needs a <VouchersProvider>.')
  const { watch } = context
  useEffect(() => watch('active'), [watch])
  useEffect(() => (redeemed ? watch('redeemed') : undefined), [redeemed, watch])
  return context
}
