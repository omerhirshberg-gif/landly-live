'use client'

import { useMemo } from 'react'
import type { CountryCode } from 'libphonenumber-js'
import { countryName, listCountries, toCountry, type Country } from '@/lib/auth/onboarding'
import { useLang } from '@/lib/i18n/useLang'

// The phone field's country code: a compact "🇮🇱 +972 ▾" face over a real,
// invisible <select>, so the platform's own picker opens (a wheel on phones)
// and keyboard and screen-reader support come for free.
export default function CountryCodeSelect({ value, onChange }: { value: CountryCode; onChange: (code: CountryCode) => void }) {
  const { t, lang } = useLang()
  const current = toCountry(value)
  const options = useMemo(() => {
    const named = (c: Country) => ({ ...c, name: countryName(c.code, lang) })
    const { pinned, rest } = listCountries()
    // Common countries first in their set order, the rest alphabetically by their local name.
    return { pinned: pinned.map(named), rest: rest.map(named).sort((a, b) => a.name.localeCompare(b.name, lang)) }
  }, [lang])
  const option = (c: (typeof options.pinned)[number]) => (
    <option key={c.code} value={c.code}>
      {`${c.flag} ${c.name} (+${c.callingCode})`}
    </option>
  )
  return (
    <span className="relative -ms-1 me-3 pe-3 h-7 shrink-0 flex items-center gap-1.5 border-e border-slate-200">
      <span aria-hidden="true" className="text-lg leading-none">
        {current.flag}
      </span>
      <span dir="ltr" aria-hidden="true" className="text-base font-semibold text-slate-900">
        +{current.callingCode}
      </span>
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
      <select
        aria-label={t('onb_countryCode')}
        value={value}
        onChange={(e) => onChange(e.target.value as CountryCode)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-base"
      >
        {options.pinned.map(option)}
        <option disabled>──────────</option>
        {options.rest.map(option)}
      </select>
    </span>
  )
}
