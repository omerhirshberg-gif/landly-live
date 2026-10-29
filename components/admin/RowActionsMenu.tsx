'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'

export interface RowAction {
  label: string
  icon: string
  href?: string
  onSelect?: () => void
  /** Destructive: drawn in red, after a divider. */
  danger?: boolean
}

const MENU_ITEM_BUTTON = 'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-start text-sm font-semibold transition-colors focus-visible:outline-none'

// One ⋯ button per row (or page) instead of a cluster of competing buttons:
// a small menu of its actions, the destructive ones last and in red. Opens
// below the button's end edge; Escape, a click outside or choosing an item
// closes it, and focus goes back to the button. Every item is a 44px target.
export default function RowActionsMenu({ label, actions, className = '' }: { label: string; actions: readonly RowAction[]; className?: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (refocus: boolean) => {
      setOpen(false)
      if (refocus) buttonRef.current?.focus()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const choose = (action: RowAction) => {
    setOpen(false)
    action.onSelect?.()
  }
  const tone = (danger?: boolean) =>
    danger ? 'text-[#B91C1C] hover:bg-[#FEF2F2] focus-visible:bg-[#FEF2F2]' : 'text-[#0B1B3D] hover:bg-[#F1F5F9] focus-visible:bg-[#F0F7FF]'
  const safe = actions.filter((action) => !action.danger)
  const danger = actions.filter((action) => action.danger)

  return (
    <div ref={rootRef} className={`relative ${className}`} onClick={(event) => event.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((was) => !was)}
        className="flex h-11 w-11 items-center justify-center rounded-xl text-[#475569] transition-colors hover:bg-[#F1F5F9] hover:text-[#0B1B3D] active:bg-[#E2E8F0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8] [-webkit-tap-highlight-color:transparent]"
      >
        <i className="fa-solid fa-ellipsis" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          aria-label={label}
          className="absolute end-0 top-full z-30 mt-1 w-56 rounded-xl border border-[#E2E8F0] bg-white p-1 shadow-lg shadow-slate-900/10"
        >
          {[safe, danger].map(
            (group, i) =>
              group.length > 0 && (
                <div key={i} className={i > 0 && safe.length > 0 ? 'mt-1 border-t border-[#E2E8F0] pt-1' : undefined}>
                  {group.map((action) =>
                    action.href ? (
                      <Link key={action.label} href={action.href} role="menuitem" className={`${MENU_ITEM_BUTTON} ${tone(action.danger)}`} onClick={() => setOpen(false)}>
                        <i className={`fa-solid ${action.icon} w-4 text-center text-xs`} aria-hidden="true" />
                        {action.label}
                      </Link>
                    ) : (
                      <button key={action.label} type="button" role="menuitem" className={`${MENU_ITEM_BUTTON} ${tone(action.danger)}`} onClick={() => choose(action)}>
                        <i className={`fa-solid ${action.icon} w-4 text-center text-xs`} aria-hidden="true" />
                        {action.label}
                      </button>
                    )
                  )}
                </div>
              )
          )}
        </div>
      )}
    </div>
  )
}
