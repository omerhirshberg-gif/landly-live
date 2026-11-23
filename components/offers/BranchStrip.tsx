'use client'

import { useMemo, useRef, useState } from 'react'
import { Navigation, Phone } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { parsePhones } from '@/lib/offers/contact'
import { branchLine, localizedBranch, type OfferBranch } from '@/lib/offers/branches'
import RailArrows, { useRail } from './RailArrows'
import BranchNavigationModal, { type BranchTarget } from './BranchNavigationModal'

// A single brand's branches as a row of cards: name, city and street, a kosher tag when it is, its phone with a Call action, and a Directions action that opens
// the Waze / Google Maps chooser. Past 8 branches a city filter narrows the row. Expo: landly-mobile/src/components/BranchStrip.tsx.
export default function BranchStrip({ branches, brand }: { branches: readonly OfferBranch[]; brand: string | null }) {
  const { t, lang } = useLang()
  const [city, setCity] = useState<string | null>(null)
  const [picked, setPicked] = useState<BranchTarget | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const cities = useMemo(() => {
    const seen = new Map<string, string>()
    for (const b of branches) if (b.city && !seen.has(b.city)) seen.set(b.city, localizedBranch(b, lang).city || b.city)
    return [...seen]
  }, [branches, lang])
  const shown = city ? branches.filter((b) => b.city === city) : branches
  const rail = useRail<HTMLUListElement>(shown.length)
  return (
    <div className="space-y-3">
      {rail.edge.overflow && <div className="hidden justify-end md:flex"><RailArrows edge={rail.edge} page={rail.page} /></div>}
      {branches.length > 8 && cities.length > 1 && (
        <div role="group" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[[null, t('branch_all_cities')] as const, ...cities].map(([key, label]) => (
            <button key={key ?? 'all'} type="button" aria-pressed={city === key} onClick={() => setCity(key)} className={`min-h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${city === key ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-ink hover:border-slate-300'}`}>{label}</button>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <p className="text-sm text-muted">{t('branch_no_results')}</p>
      ) : (
        <ul ref={rail.ref} onScroll={rail.measure} className="-mx-1 flex snap-x scroll-px-1 gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {shown.map((b, i) => {
            const text = localizedBranch(b, lang)
            const phones = parsePhones(b.phone).slice(0, 3)
            const phone = phones[0] ?? null
            const where = [text.address, text.city && !text.address.includes(text.city) ? text.city : ''].filter(Boolean).join(', ')
            return (
              <li key={`${b.name}-${i}`} className="flex min-h-[140px] w-[248px] min-w-[200px] shrink-0 snap-start flex-col gap-1.5 rounded-2xl border border-slate-200/90 border-s-4 border-s-brand bg-white p-3.5">
                <bdi className="line-clamp-2 text-[15px] font-bold leading-tight text-ink" dir="auto">{text.name}</bdi>
                {where && <bdi className="line-clamp-2 text-[13px] leading-snug text-muted" dir="auto">{where}</bdi>}
                {b.kosher && <span className="self-start rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-ink">{t('branch_kosher')}</span>}
                {phones.map((p) => <bdi key={p.href} dir="ltr" className="self-start text-[13px] font-semibold leading-snug text-ink">{p.display}</bdi>)}
                <div className="mt-auto flex items-center gap-4">
                  <button
                    type="button"
                    onClick={(e) => { opener.current = e.currentTarget; setPicked({ label: branchLine(b, lang), name: branchLine(b, 'he'), brand }) }}
                    aria-label={`${t('branch_directions')}: ${text.name}`}
                    className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-bold text-brand hover:underline"
                  >
                    <Navigation aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
                    {t('branch_directions')}
                  </button>
                  {phone && (
                    <a href={phone.href} aria-label={`${t('branch_call')}: ${text.name} ${phone.display}`} className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-bold text-brand hover:underline">
                      <Phone aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
                      {t('branch_call')}
                    </a>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <BranchNavigationModal branch={picked} onClose={() => setPicked(null)} returnFocusTo={opener.current} />
    </div>
  )
}
