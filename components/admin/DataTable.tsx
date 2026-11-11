'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Card from './Card'
import RowActionsMenu, { type RowAction } from './RowActionsMenu'
import { useAdminT } from '@/lib/admin/translations'

export interface Column<Row> {
  id: string
  header: string
  cell: (row: Row) => React.ReactNode
  /** Makes the column sortable by this value. */
  sortValue?: (row: Row) => string | number
  align?: 'start' | 'end'
  /** Extra classes for the column's cells (e.g. hidden below xl). */
  className?: string
  /**
   * The column's width as Tailwind classes (e.g. 'w-[120px]'), used as its
   * floor: the column never shrinks below it, so nothing is squeezed or cut.
   * Columns without one size to their content; the first takes the spare room.
   */
  width?: string
}

type Sort = { id: string; direction: 'asc' | 'desc' } | null

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

// A list page's results, dense and readable. The table fills the page (the
// shell's 1600px canvas) and scrolls sideways inside its own frame when the
// columns need more than the screen gives (below 1280px beside the sidebar),
// so no column is ever squeezed and no essential text is cut off: titles wrap
// onto two lines instead. From lg a table whose columns
// sort (click a header; again to reverse), each row opening its page (the
// first cell's link keeps that reachable by keyboard; a table without
// rowHref is read-only) with its other actions in a ⋯ menu at the row's end;
// below lg (phones, and tablets beside the sidebar) the same rows as
// tappable cards. Cells start at the column's start edge; names inside them
// keep their own direction (BidiText). Filtering stays with the page
// (ListToolbar), which passes the rows already filtered.
export default function DataTable<Row>({
  label,
  rows,
  rowKey,
  rowHref,
  columns,
  card,
  actions,
  rowClassName,
  initialSort = null,
}: {
  /** The table's accessible name, e.g. "Offers". */
  label: string
  rows: readonly Row[]
  rowKey: (row: Row) => string
  /** Where a row opens; without it rows are read-only (their own links still work). */
  rowHref?: (row: Row) => string
  columns: readonly Column<Row>[]
  /** The row as a phone card. */
  card: (row: Row) => React.ReactNode
  actions?: (row: Row) => readonly RowAction[]
  /** Extra classes for a row (and its phone card), e.g. a warning edge. */
  rowClassName?: (row: Row) => string
  initialSort?: Sort
}) {
  const router = useRouter()
  const { t, locale } = useAdminT()
  const [sort, setSort] = useState<Sort>(initialSort)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const column = columns.find((c) => c.id === sort.id)
    if (!column?.sortValue) return rows
    const value = column.sortValue
    const sign = sort.direction === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const x = value(a)
      const y = value(b)
      return sign * (typeof x === 'number' && typeof y === 'number' ? x - y : collator.compare(String(x), String(y)))
    })
  }, [rows, columns, sort])

  const toggleSort = (id: string) =>
    setSort((prev) => (prev?.id === id ? { id, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { id, direction: 'asc' }))

  return (
    <>
      <Card className="hidden overflow-hidden lg:block">
        <div className="admin-table-scroll overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[960px] text-start text-sm font-medium" aria-label={label}>
          <thead className={`border-b border-[#E2E8F0] bg-[#F8FAFC] text-[13px] font-bold text-[#64748B] ${locale === 'he' ? '' : 'uppercase tracking-wider'}`}>
            <tr>
              {columns.map((column, i) => {
                const sorting = sort?.id === column.id ? sort.direction : null
                const align = column.align === 'end' ? 'text-end' : 'text-start'
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={sorting === 'asc' ? 'ascending' : sorting === 'desc' ? 'descending' : undefined}
                    className={`px-5 py-1 ${align} ${column.width ?? ''} ${i === 0 ? 'min-w-[240px]' : 'whitespace-nowrap'} ${column.className ?? ''}`}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.id)}
                        className={`inline-flex min-h-11 items-center gap-1.5 transition-colors hover:text-[#0B1B3D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8] ${
                          column.align === 'end' ? 'flex-row-reverse' : ''
                        } ${sorting ? 'text-[#0B1B3D]' : ''}`}
                      >
                        {column.header}
                        <i
                          className={`fa-solid ${sorting === 'asc' ? 'fa-arrow-up-short-wide' : sorting === 'desc' ? 'fa-arrow-down-wide-short' : 'fa-sort'} text-[10px] ${sorting ? '' : 'opacity-40'}`}
                          aria-hidden="true"
                        />
                      </button>
                    ) : (
                      <span className="inline-flex min-h-11 items-center">{column.header}</span>
                    )}
                  </th>
                )
              })}
              {actions && (
                <th scope="col" className="w-16 px-3 py-1 text-end">
                  <span className="sr-only">{t('table.actions')}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {sorted.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={rowHref ? () => router.push(rowHref(row)) : undefined}
                className={`${rowHref ? 'cursor-pointer transition-colors hover:bg-[#F8FAFC]' : ''} ${rowClassName?.(row) ?? ''}`}
              >
                {columns.map((column, i) => (
                  <td
                    key={column.id}
                    className={`px-5 py-3.5 ${column.align === 'end' ? 'text-end' : 'text-start'} ${column.width ?? ''} ${i === 0 ? 'w-full min-w-[240px] break-words align-middle' : 'whitespace-nowrap'} ${column.className ?? ''}`}
                  >
                    {i === 0 && rowHref ? (
                      <Link
                        href={rowHref(row)}
                        onClick={(event) => event.stopPropagation()}
                        className="block min-w-0 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8]"
                      >
                        {column.cell(row)}
                      </Link>
                    ) : (
                      column.cell(row)
                    )}
                  </td>
                ))}
                {actions && (
                  <td className="px-3 py-2">
                    <RowActionsMenu label={t('table.actions')} actions={actions(row)} className="flex justify-end" />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>

      <div className="space-y-3 lg:hidden">
        {sorted.map((row) => (
          <Card key={rowKey(row)} href={rowHref?.(row)} className={`block p-4 ${rowClassName?.(row) ?? ''}`}>
            {card(row)}
          </Card>
        ))}
      </div>
    </>
  )
}
