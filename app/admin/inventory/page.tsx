'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { useAdminT } from '@/lib/admin/translations'
import { buildInventoryRows, filterInventory, sortByUrgency, type HealthFilter, type InventoryOffer, type InventoryPool, type InventoryRow } from '@/lib/admin/inventoryRows'
import Alert from '@/components/admin/Alert'
import { CardSkeletons } from '@/components/admin/Card'
import EmptyState from '@/components/admin/EmptyState'
import { FilterChips, ResultCount, SearchInput } from '@/components/admin/ListToolbar'
import PageHeader from '@/components/admin/PageHeader'
import InventoryTable, { UploadIcon } from '@/components/admin/inventory/InventoryTable'
import SmartMultipassImportModal from '@/components/admin/offers/SmartMultipassImportModal'
import { PRIMARY_BUTTON } from '@/components/admin/formStyles'

interface Payload {
  offers: InventoryOffer[]
  pools: InventoryPool[]
  encryptionConfigured: boolean
}

// Stock for every perk in one grid: Multipass perks draw from supplier codes (encrypted on
// upload, handed out one per purchase inside the checkout transaction) and are restocked here
// from a spreadsheet; local-business perks count claims against the perk's own limit.
export default function InventoryPage() {
  const { t } = useAdminT()
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [health, setHealth] = useState<HealthFilter>('all')
  // 'any': the perk is chosen in the dialog; otherwise the row it was opened from.
  const [restock, setRestock] = useState<{ offerId: string; title: string } | 'any' | null>(null)

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

  const allRows = useMemo(() => (data ? sortByUrgency(buildInventoryRows(data.offers, data.pools)) : []), [data])
  const rows = useMemo(() => filterInventory(allRows, { query, health }), [allRows, query, health])
  const healthOptions = [
    { value: 'all', label: t('inv.filter.all') },
    { value: 'low', label: t('inv.filter.low') },
    { value: 'out', label: t('inv.filter.out') },
  ] as const

  const clear = () => {
    setQuery('')
    setHealth('all')
  }

  return (
    <>
      <PageHeader
        title={t('route.Inventory')}
        actions={
          <button type="button" className={`${PRIMARY_BUTTON} w-full sm:w-auto`} onClick={() => setRestock('any')} aria-busy={!data}>
            <UploadIcon />
            {t('inv.uploadMultipass')}
          </button>
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

      {data && allRows.length === 0 && <EmptyState icon="fa-boxes-stacked" title={t('inv.noPerks')} description={t('inv.noPerksBody')} />}

      {data && allRows.length > 0 && (
        <div className="space-y-4">
          <SearchInput label={t('inv.search')} placeholder={t('inv.searchPlaceholder')} value={query} onChange={setQuery} className="max-w-xl" />
          <FilterChips label={t('inv.filterLabel')} options={healthOptions} value={health} onChange={setHealth} />
          <ResultCount shown={rows.length} total={allRows.length} noun={t('inv.nounPerks')} />
          {rows.length === 0 ? (
            <EmptyState
              icon="fa-magnifying-glass"
              title={t('inv.noMatchTitle')}
              description={t('inv.noMatchBody')}
              action={<button type="button" className={PRIMARY_BUTTON} onClick={clear}>{t('list.clearFilters')}</button>}
            />
          ) : (
            <InventoryTable rows={rows} onRestock={(row: InventoryRow) => setRestock({ offerId: row.id, title: row.title })} />
          )}
        </div>
      )}

      {restock && (
        <SmartMultipassImportModal
          fixedPerk={restock === 'any' ? undefined : restock}
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
