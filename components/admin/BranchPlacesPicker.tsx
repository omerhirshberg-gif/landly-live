'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { MAX_PARTICIPATING_PLACES, localizedName, placeChainName, type ParticipatingPlace } from '@/lib/geo'
import { CONTENT_LANGS, directionOf } from '@/lib/i18n/contentTranslation'
import { LANGUAGES } from '@/lib/i18n/languages'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { useDropdownPlacement } from '@/lib/useDropdownPlacement'
import { useAdminT } from '@/lib/admin/translations'
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL } from './formStyles'
import ChipsInput from './ChipsInput'
import { directionalProps } from '@/lib/directionalInput'

export interface BranchesValue {
  /** Branches picked from Google Places: names in every language and an exact position. */
  places: ParticipatingPlace[]
  /** Names that were only typed (older offers, imports): shown as written, searched by name. */
  typed: string[]
}

interface Suggestion {
  placeId: string
  main: string
  secondary: string
}

const newSessionToken = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`

// The participating stores of a single-brand perk, picked from Google Places (a store, a mall, a street shop in
// Israel) so each one has Google's own name in all five languages and an exact position for Waze and Google Maps.
// Nothing here is machine-translated. Under each pick the admin sees how it reads in every language and can correct
// any of them. Names typed before this existed stay as chips, flagged, until they are replaced by a pick. Without a
// Maps key the field falls back to typed names. One billing session token per typing session, ended by the pick.
export default function BranchPlacesPicker({ id, label, value, onChange }: { id: string; label: string; value: BranchesValue; onChange: (next: BranchesValue) => void }) {
  const listId = useId()
  const { t, dir: uiDir } = useAdminT()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [active, setActive] = useState(-1)
  const [status, setStatus] = useState<'idle' | 'searching' | 'picking' | 'unavailable' | 'error'>('idle')
  const [pickError, setPickError] = useState<string | null>(null)
  const session = useRef<string | null>(null)
  const anchor = useRef<HTMLDivElement>(null)
  const query = useDebouncedValue(text, 250)
  const full = value.places.length >= MAX_PARTICIPATING_PLACES

  useEffect(() => {
    const input = query.trim()
    if (input.length < 3 || status === 'unavailable') {
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
        const taken = new Set(value.places.map((p) => p.placeId))
        setSuggestions(res.ok ? ((data.suggestions ?? []) as Suggestion[]).filter((s) => !taken.has(s.placeId)) : [])
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
  }, [query])

  const pick = async (suggestion: Suggestion) => {
    setOpen(false)
    setStatus('picking')
    setPickError(null)
    try {
      const res = await adminFetch('/api/admin/places/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: suggestion.placeId, sessionToken: session.current ?? newSessionToken() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.place) {
        setPickError(data.error ?? t('branches.loadFailed'))
        setStatus('idle')
        return
      }
      const place = data.place as ParticipatingPlace
      const typedName = placeChainName(place).toLowerCase()
      // A typed name that this pick replaces goes away.
      onChange({ places: [...value.places.filter((p) => p.placeId !== place.placeId), place], typed: value.typed.filter((name) => name.toLowerCase() !== typedName) })
      setText('')
      setSuggestions([])
      setStatus('idle')
    } catch {
      setPickError(t('branches.loadFailed'))
      setStatus('idle')
    } finally {
      session.current = null
    }
  }

  const setName = (placeId: string, lang: (typeof CONTENT_LANGS)[number], next: string) =>
    onChange({
      ...value,
      places: value.places.map((place) => {
        if (place.placeId !== placeId) return place
        const names = { ...place.names }
        if (next.trim()) names[lang] = next
        else delete names[lang]
        return Object.keys(names).length > 0 ? { ...place, names } : place
      }),
    })

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
    } else if (e.key === 'Escape') setOpen(false)
  }

  // Without a Maps key the stores can only be typed.
  if (status === 'unavailable') {
    return (
      <div className="space-y-3">
        <ChipsInput id={id} label={label} hint={t('branches.unconfigured')} placeholder={t('form.storesPlaceholder')} value={value.typed} onChange={(typed) => onChange({ ...value, typed })} />
        <PickedList value={value} setName={setName} onChange={onChange} />
      </div>
    )
  }

  const expanded = open && suggestions.length > 0
  const { up, maxHeight } = useDropdownPlacement(anchor, expanded)
  // The hint's own direction (see lib/directionalInput.ts); the icon and list follow it so padding and icon stay on one edge.
  const inputDir = directionalProps(text, t('branches.placeholder'), uiDir === 'rtl')
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={id} className={ADMIN_LABEL}>{label}</label>
        <div ref={anchor} dir={inputDir.dir === 'auto' ? undefined : inputDir.dir} className="relative">
          <input
            id={id}
            {...inputDir}
            role="combobox"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
            aria-describedby={`${id}-status`}
            autoComplete="off"
            disabled={full}
            className={`${ADMIN_INPUT} pe-11`}
            placeholder={t('branches.placeholder')}
            value={text}
            onChange={(e) => {
              setPickError(null)
              setText(e.target.value)
            }}
            onKeyDown={onKeyDown}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            onBlur={() => setOpen(false)}
          />
          <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-[#64748B]" aria-hidden="true">
            <i className={`fa-solid ${status === 'searching' || status === 'picking' ? 'fa-spinner fa-spin' : 'fa-magnifying-glass'} text-sm`} />
          </span>
          {expanded && (
            <ul id={listId} role="listbox" style={{ maxHeight }}
            className={`drop-in absolute inset-x-0 z-30 overflow-y-auto overscroll-y-contain rounded-xl border border-[#E2E8F0] bg-white py-1 shadow-lg ${up ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}>
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
                  {suggestion.secondary && <span className="text-xs text-[#64748B]" dir="auto">{suggestion.secondary}</span>}
                </li>
              ))}
              <li role="presentation" className="px-4 pb-1 pt-2 text-end text-[10px] text-[#64748B]">{t('branches.poweredBy')}</li>
            </ul>
          )}
        </div>
        <p id={`${id}-status`} className={ADMIN_HINT} aria-live="polite">
          {pickError ? <span className="font-medium text-[#B91C1C]">{pickError}</span> : status === 'error' ? t('branches.unavailable') : t('branches.hint')}
        </p>
      </div>
      <PickedList value={value} setName={setName} onChange={onChange} />
    </div>
  )
}

