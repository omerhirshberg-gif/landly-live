'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useAdminT } from '@/lib/admin/translations'
import { ADMIN_INPUT, ADMIN_LABEL } from '@/components/admin/formStyles'
import { directionalProps } from '@/lib/directionalInput'

export interface PerkOption {
  id: string
  title: string
  businessName: string
  remaining: number
}

/** Case-insensitive match on the perk or its business. */
export function filterPerks(options: readonly PerkOption[], query: string): PerkOption[] {
  const q = query.trim().toLowerCase()
  return q ? options.filter((o) => o.title.toLowerCase().includes(q) || o.businessName.toLowerCase().includes(q)) : [...options]
}

// A searchable list of perks (a WAI-ARIA combobox): type to narrow it, arrows and Enter or a tap to pick.
export default function PerkCombobox({ options, value, onChange }: { options: readonly PerkOption[]; value: string; onChange: (id: string) => void }) {
  const { t, dir: uiDir } = useAdminT()
  const uid = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.id === value) ?? null
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const matches = useMemo(() => filterPerks(options, query), [options, query])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const pick = (option: PerkOption) => {
    onChange(option.id)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <label htmlFor={`${uid}-input`} className={ADMIN_LABEL}>{t('inv.pickPerk')}</label>
      <input
        id={`${uid}-input`}
        type="text"
        role="combobox"
        {...directionalProps(open ? query : selected ? selected.title : '', t('inv.pickPerkSearch'), uiDir === 'rtl')}
        aria-expanded={open}
        aria-controls={`${uid}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${uid}-${matches[active]!.id}` : undefined}
        autoComplete="off"
        placeholder={t('inv.pickPerkSearch')}
        value={open ? query : selected ? selected.title : ''}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActive((i) => Math.min(i + 1, matches.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter' && open && matches[active]) {
            e.preventDefault()
            pick(matches[active]!)
          } else if (e.key === 'Escape' && open) {
            e.stopPropagation()
            setOpen(false)
          }
        }}
        className={`${ADMIN_INPUT} ps-4`}
      />
      {open && (
        <ul id={`${uid}-list`} role="listbox" className="absolute inset-x-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-xl border border-[#E2E8F0] bg-white py-1 shadow-lg">
          {matches.length === 0 && <li className="px-4 py-3 text-sm text-[#64748B]">{t('inv.noPerkMatch')}</li>}
          {matches.map((option, i) => (
            <li
              key={option.id}
              id={`${uid}-${option.id}`}
              role="option"
              aria-selected={option.id === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(option)}
              onMouseEnter={() => setActive(i)}
              className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm ${i === active ? 'bg-[#F0F7FF]' : ''}`}
            >
              <span className="min-w-0">
                <span dir="auto" className="block break-words font-semibold text-[#0B1B3D]">{option.title}</span>
                <span dir="auto" className="block break-words text-xs text-[#64748B]">{option.businessName}</span>
              </span>
              <span className="shrink-0 text-xs text-[#475569]">{t('inv.leftN', { n: `\u2066${option.remaining}\u2069` })}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
