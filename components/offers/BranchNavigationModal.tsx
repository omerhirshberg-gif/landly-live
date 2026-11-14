'use client'

import { useCallback, useEffect, useId, useRef, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '@/lib/i18n/useLang'
import { useBodyScrollLock } from '@/lib/useBodyScrollLock'
import { buildBranchNavigationUrls, type BranchPoint } from '@/lib/maps/navigation'

export interface BranchTarget {
  /** The name as the reader sees it. */
  label: string
  /** The name as the admin wrote it, which is what the maps apps are searched for. */
  name: string
  brand?: string | null
  /** Exact position of a branch picked from Google Places; without it the branch is searched for by name. */
  point?: BranchPoint
}

const ROW = 'flex min-h-14 items-center px-6 text-base font-semibold text-ink transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40'

// "Open in Waze / Google Maps" for one branch of a chain (native: landly-mobile/src/components/BranchNavigationSheet.tsx).
// A bottom sheet below 768px and a centred dialog above. Text only: the branch name, the two apps as real links that
// open in a new tab, Cancel. Escape, the scrim and Cancel close it; Tab stays inside; focus goes back to the tapped card.
export default function BranchNavigationModal({ branch, onClose, returnFocusTo }: { branch: BranchTarget | null; onClose: () => void; returnFocusTo?: HTMLElement | null }) {
  const { t } = useLang()
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const open = !!branch
  useBodyScrollLock(open)

  const close = useCallback(() => {
    onClose()
    returnFocusTo?.focus()
  }, [onClose, returnFocusTo])

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>('a')?.focus()
  }, [open])

  if (!branch || typeof document === 'undefined') return null
  const urls = buildBranchNavigationUrls(branch.name, branch.brand, 'ios', branch.point)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab') return
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('a[href], button') ?? [])
    if (items.length === 0) return
    const first = items[0]!
    const last = items[items.length - 1]!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] md:flex md:items-center md:justify-center">
      <div aria-hidden="true" onClick={close} className="perks-scrim absolute inset-0 bg-ink/30" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="perks-sheet absolute inset-x-0 bottom-0 rounded-t-3xl bg-white pb-[max(12px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_32px_rgba(15,23,42,.12)] md:relative md:inset-auto md:w-full md:max-w-sm md:rounded-3xl md:pb-3 md:shadow-[0_24px_60px_rgba(15,23,42,.18)]"
      >
        <div aria-hidden="true" className="mx-auto mb-2 h-1 w-9 rounded-full bg-slate-300 md:hidden" />
        <div className="px-6 pb-2 pt-2">
          <h2 id={titleId} className="line-clamp-2 text-base font-bold text-ink">
            <bdi dir="auto">{branch.label}</bdi>
          </h2>
          <p className="mt-0.5 text-[13px] text-slate-500">{t('offer_nav_heading')}</p>
        </div>
        <a href={urls.waze} target="_blank" rel="noopener noreferrer" aria-label={t('offer_nav_waze')} onClick={onClose} className={ROW}>
          Waze
        </a>
        <a href={urls.googleMaps} target="_blank" rel="noopener noreferrer" aria-label={t('offer_nav_google')} onClick={onClose} className={ROW}>
          Google Maps
        </a>
        <button type="button" onClick={close} className={`${ROW} w-full font-medium text-slate-500`}>
          {t('avatar_cancel')}
        </button>
      </div>
    </div>,
    document.body
  )
}