function PickedList({ value, setName, onChange }: { value: BranchesValue; setName: (placeId: string, lang: (typeof CONTENT_LANGS)[number], next: string) => void; onChange: (next: BranchesValue) => void }) {
  const { t } = useAdminT()
  if (value.places.length === 0 && value.typed.length === 0) return null
  return (
    <ul className="space-y-2">
      {value.places.map((place) => {
        const name = localizedName(place.names, 'en') || placeChainName(place)
        return (
          <li key={place.placeId} className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#0B1B3D]"><bdi dir="auto">{name}</bdi></p>
                {place.address && <p className="truncate text-xs text-[#64748B]"><bdi dir="auto">{localizedName(place.address, 'en')}</bdi></p>}
              </div>
              <button type="button" aria-label={t('branches.remove', { name })} onClick={() => onChange({ ...value, places: value.places.filter((p) => p.placeId !== place.placeId) })} className="-me-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#475569] hover:bg-[#F1F5F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8]">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <details className="text-xs text-[#475569]">
              <summary className="inline-flex min-h-10 cursor-pointer items-center font-semibold text-[#0038B8]">{t('branches.howSeen')}</summary>
              <div className="space-y-2 pb-2">
                {CONTENT_LANGS.map((lang) => (
                  <label key={lang} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <span className="shrink-0 font-semibold text-[#64748B] sm:w-20">{LANGUAGES.find((l) => l.code === lang)?.label ?? lang}</span>
                    <input
                      lang={lang}
                      dir={directionOf(lang)}
                      maxLength={200}
                      value={place.names[lang] ?? ''}
                      placeholder={t('branches.notGiven')}
                      onChange={(e) => setName(place.placeId, lang, e.target.value)}
                      className={`${ADMIN_INPUT} min-h-10 py-1.5 text-sm`}
                    />
                  </label>
                ))}
              </div>
            </details>
          </li>
        )
      })}
      {value.typed.length > 0 && (
        <li className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-2.5">
          <p className="mb-1 text-xs text-[#92400E]">{t('branches.typedNote')}</p>
          <ChipsInput id="typed-branches" label="" hint="" placeholder="" value={value.typed} onChange={(typed) => onChange({ ...value, typed })} />
        </li>
      )}
    </ul>
  )
}
