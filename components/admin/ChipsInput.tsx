'use client'

import { useState } from 'react'
import { useAdminT } from '@/lib/admin/translations'
import { ADMIN_HINT, ADMIN_LABEL } from '@/components/admin/formStyles'

/** Free-text tags: Enter or a comma adds one, a duplicate is ignored, each has a remove button. */
export default function ChipsInput({ id, label, hint, placeholder, value, onChange }: { id: string; label: string; hint?: string; placeholder: string; value: string[]; onChange: (next: string[]) => void }) {
  const { t } = useAdminT()
  const [draft, setDraft] = useState('')
  const add = (raw: string) => {
    const names = raw.split(/[,;\n]/).map((n) => n.replace(/\s+/g, ' ').trim()).filter(Boolean)
    if (names.length === 0) return
    const have = new Set(value.map((v) => v.toLowerCase()))
    const next = [...value]
    for (const name of names) if (!have.has(name.toLowerCase())) { have.add(name.toLowerCase()); next.push(name) }
    onChange(next)
    setDraft('')
  }
  return (
    <div>
      {label && <label htmlFor={id} className={ADMIN_LABEL}>{label}</label>}
      {!label && <span className="sr-only"><label htmlFor={id}>{placeholder}</label></span>}
      <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 focus-within:border-[#0038B8] focus-within:ring-2 focus-within:ring-[#0038B8]/20">
        {value.map((name) => (
          <span key={name} className="inline-flex items-center gap-1 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] py-1 ps-3 pe-1 text-sm font-medium text-[#0B1B3D]">
            <bdi dir="auto">{name}</bdi>
            <button type="button" aria-label={t('wizard.chainRemove', { name })} onClick={() => onChange(value.filter((v) => v !== name))} className="-my-2.5 -me-1 flex h-11 w-11 items-center justify-center rounded-full text-[#475569] hover:bg-[#DBEAFE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8]">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="done"
          className="min-w-[8rem] flex-1 bg-transparent py-1 text-base outline-none placeholder:text-[#94A3B8]"
          onChange={(e) => (/[,;]/.test(e.target.value) ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(draft)
            } else if (e.key === 'Backspace' && draft === '' && value.length > 0) onChange(value.slice(0, -1))
          }}
          onBlur={() => add(draft)}
        />
      </div>
      {hint && <p className={ADMIN_HINT}>{hint}</p>}
    </div>
  )
}
