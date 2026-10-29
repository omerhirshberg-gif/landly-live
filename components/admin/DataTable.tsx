'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Card from './Card'
import RowActionsMenu, { type RowAction } from './RowActionsMenu'

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
   * The column's fixed width (a Tailwind width class, e.g. 'w-32'). When
   * every column but the first has one, the table lays out fixed: the first
   * column takes whatever's left, so no gap opens between it and the rest.
   */
  width?: string
}

type Sort = { id: string; direction: 'asc' | 'desc' } | null

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

// A list page's results, dense and readable: from lg a table whose columns
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
  initialSort?: Sort
}) {
  const router = useRouter()
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

  const fixed = columns.slice(1).every((column) => column.width)

  const toggleSort = (id: string) =>
    setSort((prev) => (prev?.id === id ? { id, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { id, direction: 'asc' }))

  return (
    <>
      <Card className="hidden lg:block">
        <table className={`w-full text-start text-sm ${fixed ? 'table-fixed' : ''}`} aria-label={label}>
          <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
            <tr>
              {columns.map((column) => {
                const sorting = sort?.id === column.id ? sort.direction : null
                const align = column.align === 'end' ? 'text-end' : 'text-start'
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={sorting === 'asc' ? 'ascending' : sorting === 'desc' ? 'descending' : undefined}
                    className={`px-5 py-1 first:rounded-ss-2xl last:rounded-se-2xl ${align} ${column.width ?? ''} ${column.className ?? ''}`}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.id)}
                        className={`inline-flex min-h-11 items-center gap-1.5 uppercase tracking-wider transition-colors hover:text-[#0B1B3D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8] ${
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
                <th scope="col" className="w-14 px-3 py-1">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {sorted.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={rowHref ? () => router.push(rowHref(row)) : undefined}
                className={rowHref ? 'cursor-pointer transition-colors hover:bg-[#F8FAFC]' : ''}
              >
                {columns.map((column, i) => (
                  <td
                    key={column.id}
                    className={`px-5 py-3.5 ${column.align === 'end' ? 'text-end' : 'text-start'} ${i === 0 ? (fixed ? 'overflow-hidden' : 'max-w-0 w-full') : 'whitespace-nowrap'} ${column.className ?? ''}`}
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
                    <RowActionsMenu label="Actions" actions={actions(row)} className="flex justify-end" />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="space-y-3 lg:hidden">
        {sorted.map((row) => (
          <Card key={rowKey(row)} href={rowHref?.(row)} className="block p-4">
            {card(row)}
          </Card>
        ))}
      </div>
    </>
  )
}
