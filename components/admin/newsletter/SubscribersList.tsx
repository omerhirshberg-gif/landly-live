'use client'

import { useMemo, useState } from 'react'
import { useAdminT, type AdminKey } from '@/lib/admin/translations'
import { en } from '@/lib/admin/translations/en'
import BidiText from '@/components/admin/BidiText'
import Card from '@/components/admin/Card'
import { ADMIN_INPUT, ADMIN_SELECT } from '@/components/admin/formStyles'
import type { AudienceCount, SubscriberRow } from './types'

const PAGE = 50

type Translate = (key: AdminKey, vars?: Record<string, string | number>) => string

function segmentLabel(segment: string, t: Translate): string {
  if (!segment) return '—'
  const key = `newsletter.segment.${segment}`
  return key in en ? t(key as AdminKey) : segment
}

function SourceBadge({ source }: { source: SubscriberRow['source'] }) {
  const { t } = useAdminT()
  const tone = source === 'user' ? 'bg-adm-accent-soft text-adm-accent' : 'bg-adm-violet-soft text-adm-violet'
  return <span className={`inline-flex whitespace-nowrap rounded-md px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{t(`newsletter.subs.source.${source}` as AdminKey)}</span>
}

// The people the selected audience reaches, so nobody sends blind: searchable,
// filterable by source, 50 at a time. An empty list says why (DEV has no
// opted-in members; in Production it means nobody matches yet).
export default function SubscribersList({ count }: { count: AudienceCount }) {
  const { t } = useAdminT()
  const [open, setOpen] = useState(true)
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<'all' | SubscriberRow['source']>('all')
  const [limit, setLimit] = useState(PAGE)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return count.list.filter((r) => (source === 'all' || r.source === source) && (!q || r.name.toLowerCase().includes(q) || r.email.includes(q)))
  }, [count.list, query, source])
  const shown = matches.slice(0, limit)

  return (
    <section aria-labelledby="newsletter-subs">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="newsletter-subs" className="text-base font-bold tracking-tight text-adm-text">{t('newsletter.subs.title')}</h2>
            <p className="mt-0.5 text-sm tabular-nums text-adm-muted">
              {count.status === 'loading' ? t('newsletter.recipients.loading') : count.status === 'error' ? t('newsletter.subs.failed') : <bdi dir="ltr">{count.count.toLocaleString('en-US')}</bdi>}
            </p>
          </div>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="newsletter-subs-body"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-adm-accent hover:bg-adm-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-adm-accent"
          >
            {open ? t('newsletter.subs.hide') : t('newsletter.subs.show')}
            <i className={`fa-solid fa-chevron-down text-xs transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </div>

        {open && (
          <div id="newsletter-subs-body" className="border-t border-adm-line/80">
            {count.status === 'ready' && count.list.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm leading-relaxed text-adm-muted sm:px-6">{count.env === 'prod' ? t('newsletter.subs.emptyProd') : t('newsletter.subs.emptyDev')}</p>
            ) : (
              <>
                <div className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_14rem] sm:px-6">
                  <input
                    type="search"
                    dir="auto"
                    aria-label={t('newsletter.subs.search')}
                    placeholder={t('newsletter.subs.search')}
                    className={ADMIN_INPUT}
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setLimit(PAGE) }}
                  />
                  <select aria-label={t('newsletter.subs.col.source')} className={ADMIN_SELECT} value={source} onChange={(e) => { setSource(e.target.value as typeof source); setLimit(PAGE) }}>
                    <option value="all">{t('newsletter.subs.allSources')}</option>
                    <option value="user">{t('newsletter.subs.source.user')}</option>
                    <option value="lead">{t('newsletter.subs.source.lead')}</option>
                  </select>
                </div>

                {matches.length === 0 ? (
                  <p className="px-4 pb-8 text-center text-sm text-adm-muted sm:px-6">{t('newsletter.subs.noMatch')}</p>
                ) : (
                  <>
                    <ul className="divide-y divide-adm-line-soft border-t border-adm-line-soft md:hidden">
                      {shown.map((r) => (
                        <li key={r.email} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <span className="min-w-0 break-words font-semibold text-adm-text">{r.name ? <BidiText>{r.name}</BidiText> : '—'}</span>
                            <span className="shrink-0 text-xs font-semibold uppercase tabular-nums text-adm-text-2">{r.lang}</span>
                          </div>
                          <bdi dir="ltr" className="block truncate text-sm text-adm-text-2">{r.email}</bdi>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-adm-muted">
                            <SourceBadge source={r.source} />
                            <span>{segmentLabel(r.segment, t)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="hidden overflow-x-auto border-t border-adm-line-soft md:block">
                      <table className="w-full text-start text-sm">
                        <thead>
                          <tr className="border-b border-adm-line text-xs font-bold uppercase tracking-wider text-adm-muted">
                            {(['name', 'email', 'source', 'segment', 'lang'] as const).map((col) => (
                              <th key={col} scope="col" className="px-6 py-3 text-start font-bold">{t(`newsletter.subs.col.${col}` as AdminKey)}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-adm-line-soft">
                          {shown.map((r) => (
                            <tr key={r.email}>
                              <td className="max-w-[14rem] px-6 py-3 font-semibold text-adm-text">{r.name ? <span className="block truncate"><BidiText>{r.name}</BidiText></span> : '—'}</td>
                              <td className="max-w-[18rem] px-6 py-3 text-adm-text-2"><bdi dir="ltr" className="block truncate">{r.email}</bdi></td>
                              <td className="px-6 py-3"><SourceBadge source={r.source} /></td>
                              <td className="px-6 py-3 text-adm-text-2">{segmentLabel(r.segment, t)}</td>
                              <td className="px-6 py-3 text-xs font-semibold uppercase tabular-nums text-adm-text-2">{r.lang}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-adm-line-soft px-4 py-3 sm:px-6">
                      <span className="text-sm tabular-nums text-adm-muted">{t('newsletter.subs.showing', { shown: shown.length, total: matches.length })}</span>
                      {shown.length < matches.length && (
                        <button type="button" onClick={() => setLimit((n) => n + PAGE)} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-adm-accent hover:bg-adm-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-adm-accent">
                          {t('newsletter.subs.more')}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </Card>
    </section>
  )
}
