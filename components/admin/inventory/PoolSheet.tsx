'use client'

import { useEffect } from 'react'
import { useAdminT } from '@/lib/admin/translations'

// A centred dialog on desktop, a bottom sheet on phones. Escape or a click on
// the backdrop closes it; the page behind stays put.
export default function PoolSheet({ title, onClose, wide = false, xl = false, children }: { title: string; onClose: () => void; wide?: boolean; xl?: boolean; children: React.ReactNode }) {
  const { t } = useAdminT()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[100dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[90dvh] sm:rounded-3xl ${xl ? 'sm:max-w-5xl' : wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-[#0B1B3D]">{title}</h2>
          <button type="button" aria-label={t('common.close')} onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
