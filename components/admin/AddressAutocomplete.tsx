'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import type { GeoAddress } from '@/lib/geo'
import { CONTENT_LANGS, directionOf } from '@/lib/i18n/contentTranslation'
import { LANGUAGES } from '@/lib/i18n/languages'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL } from './formStyles'

export interface AddressValue {
  /** What the field shows and the business's `location` string. */
  text: string
  /** The picked place; null while the text is typed, not picked. */
  address: GeoAddress | null
}

interface Suggestion {
  placeId: string
  main: string
  secondary: string
}

const newSessionToken = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`

// The business address in the admin: type, pick a Google suggestion, and the
// business gets coordinates and a city (for members' "Near me") with the
// address in all five languages, as Google writes it in each (listed under
// the field once picked). An ARIA combobox: arrows move, Enter picks,
// Escape closes. Typing after a pick clears the pick. When address search
// isn't configured (no GOOGLE_MAPS_SERVER_API_KEY) or is down, the field
// still saves what's typed, just without a map position. Suggestions are
// asked in Hebrew when the admin types Hebrew. One session token per typing
// session, ended by the pick, so Google bills the whole search as one.
export default function AddressAutocomplete({
  id,
  value,
  onChange,
  required,
}: {
  id: string
  value: AddressValue
  onChange: (value: AddressValue) => void
  required?: boolean
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [active, setActive] = useState(-1)
  const [status, setStatus] = useState<'idle' | 'searching' | 'picking' | 'unavailable' | 'error'>('idle')
  const [pickError, setPickError] = useState<string | null>(null)
  const session = useRef<string | null>(null)
  const typed = useRef(false)
  const query = useDebouncedValue(value.text, 250)

  useEffect(() => {
    const input = query.trim()
    if (!typed.current || value.address || input.length < 3 || status === 'unavailable') {
      setSuggestions([])
      return
    }
    let cancelled = false
    session.current ??= newSessionToken()
    setStatus('searching')
    adminFetch('/api/admin/places/autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, sessionToken: session.current, lang: /[֐-׿]/.test(input) ? 'he' : 'en' }),
    })
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 503) {
          setStatus('unavailable')
          return
        }
        const data = await res.json().catch(() => ({}))
        setSuggestions(res.ok ? (data.suggestions ?? []) : [])
        setActive(-1)
        setOpen(true)
        setStatus(res.ok ? 'idle' : 'error')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, value.address])

  const pick = async (suggestion: Suggestion) => {
    setOpen(false)
    setStatus('picking')
    setPickError(null)
    try {
      const res = await adminFetch('/api/admin/places/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: suggestion.placeId, sessionToken: session.current ?? newSessionToken() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.address) {
        setPickError(data.error ?? 'That address could not be loaded. Try again.')
        setStatus('idle')
        return
      }
      const address = data.address as GeoAddress
      typed.current = false
      onChange({ text: address.formatted.he ?? address.formatted.en ?? suggestion.main, address })
      setStatus('idle')
    } catch {
      setPickError('That address could not be loaded. Try again.')
      setStatus('idle')
    } finally {
      // The pick ends the billing session; the next search starts a new one.
      session.current = null
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      void pick(suggestions[active]!)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const expanded = open && suggestions.length > 0
  const city = value.address ? value.address.city.en ?? value.address.city.he : null

  return (
    <div>
      <label htmlFor={id} className={ADMIN_LABEL}>Address</label>
      <div className="relative">
        <input
          id={id}
          required={required}
          dir="auto"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
          aria-describedby={`${id}-status`}
          autoComplete="off"
          className={`${ADMIN_INPUT} pe-11`}
          placeholder="Start typing the street and city…"
          value={value.text}
          onChange={(e) => {
            typed.current = true
            setPickError(null)
            onChange({ text: e.target.value, address: null })
          }}
          onKeyDown={onKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setOpen(false)}
        />
        <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" aria-hidden="true">
          <i className={`fa-solid ${status === 'searching' || status === 'picking' ? 'fa-spinner fa-spin' : value.address ? 'fa-location-dot text-emerald-600' : 'fa-magnifying-glass'} text-sm`} />
        </span>
        {expanded && (
          <ul
            id={listId}
            role="listbox"
            className="drop-in absolute inset-x-0 top-full z-20 mt-1.5 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-[#E2E8F0] bg-white py-1 shadow-lg"
          >
            {suggestions.map((suggestion, i) => (
              <li
                key={suggestion.placeId}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // mousedown, not click: the input's blur would close the list first.
                onMouseDown={(e) => {
                  e.preventDefault()
                  void pick(suggestion)
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex min-h-12 cursor-pointer flex-col justify-center px-4 py-2 text-start ${i === active ? 'bg-[#F0F7FF]' : ''}`}
              >
                <span className="text-sm font-semibold text-[#0B1B3D]" dir="auto">{suggestion.main}</span>
                {suggestion.secondary && (
                  <span className="text-xs text-[#94A3B8]" dir="auto">{suggestion.secondary}</span>
                )}
              </li>
            ))}
            <li role="presentation" className="px-4 pb-1 pt-2 text-end text-[10px] text-[#94A3B8]">Powered by Google</li>
          </ul>
        )}
      </div>
      <p id={`${id}-status`} className={ADMIN_HINT} aria-live="polite">
        {pickError ? (
          <span className="font-medium text-[#B91C1C]">{pickError}</span>
        ) : value.address ? (
          <span className="text-emerald-700">
            <i className="fa-solid fa-circle-check me-1" aria-hidden="true" />
            On the map{city ? <> · <span dir="auto">{city}</span></> : null}. Members can find it with Near me.
          </span>
        ) : status === 'unavailable' ? (
          'Address search isn’t configured, so this saves as typed, without a map position.'
        ) : status === 'error' ? (
          'Address search is unavailable right now; this saves as typed, without a map position.'
        ) : (
          'Pick a suggestion so the business gets a map position for Near me.'
        )}
      </p>
      {value.address && (
        <details className="mt-2 text-xs text-[#475569]">
          <summary className="inline-flex min-h-10 cursor-pointer items-center font-semibold text-[#0038B8]">How members see the address</summary>
          <dl className="mt-1 space-y-1.5 rounded-xl border border-[#E2E8F0] p-3">
            {CONTENT_LANGS.map((lang) => {
              const line = value.address?.short?.[lang] || value.address?.formatted[lang]
              return (
                <div key={lang} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                  <dt className="shrink-0 font-semibold text-[#94A3B8] sm:w-20">{LANGUAGES.find((l) => l.code === lang)?.label ?? lang}</dt>
                  <dd lang={line ? lang : undefined} dir={line ? directionOf(lang) : undefined} className={`min-w-0 break-words ${line ? 'text-[#0F172A]' : 'italic text-[#94A3B8]'}`}>
                    {line || 'Not given by Google; members see another language’s.'}
                  </dd>
                </div>
              )
            })}
          </dl>
        </details>
      )}
    </div>
  )
}
