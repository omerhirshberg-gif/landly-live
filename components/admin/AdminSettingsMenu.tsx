'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useAdminT } from '@/lib/admin/translations'
import AdminLangSwitch from './AdminLangSwitch'
import AdminThemeSwitch from './AdminThemeSwitch'

// The header's one settings control: a gear that opens a small menu with the
// admin's language, its background (dark or light) and Sign out. Escape or a
// click/tap outside closes it and hands focus back to the gear; opening moves
// focus to the first control. The popover opens under the gear toward the page
// (end edge in the page's direction), and is as wide as its controls need.
export default function AdminSettingsMenu({ onLogout }: { onLogout: () => void }) {
  const { t } = useAdminT()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const close = (restoreFocus: boolean) => {
      setOpen(false)
      if (restoreFocus) buttonRef.current?.focus()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    panelRef.current?.querySelector<HTMLElement>('button')?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={t('settings.open')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex h-11 w-11 items-center justify-center rounded-xl border border-transparent text-adm-text-2 transition-colors hover:bg-adm-raised hover:text-adm-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent/50 [-webkit-tap-highlight-color:transparent] ${
          open ? 'bg-adm-raised text-adm-text' : ''
        }`}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="menu"
          aria-label={t('settings.title')}
          className="absolute end-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-adm-line bg-adm-surface p-3 shadow-xl shadow-black/30"
        >
          <div role="none" className="space-y-3">
            <div role="none">
              <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-adm-muted">{t('header.language')}</p>
              <AdminLangSwitch className="flex w-full" />
            </div>
            <div role="none">
              <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-adm-muted">{t('settings.theme')}</p>
              <AdminThemeSwitch className="flex w-full" />
            </div>
          </div>
          <div className="mt-3 border-t border-adm-line pt-2">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onLogout()
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-[15px] font-semibold text-adm-text-2 transition-colors hover:bg-adm-danger-soft hover:text-adm-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent/50"
            >
              <i className="fa-solid fa-right-from-bracket w-5 text-center text-sm" aria-hidden="true" />
              {t('settings.signOut')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
