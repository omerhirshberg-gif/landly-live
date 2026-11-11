'use client'

import { useAdminT } from '@/lib/admin/translations'
import type { InventoryRow } from '@/lib/admin/inventoryRows'
import BidiText from '@/components/admin/BidiText'
import DataTable from '@/components/admin/DataTable'
import StatusBadge from '@/components/admin/StatusBadge'
import { SECONDARY_BUTTON } from '@/components/admin/formStyles'
import Link from 'next/link'

/** A perk's stock: the number over a bar. Amber once low, red at zero; a local perk with no limit has none. */
function StockBar({ row }: { row: InventoryRow }) {
  const { t } = useAdminT()
  if (row.remaining === null) return <span className="text-sm text-[#475569]">{t('common.unlimited')}</span>
  const total = row.purchased ?? 0
  const share = total ? Math.min(100, Math.round((row.remaining / total) * 100)) : 0
  const tone = row.health === 'out' ? 'bg-[#DC2626]' : row.health === 'low' ? 'bg-amber-500' : 'bg-[#0038B8]'
  return (
    <div className="min-w-[110px]">
      <bdi dir="ltr" className="text-lg font-bold tabular-nums text-[#0B1B3D]">{row.remaining}</bdi>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]" aria-hidden="true">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${share}%` }} />
      </div>
    </div>
  )
}

function HealthBadge({ row }: { row: InventoryRow }) {
  const { t } = useAdminT()
  if (row.archived) return <StatusBadge tone="slate">{t('inv.archived')}</StatusBadge>
  if (row.health === 'out') return <StatusBadge tone="rose" icon="fa-box-open">{t('inv.outBadge')}</StatusBadge>
  if (row.health === 'low') return <StatusBadge tone="amber" icon="fa-triangle-exclamation">{t('inv.lowBadge')}</StatusBadge>
  return <StatusBadge tone="emerald" icon="fa-circle-check">{t('status.active')}</StatusBadge>
}

function RestockButton({ row, onRestock }: { row: InventoryRow; onRestock: (row: InventoryRow) => void }) {
  const { t } = useAdminT()
  if (row.kind !== 'multipass') return <span className="text-xs text-[#64748B]">—</span>
  return (
    <button
      type="button"
      disabled={row.archived}
      title={row.archived ? t('inv.archivedNote') : undefined}
      onClick={(e) => {
        e.stopPropagation()
        onRestock(row)
      }}
      className={`${SECONDARY_BUTTON} whitespace-nowrap`}
    >
      <UploadIcon />
      {t('inv.restock')}
    </button>
  )
}

export function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 20h16" />
    </svg>
  )
}

function Identity({ row }: { row: InventoryRow }) {
  return (
    <span className="block min-w-0">
      <Link href={`/admin/offers/${row.id}/edit`} className="block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8]">
        <BidiText lines={2} className="font-semibold text-[#0B1B3D] hover:text-[#0038B8]">{row.title}</BidiText>
      </Link>
      <BidiText lines={2} className="text-xs text-[#64748B]">{row.businessName}</BidiText>
    </span>
  )
}

const LOW_EDGE = '[&>td:first-child]:border-s-4 [&>td:first-child]:border-s-[#DC2626] border-s-4 border-s-[#DC2626]'

/** Every perk's stock in one grid; Multipass rows can be restocked, local-business rows show claims against their limit. */
export default function InventoryTable({ rows, onRestock }: { rows: InventoryRow[]; onRestock: (row: InventoryRow) => void }) {
  const { t } = useAdminT()
  const typeLabel = (row: InventoryRow) => (row.kind === 'multipass' ? t('inv.type.multipass') : t('inv.type.direct'))
  const isAlert = (row: InventoryRow) => row.health === 'low' || row.health === 'out'
  return (
    <DataTable
      label={t('route.Inventory')}
      rows={rows}
      rowKey={(row) => row.id}
      rowClassName={(row) => (isAlert(row) ? LOW_EDGE : '')}
      columns={[
        { id: 'perk', header: t('inv.col.perk'), sortValue: (row) => row.title, cell: (row) => <Identity row={row} /> },
        { id: 'type', header: t('inv.col.type'), sortValue: typeLabel, cell: (row) => <StatusBadge tone={row.kind === 'multipass' ? 'blue' : 'slate'} icon={row.kind === 'multipass' ? 'fa-boxes-stacked' : 'fa-store'}>{typeLabel(row)}</StatusBadge> },
        {
          id: 'purchased',
          header: t('inv.col.purchased'),
          align: 'end',
          sortValue: (row) => row.purchased ?? Number.MAX_SAFE_INTEGER,
          cell: (row) => (row.purchased === null ? <span className="text-[#475569]">{t('common.unlimited')}</span> : <bdi dir="ltr" className="tabular-nums">{row.purchased}</bdi>),
        },
        { id: 'claimed', header: t('inv.col.claimed'), align: 'end', sortValue: (row) => row.claimed, cell: (row) => <bdi dir="ltr" className="font-semibold tabular-nums text-[#0B1B3D]">{row.claimed}</bdi> },
        {
          id: 'remaining',
          header: t('inv.col.remaining'),
          sortValue: (row) => row.remaining ?? Number.MAX_SAFE_INTEGER,
          cell: (row) => (
            <div className="flex items-center gap-3">
              <StockBar row={row} />
              {row.health !== 'ok' && row.health !== 'unlimited' ? <HealthBadge row={row} /> : null}
            </div>
          ),
        },
        { id: 'restock', header: '', align: 'end', cell: (row) => <RestockButton row={row} onRestock={onRestock} /> },
      ]}
      card={(row) => (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <Identity row={row} />
            <HealthBadge row={row} />
          </div>
          <StockBar row={row} />
          <dl className="grid grid-cols-3 gap-3 text-xs">
            <div><dt className="text-[#64748B]">{t('inv.col.type')}</dt><dd className="font-semibold text-[#0B1B3D]">{typeLabel(row)}</dd></div>
            <div><dt className="text-[#64748B]">{t('inv.col.purchased')}</dt><dd className="font-semibold text-[#0B1B3D]">{row.purchased === null ? t('common.unlimited') : <bdi dir="ltr" className="tabular-nums">{row.purchased}</bdi>}</dd></div>
            <div><dt className="text-[#64748B]">{t('inv.col.claimed')}</dt><dd className="font-semibold text-[#0B1B3D]"><bdi dir="ltr" className="tabular-nums">{row.claimed}</bdi></dd></div>
          </dl>
          {row.kind === 'multipass' && <RestockButton row={row} onRestock={onRestock} />}
        </div>
      )}
    />
  )
}
