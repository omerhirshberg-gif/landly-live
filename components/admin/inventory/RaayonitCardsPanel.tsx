'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatIsraeliDateTime } from '@/lib/admin/formatDate'
import { CARD_TABS, type CardTab } from '@/lib/inventory/raayonitCardTabs'
import { adminCategoryOf, groupByRaayonitCategory, keepCategory } from '@/lib/inventory/raayonitCardGroups'
import { isRaayonitCategoryId, raayonitCategoryName } from '@/lib/offers/raayonitCategories'
import { isolateLtr } from '@/lib/home/superShowcase'
import { adminFetch } from '@/lib/admin/adminSession'
import { useAdminT } from '@/lib/admin/translations'
import { brandsSheetTemplate } from '@/lib/inventory/raayonitCatalog'
import { isSheetFile, MAX_SHEET_BYTES, readCodeSheetFile } from '@/lib/inventory/readCodeSheetFile'
import Alert from '@/components/admin/Alert'
import RaayonitSyncPanel from '@/components/admin/inventory/RaayonitSyncPanel'
import StatusBadge from '@/components/admin/StatusBadge'
import { BUSINESS_CATEGORIES } from '@/lib/categories'
import { ADMIN_SELECT, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/admin/formStyles'

interface Card {
  id: string; title: string; brandName: string; perkScope: 'multi_chain' | 'single_business'; published: boolean; pending: boolean; tab: CardTab
  archivedAt: string | null; rejected: boolean; superseded: boolean; deletable: boolean; category: string; raayonitCategories: string[]; chainsCount: number; originalPrice: number; offerPrice: number
}

// The generated Raayonit cards in four tabs (active on the site, added and pending review, removed by Raayonit and archived,
// hidden), with the daily sync summary above. Every action says what it does: publish business on site, remove from site
// (archive), restore to site, delete business permanently (archived cards with no orders or vouchers only).
export default function RaayonitCardsPanel({ onChanged }: { onChanged: () => void }) {
  const { t, dir, locale } = useAdminT()
  const fileRef = useRef<HTMLInputElement>(null)
  const [cards, setCards] = useState<Card[] | null>(null)
  const [busy, setBusy] = useState<'sheet' | 'publish' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [tab, setTab] = useState<CardTab>('active')
  const [category, setCategory] = useState('all')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [categories, setCategories] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/raayonit/offers')
      if (!res.ok) throw new Error()
      setCards((await res.json()).offers ?? [])
    } catch {
      setMessage({ tone: 'error', text: t('rc.loadFailed') })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { void load() }, [load])

  const sync = async (source: 'sheet', matrix?: unknown[][]) => {
    setBusy('sheet')
    setMessage(null)
    try {
      const res = await adminFetch('/api/admin/raayonit/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source, matrix }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error)
      setMessage({ tone: 'success', text: t('rc.synced', { created: data.created, updated: data.updated, brands: data.brands }) })
      await load()
      onChanged()
    } catch (err) {
      setMessage({ tone: 'error', text: (err as Error).message || t('rc.syncFailed') })
    } finally {
      setBusy(null)
    }
  }

  const readSheet = async (file: File | undefined) => {
    if (!file) return
    if (!isSheetFile(file) || file.size > MAX_SHEET_BYTES) return setMessage({ tone: 'error', text: t('rc.badFile') })
    try {
      await sync('sheet', await readCodeSheetFile(file))
    } catch {
      setMessage({ tone: 'error', text: t('rc.badFile') })
    }
  }

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const sheet = XLSX.utils.aoa_to_sheet(brandsSheetTemplate())
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Brands')
    XLSX.writeFile(book, 'raayonit-brands-and-branches.xlsx')
  }

  // Raayonit's own category names (admin language only: he or en).
  // The first is the group the row sits in; the rest are the other categories Raayonit also lists the business under (Chains included).
  const categoryNames = (card: Card) => {
    const own = adminCategoryOf(card.raayonitCategories)
    return [own, ...card.raayonitCategories.filter((id) => id !== own)].filter(isRaayonitCategoryId).map((id) => raayonitCategoryName(id, locale))
  }

  const act = async (body: Record<string, unknown>, success: (data: Record<string, number>) => string) => {
    setBusy('publish')
    setMessage(null)
    setConfirmDelete(null)
    try {
      const res = await adminFetch('/api/admin/raayonit/offers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error)
      setMessage({ tone: 'success', text: success(data) })
      await load()
      onChanged()
    } catch (err) {
      setMessage({ tone: 'error', text: (err as Error).message || t('rc.publishFailed') })
    } finally {
      setBusy(null)
    }
  }
  const publish = (published: boolean, ids?: string[]) => act(ids ? { published, ids } : { published, all: true }, (d) => t(published ? 'rc.published' : 'rc.unpublished', { n: d.changed ?? 0 }))
  const restore = (id: string) => act({ action: 'restore', ids: [id] }, (d) => t('rc.restored', { n: d.changed ?? 0 }))
  const remove = (id: string) => act({ action: 'delete', ids: [id] }, (d) => ((d.deleted ?? 0) > 0 ? t('rc.deleted', { n: d.deleted }) : t('rc.deleteRefused')))

  const review = async (action: 'approve' | 'reject', id: string, category?: string) => {
    setBusy('publish')
    setMessage(null)
    try {
      const res = await adminFetch('/api/admin/raayonit/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ids: [id], ...(category ? { category } : {}) }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error)
      setMessage({ tone: 'success', text: t(action === 'approve' ? 'rs.approved' : 'rs.rejected', { n: data.changed }) })
      await load()
      onChanged()
    } catch (err) {
      setMessage({ tone: 'error', text: (err as Error).message || t('rs.reviewFailed') })
    } finally {
      setBusy(null)
    }
  }

  const renderRow = (card: Card) => (
    <li key={card.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1 basis-48">
        <p dir="auto" className="line-clamp-2 text-sm font-semibold text-adm-text">{card.title}</p>
        <p className="mt-0.5 text-xs text-adm-muted">
          {card.perkScope === 'multi_chain' ? t('rc.general') : t('rc.brand')}
          {card.chainsCount > 0 ? <> · <bdi dir="ltr" className="tabular-nums">{card.chainsCount}</bdi> {card.perkScope === 'multi_chain' ? t('rc.chains') : t('rc.branches')}</> : null}
        </p>
        {card.perkScope !== 'multi_chain' && categoryNames(card).length > 0 && (
          <p dir="auto" className="mt-0.5 text-xs text-adm-muted">
            {t('rc.categoryLabel')}: {categoryNames(card)[0]}
            {categoryNames(card).length > 1 ? <> · {t('rc.alsoIn')} {categoryNames(card).slice(1).join(', ')}</> : null}
          </p>
        )}
        {card.tab === 'archive' && (
          <p className="mt-0.5 text-xs text-adm-muted">{t('rc.archivedReason')} · {t('rc.removedOn')} <bdi dir="ltr" className="tabular-nums">{formatIsraeliDateTime(card.archivedAt)}</bdi></p>
        )}
      </div>

      {card.tab === 'active' && (
        <>
          <StatusBadge tone="emerald" icon="fa-circle-check">{t('rc.live')}</StatusBadge>
          <button type="button" className={SECONDARY_BUTTON} disabled={busy !== null} onClick={() => publish(false, [card.id])}>{t('rc.unpublish')}</button>
        </>
      )}

      {card.tab === 'pending' && (
        <>
          <StatusBadge tone="blue" icon="fa-hourglass-half">{t('rs.pendingBadge')}</StatusBadge>
          <label className="sr-only" htmlFor={`cat-${card.id}`}>{t('rs.category')}</label>
          <select id={`cat-${card.id}`} dir="ltr" className={`${ADMIN_SELECT} w-full sm:w-56`} value={categories[card.id] ?? card.category} onChange={(e) => setCategories((c) => ({ ...c, [card.id]: e.target.value }))} disabled={busy !== null}>
            {[...new Set([card.category, ...BUSINESS_CATEGORIES].filter(Boolean))].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="button" className={PRIMARY_BUTTON} disabled={busy !== null} onClick={() => review('approve', card.id, categories[card.id] ?? card.category)}>{t('rs.approve')}</button>
          <button type="button" className={SECONDARY_BUTTON} disabled={busy !== null} onClick={() => review('reject', card.id)}>{t('rs.reject')}</button>
        </>
      )}

      {card.tab === 'archive' && (
        confirmDelete === card.id ? (
          <div className="flex w-full flex-col gap-2 rounded-xl border border-adm-danger-line bg-adm-danger-soft p-3 text-sm text-adm-danger">
            <p dir="auto" className="font-medium">{t('rc.deleteConfirm', { name: card.brandName || card.title })}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" className={SECONDARY_BUTTON} disabled={busy !== null} onClick={() => remove(card.id)}>{t('rc.deleteYes')}</button>
              <button type="button" className={SECONDARY_BUTTON} disabled={busy !== null} onClick={() => setConfirmDelete(null)}>{t('rs.cancel')}</button>
            </div>
          </div>
        ) : (
          <>
            <StatusBadge tone="slate" icon="fa-box-archive">{t('rc.archivedBadge')}</StatusBadge>
            <button type="button" className={PRIMARY_BUTTON} disabled={busy !== null} onClick={() => restore(card.id)}>{t('rc.restore')}</button>
            {card.deletable && <button type="button" className={SECONDARY_BUTTON} disabled={busy !== null} onClick={() => setConfirmDelete(card.id)}>{t('rc.deleteForever')}</button>}
          </>
        )
      )}

      {card.tab === 'hidden' && (
        <>
          {card.superseded ? <StatusBadge tone="slate" icon="fa-clone">{t('rc.supersededBadge')}</StatusBadge>
            : card.rejected ? <StatusBadge tone="amber" icon="fa-ban">{t('rc.rejectedBadge')}</StatusBadge>
            : <StatusBadge tone="amber" icon="fa-pen-ruler">{t('rc.hiddenBadge')}</StatusBadge>}
          {!card.superseded && <button type="button" className={PRIMARY_BUTTON} disabled={busy !== null} onClick={() => publish(true, [card.id])}>{t('rc.publish')}</button>}
        </>
      )}
    </li>
  )

  const count = (which: CardTab) => cards?.filter((c) => c.tab === which).length ?? 0
  const inTab = cards?.filter((c) => c.tab === tab) ?? []
  const shown = cards === null ? null : inTab
  const grouped = groupByRaayonitCategory(inTab, locale)
  const activeCategory = keepCategory(category, grouped.groups)
  const pinned = grouped.pinned
  const groups = grouped.groups.filter((g) => (activeCategory === 'all' ? g.cards.length > 0 : g.id === activeCategory))
  const allCollapsed = groups.length > 0 && groups.every((g) => collapsed.has(g.id))
  const drafts = cards?.filter((c) => c.tab === 'hidden' && !c.rejected && !c.superseded).length ?? 0
  const moveTab = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = CARD_TABS[(i + (dir === 'rtl' ? -step : step) + CARD_TABS.length) % CARD_TABS.length]!
    setTab(next)
    document.getElementById(`rc-tab-${next}`)?.focus()
  }

  return (
    <>
    <RaayonitSyncPanel pending={count('pending')} onChanged={() => { void load(); onChanged() }} />
    <section aria-labelledby="raayonit-cards" className="mb-8">
      <h2 id="raayonit-cards" className="text-base font-bold tracking-tight text-adm-text">{t('rc.title')}</h2>
      <p className="mb-4 mt-1 text-sm text-adm-muted">{t('rc.subtitle')}</p>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button type="button" className={`${SECONDARY_BUTTON} w-full sm:w-auto`} onClick={() => fileRef.current?.click()} disabled={busy !== null}>
          <i className="fa-solid fa-file-excel text-xs" aria-hidden="true" />
          {busy === 'sheet' ? t('rc.syncing') : t('rc.uploadSheet')}
        </button>
        <button type="button" className={`${SECONDARY_BUTTON} w-full sm:w-auto`} onClick={() => void downloadTemplate()}>
          <i className="fa-solid fa-download text-xs" aria-hidden="true" />
          {t('rc.template')}
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { void readSheet(e.target.files?.[0]); e.target.value = '' }} />
        <button type="button" className={`${PRIMARY_BUTTON} w-full sm:ms-auto sm:w-auto`} onClick={() => publish(true)} disabled={busy !== null || drafts === 0}>
          <i className="fa-solid fa-rocket text-xs" aria-hidden="true" />
          {t('rc.publishAll')}{drafts > 0 ? <bdi dir="ltr" className="tabular-nums"> ({drafts})</bdi> : null}
        </button>
      </div>
      {message && <Alert tone={message.tone === 'success' ? 'success' : undefined} className="mb-4">{message.text}</Alert>}

      <div role="tablist" aria-label={t('rc.tabs')} className="-mx-1 mb-3 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {CARD_TABS.map((id, i) => (
          <button key={id} id={`rc-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls="rc-panel" tabIndex={tab === id ? 0 : -1}
            onClick={() => { setTab(id); setConfirmDelete(null); setCollapsed(new Set()) }} onKeyDown={(e) => moveTab(e, i)}
            className={`inline-flex min-h-11 shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-adm-accent ${tab === id ? 'border-adm-accent bg-adm-accent/10 text-adm-text' : 'border-adm-line bg-adm-surface text-adm-text-2'}`}>
            {t(`rc.tab.${id}` as 'rc.tab.active')}
            <bdi dir="ltr" className="tabular-nums text-adm-muted">{cards === null ? '–' : count(id)}</bdi>
          </button>
        ))}
      </div>

      <div id="rc-panel" role="tabpanel" aria-labelledby={`rc-tab-${tab}`}>
        {shown === null ? null : shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-adm-line px-4 py-6 text-center text-sm text-adm-muted">{t(cards?.length === 0 ? 'rc.empty' : (`rc.empty.${tab}` as 'rc.empty.active'))}</p>
        ) : (
          <>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="sr-only" htmlFor="rc-category">{t('rc.categoryFilter')}</label>
              <select id="rc-category" className={`${ADMIN_SELECT} w-full sm:w-72`} value={activeCategory} onChange={(e) => setCategory(e.target.value)}>
                <option value="all">{t('rc.showAll')} ({isolateLtr(String(inTab.length))})</option>
                {grouped.groups.map((g) => <option key={g.id} value={g.id} disabled={g.cards.length === 0}>{g.label} ({isolateLtr(String(g.cards.length))})</option>)}
              </select>
              {groups.length > 0 && (
                <button type="button" className={`${SECONDARY_BUTTON} w-full sm:ms-auto sm:w-auto`} onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(groups.map((g) => g.id)))}>
                  <i className={`fa-solid ${allCollapsed ? 'fa-angles-down' : 'fa-angles-up'} text-xs`} aria-hidden="true" />
                  {t(allCollapsed ? 'rc.expandAll' : 'rc.collapseAll')}
                </button>
              )}
            </div>
            {pinned.length > 0 && (
              <section aria-label={t('rc.pinned')} className="mb-4">
                <h3 className="mb-1.5 px-1 text-xs font-bold uppercase tracking-wide text-adm-muted">{t('rc.pinned')}</h3>
                <ul className="divide-y divide-adm-line overflow-hidden rounded-2xl border border-adm-line bg-adm-surface">{pinned.map(renderRow)}</ul>
              </section>
            )}
            {groups.map((g) => {
              const open = !collapsed.has(g.id)
              const panelId = `rc-group-${g.id}`
              return (
                <section key={g.id} aria-label={g.label} className="mb-4">
                  <h3 className="sticky top-[72px] z-10 lg:top-16">
                    <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setCollapsed((c) => { const n = new Set(c); if (open) n.add(g.id); else n.delete(g.id); return n })}
                      className={`flex min-h-11 w-full items-center gap-3 border border-adm-line bg-adm-surface px-4 text-start text-sm font-bold text-adm-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-adm-accent ${open ? 'rounded-t-2xl' : 'rounded-2xl'}`}>
                      <i className={`fa-solid fa-chevron-down text-[10px] text-adm-muted transition-transform ${open ? '' : dir === 'rtl' ? 'rotate-90' : '-rotate-90'}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{g.label}</span>
                      <bdi dir="ltr" className="shrink-0 tabular-nums font-semibold text-adm-muted">{g.cards.length}</bdi>
                    </button>
                  </h3>
                  {open && <ul id={panelId} className="divide-y divide-adm-line overflow-hidden rounded-b-2xl border border-t-0 border-adm-line bg-adm-surface">{g.cards.map(renderRow)}</ul>}
                </section>
              )
            })}
          </>
        )}
      </div>
    </section>
    </>
  )
}
