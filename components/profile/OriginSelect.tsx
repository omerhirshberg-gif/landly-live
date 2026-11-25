'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, X } from 'lucide-react'
import { countryName, flagEmoji } from '@/lib/auth/onboarding'
import { isCountryCode } from '@/lib/profile/countryOfOrigin'
import { useLang } from '@/lib/i18n/useLang'
import CountryOfOriginPicker from './CountryOfOriginPicker'

// Edit profile's "Country of origin" (the app's twin: OriginSelectRow and
// CountryOfOriginSheet): one selector row (flag, name, a chevron at the
// trailing edge) with no list on the page. It opens the searchable
// CountryOfOriginPicker in a bottom sheet on phones and a centred dialog from
// md. Esc, the scrim and the close button dismiss it; choosing a country
// closes it and returns focus to the row. Nothing is focused until the member
// acts.
export default function OriginSelect({ id, value, onChange }: { id: string; value: string; onChange: (code: string) => void }) {
  const { t, lang } = useLang()
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const rowRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const chosen = isCountryCode(value) ? value : null

  const close = () => {
    setOpen(false)
    rowRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      close()
      return
    }
    if (e.key !== 'Tab') return
    // Keep Tab inside the dialog.
    const stops = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not([tabindex="-1"]), input, [tabindex="0"]') ?? [])
    if (!stops.length) return
    const first = stops[0]
    const last = stops[stops.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <>
      <button
        ref={rowRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="tap-target flex min-h-[52px] w-full items-center gap-3 rounded-[14px] border-[1.5px] border-slate-200 bg-slate-50 px-3.5 text-start transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:border-brand focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-brand/20 [@media(hover:hover)]:hover:border-slate-300"
      >
        {chosen && <span aria-hidden="true" className="text-xl leading-6">{flagEmoji(chosen)}</span>}
        <span className={`min-w-0 flex-1 truncate text-base ${chosen ? 'text-ink' : 'text-slate-400'}`}>
          {chosen ? countryName(chosen, lang) : t('profile_origin_select')}
        </span>
        <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] flex-shrink-0 text-slate-400 rtl:-scale-x-100" strokeWidth={2} />
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-end md:items-center md:justify-center">
            <div aria-hidden="true" onClick={close} className="perks-scrim absolute inset-0 bg-ink/30" />
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onKeyDown={onKeyDown}
              className="origin-dialog relative flex max-h-[88dvh] w-full flex-col rounded-t-[28px] bg-white px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] shadow-2xl md:max-h-[min(80dvh,640px)] md:max-w-[480px] md:rounded-3xl md:px-5 md:pt-4 md:pb-5"
            >
              <div aria-hidden="true" className="mx-auto mb-2 h-1 w-9 rounded-full bg-slate-300 md:hidden" />
              <div className="flex items-center justify-between gap-3 pb-2">
                <h2 id={titleId} className="text-base font-bold text-ink">{t('profile_origin_label')}</h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label={t('onb_close')}
                  className="-me-2 flex h-11 w-11 items-center justify-center rounded-full text-slate-500 [@media(hover:hover)]:hover:bg-slate-100"
                >
                  <X aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <CountryOfOriginPicker
                  value={value}
                  labelledBy={titleId}
                  listClassName="max-h-[min(52dvh,380px)]"
                  onChange={(code) => {
                    onChange(code)
                    close()
                  }}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
