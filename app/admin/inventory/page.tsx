'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { useAdminT } from '@/lib/admin/translations'
import type { InventoryOffer, InventoryPool } from '@/lib/admin/inventoryRows'
import Alert from '@/components/admin/Alert'
import { CardSkeletons } from '@/components/admin/Card'
import EmptyState from '@/components/admin/EmptyState'
import PageHeader from '@/components/admin/PageHeader'
import { UploadIcon } from '@/components/admin/inventory/InventoryTable'
import RaayonitCardsPanel from '@/components/admin/inventory/RaayonitCardsPanel'
import RaayonitStockModal, { type RaayonitStock } from '@/components/admin/inventory/RaayonitStockModal'
import NewVoucherTypeSheet from '@/components/admin/inventory/NewVoucherTypeSheet'
import LedgerPanel from '@/components/admin/inventory/LedgerPanel'
import StatusBadge from '@/components/admin/StatusBadge'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/admin/formStyles'

interface Payload {
  offers: InventoryOffer[]
  pools: InventoryPool[]
  encryptionConfigured: boolean
}

// Stock for every perk in one grid: Raayonit vouchers draw from shared stocks, one per voucher value
// (codes encrypted on upload, handed out one per purchase inside the checkout transaction) that
// every linked offer sells from, and are added here from Raayonit's Excel file; local-business perks
// count claims against the perk's own limit.
export default function InventoryPage() {
  const { t } = useAdminT()
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // 'any': every stock, split by the sheet's amounts; otherwise the one stock it was opened from.
  const [restock, setRestock] = useState<RaayonitStock | 'any' | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await adminFetch('/api/admin/pools')
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setError(t('inv.loadFailed'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const stocks = useMemo(
    () => (data?.pools ?? []).filter((p) => p.faceValueAgorot != null).map((p) => ({ poolId: p.poolId, title: p.title || `₪${(p.faceValueAgorot ?? 0) / 100}`, faceValueAgorot: p.faceValueAgorot ?? null })),
    [data],
  )
  return (
    <>
      <PageHeader
        title={t('route.Inventory')}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button type="button" className={`${SECONDARY_BUTTON} w-full sm:w-auto`} onClick={() => setCreating(true)} aria-busy={!data}>
              {t('inv.raayonit.new')}
            </button>
            <button type="button" className={`${PRIMARY_BUTTON} w-full sm:w-auto`} onClick={() => setRestock('any')} aria-busy={!data} disabled={stocks.length === 0}>
              <UploadIcon />
              {t('inv.uploadRaayonit')}
            </button>
          </div>
        }
      />
      {error && <Alert className="mb-4">{error}</Alert>}
      {notice && <Alert tone="success" className="mb-4">{notice}</Alert>}
      {data && !data.encryptionConfigured && (
        <Alert tone="warning" className="mb-4">
          <span>
            <bdi dir="ltr" className="font-mono">POOL_CODES_KEY</bdi> {t('inv.keyMissing')}{' '}
            <bdi dir="ltr" className="font-mono">openssl rand -base64 32</bdi>.
          </span>
        </Alert>
      )}
      {!data && !error && <CardSkeletons count={3} />}

      {data && (
        <section aria-labelledby="raayonit-stocks" className="mb-8">
          <h2 id="raayonit-stocks" className="text-base font-bold tracking-tight text-adm-text">{t('inv.raayonit.title')}</h2>
          <p className="mb-4 mt-1 text-sm text-adm-muted">{t('inv.raayonit.subtitle')}</p>
          {stocks.length === 0 ? (
            <EmptyState icon="fa-boxes-stacked" title={t('inv.raayonit.empty')} description={t('inv.raayonit.emptyBody')} action={<button type="button" className={PRIMARY_BUTTON} onClick={() => setCreating(true)}>{t('inv.raayonit.new')}</button>} />
          ) : (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.pools.filter((p) => p.faceValueAgorot != null).map((pool) => {
                const linked = data.offers.filter((o) => o.poolId === pool.poolId).length
                const low = pool.remainingCount <= pool.warningThreshold
                return (
                  <li key={pool.poolId} className="flex flex-col gap-4 rounded-3xl border border-adm-line bg-adm-surface p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p dir="auto" className="line-clamp-2 break-words font-semibold text-adm-text">{pool.title}</p>
                        <p className="mt-0.5 text-sm text-adm-muted">{t('inv.raayonit.worth', { value: (pool.faceValueAgorot ?? 0) / 100, price: (pool.priceAgorot ?? 0) / 100 })}</p>
                      </div>
                      {pool.status === 'archived' ? <StatusBadge tone="slate">{t('inv.archived')}</StatusBadge> : pool.remainingCount <= 0 ? <StatusBadge tone="rose" icon="fa-box-open">{t('inv.outBadge')}</StatusBadge> : low ? <StatusBadge tone="amber" icon="fa-triangle-exclamation">{t('inv.lowBadge')}</StatusBadge> : null}
                    </div>
                    <p className="flex items-baseline gap-4 text-sm text-adm-text-2">
                      <span><bdi dir="ltr" className="text-2xl font-bold tabular-nums text-adm-text">{pool.remainingCount}</bdi> {t('inv.raayonit.available')}</span>
                      <span><bdi dir="ltr" className="font-semibold tabular-nums">{pool.allocatedCount}</bdi> {t('inv.raayonit.sold')}</span>
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-3">
                      <span className="text-xs text-adm-muted">{t('inv.raayonit.offers', { n: linked })}</span>
                      <button type="button" disabled={pool.status === 'archived'} className={SECONDARY_BUTTON} onClick={() => setRestock({ poolId: pool.poolId, title: pool.title ?? '', faceValueAgorot: pool.faceValueAgorot ?? null })}>
                        <UploadIcon />
                        {t('inv.raayonit.addCodes')}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {data && <LedgerPanel />}

      {data && <RaayonitCardsPanel onChanged={() => void load()} />}

      {creating && <NewVoucherTypeSheet onClose={() => setCreating(false)} onDone={() => { setCreating(false); void load() }} />}
      {restock && (
        <RaayonitStockModal
          stocks={stocks}
          fixed={restock === 'any' ? undefined : restock}
          onClose={() => setRestock(null)}
          onDone={(message) => {
            setRestock(null)
            setNotice(message)
            void load()
          }}
        />
      )}
    </>
  )
}
