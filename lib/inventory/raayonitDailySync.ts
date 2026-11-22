import 'server-only'
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore'
import { officialBrandName } from './raayonitBrandNames'
import { indexUrl, networkUrl, parseNetworkIndex, parseNetworkPage, RAAYONIT_BASE, RAAYONIT_VOUCHER_NUM, type RaayonitBrand } from './raayonitCatalog'
import { bundledCatalog, type SnapshotBrand, type TranslateBatch } from './raayonitCatalogSync'
import { classifyAdded, diffCatalog, parseLiveDirectory, type AddedKind, type CatalogDiff, type ExistingCard, type LiveDirectory, type LiveEntry } from './raayonitLiveDiff'
import { brandOfRow, groupListing, isSuspended, parseSupplierInfo, type SupplierInfo } from './raayonitListing'
import { finalizeCatalog } from './raayonitSanitize'
import { sendSyncAlert, type AlertOutcome } from './raayonitSyncAlert'
import { brandSourceKey } from './raayonitMigration'
import { methodChanges, methodFingerprint, recordBusinessChanges, snapshotOf, SNAPSHOT_DOC, type MethodSnapshot, type RecordedChange } from './ledger/businessChanges'

// The daily Raayonit "תו על" sync, shared by the cron route, the admin button and the CLI. It reads the one live directory page,
// diffs it against the cards we hold, and writes ONLY the difference:
//   unchanged            nothing (no offer write, no translation call);
//   added / back after removal / removed / redemption method changed
//                        recorded in businessChanges as PENDING. Nothing is published, archived or rewritten by the sync itself:
//                        an admin approves each change (lib/inventory/ledger/businessChangeApproval.ts), and only while
//                        isRaayonitDisplayEnabled(). Approving an addition publishes a known brand or stages an unknown one as
//                        a draft; approving a removal soft-archives the card (never deleted, so vouchers keep working).
// A safety guard stops the run, with no offer written, when the page looks wrong or the change is implausibly large.

export const MIN_LIVE_ROWS = 150
export const MIN_LIVE_BRANDS = 150
export const MAX_REMOVALS = 15
export const REMOVAL_FRACTION = 0.1
export const MAX_ADDITIONS = 25
export const LOG_COLLECTION = 'raayonit_sync_logs'
const LOCK_STALE_MS = 15 * 60 * 1000
const UA = 'Mozilla/5.0 (compatible; GoLandlyCatalogSync)'
const CHUNK = 200

export type SyncStatus = 'ok' | 'aborted_guard' | 'error' | 'skipped'

export interface SyncReport {
  /** The Asia/Jerusalem calendar day, YYYY-MM-DD: also the log document's id. */
  date: string
  status: SyncStatus
  dry: boolean
  abortReason?: string
  skipped?: 'already-ran' | 'in-progress'
  startedAt: string
  finishedAt: string
  counts: { rows: number; liveBrands: number; existing: number; added: number; addedKnown: number; pendingReview: number; reactivated: number; archived: number; unchanged: number; changesRecorded?: number }
  added: { key: string; nameHe: string; nameEn: string; kind: AddedKind; category: string }[]
  reactivated: { key: string; nameHe: string; kind: AddedKind }[]
  archived: { id: string; nameHe: string }[]
  alert?: AlertOutcome
}

export interface DailySyncDeps {
  fetcher?: typeof fetch
  now?: () => Date
  /** Cloud Translation for the new brands' fine print; unset leaves it in Hebrew. */
  translateBatch?: TranslateBatch
  notify?: (report: SyncReport) => Promise<AlertOutcome>
  origin?: string
}

export interface DailySyncOptions {
  dry?: boolean
  /** Take the day's lock: a run that already succeeded today (or is running) is skipped. The cron sets it; the admin button does not. */
  guarded?: boolean
  /** Apply a change a guard would stop (the admin's explicit confirmation). */
  force?: boolean
}

/** The Asia/Jerusalem calendar day and hour of an instant. */
export function jerusalemClock(at: Date): { date: string; hour: number } {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(at).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) }
}

const cardOf = (id: string, d: FirebaseFirestore.DocumentData): ExistingCard => ({
  id,
  sourceKey: typeof d.sourceKey === 'string' ? d.sourceKey : '',
  brandName: String(d.brandName ?? ''),
  nameEn: typeof d.businessTranslations?.en?.businessName === 'string' ? d.businessTranslations.en.businessName : undefined,
  published: d.published !== false,
  pending: d.raayonitSyncPending === true,
  archivedReason: typeof d.archivedReason === 'string' ? d.archivedReason : undefined,
  archivedSourceKey: typeof d.archivedSourceKey === 'string' ? d.archivedSourceKey : undefined,
  restored: !!d.restoredAt,
})

async function readExisting(db: Firestore): Promise<ExistingCard[]> {
  const snap = await db.collection('offers').where('fulfillmentType', '==', 'raayonit_pool').get()
  return snap.docs.map((d) => cardOf(d.id, d.data()))
}

// Raayonit's site belongs to a third party: real requests to it leave at least a second apart (a promise chain, so the parallel detail
// fetches below queue up too). An injected fetcher (the tests) is not throttled.
let lastRequest: Promise<void> = Promise.resolve()
const politely = () => { const turn = lastRequest.then(() => new Promise<void>((r) => setTimeout(r, 1000))); lastRequest = turn; return turn }

async function getText(fetcher: typeof fetch, url: string, init?: RequestInit): Promise<{ text: string; contentType: string }> {
  let last: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (fetcher === globalThis.fetch) await politely()
      const res = await fetcher(url, { ...init, headers: { 'user-agent': UA, ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(30_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return { text: await res.text(), contentType: res.headers.get('content-type') ?? '' }
    } catch (err) {
      last = err
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500))
    }
  }
  throw last instanceof Error ? last : new Error(String(last))
}

/** Why a fetched page cannot be trusted as the directory, or null when it can. Pure. */
export function pageProblem(live: Pick<LiveDirectory, 'rows' | 'sections' | 'entries'>, html: string): string | null {
  if (!html.includes('תו על')) return 'the page does not mention תו על'
  if (live.sections.length < 5) return `only ${live.sections.length} sections were found`
  if (live.rows.length < MIN_LIVE_ROWS) return `only ${live.rows.length} listing rows were found (minimum ${MIN_LIVE_ROWS})`
  if (live.entries.length < MIN_LIVE_BRANDS) return `only ${live.entries.length} brands were found (minimum ${MIN_LIVE_BRANDS})`
  return null
}

/** Why the size of the change is implausible, or null. Pure. */
export function changeProblem(diff: Pick<CatalogDiff, 'removed' | 'added' | 'reactivated'>, activeCards: number): string | null {
  const cap = Math.min(MAX_REMOVALS, Math.max(1, Math.ceil(activeCards * REMOVAL_FRACTION)))
  if (diff.removed.length > cap) return `${diff.removed.length} brands would be archived (limit ${cap})`
  if (diff.added.length + diff.reactivated.length > MAX_ADDITIONS) return `${diff.added.length + diff.reactivated.length} brands would be added (limit ${MAX_ADDITIONS})`
  return null
}

const emptyCounts = (): SyncReport['counts'] => ({ rows: 0, liveBrands: 0, existing: 0, added: 0, addedKnown: 0, pendingReview: 0, reactivated: 0, archived: 0, unchanged: 0 })

/** The brand behind one live entry, with the detail panes of just its rows (or its network page). Null when it turns out to be suspended or junk. */
async function buildBrand(fetcher: typeof fetch, live: LiveDirectory, entry: LiveEntry, indexLogos: Map<string, string>): Promise<RaayonitBrand | null> {
  if (entry.source === 'network') return parseNetworkPage((await getText(fetcher, networkUrl(entry.key))).text, entry.key, indexLogos.get(entry.key) ?? '')
  const rows = live.rows.filter((r) => !isSuspended(r.title) && brandOfRow(r).key === entry.key)
  const infos = new Map<string, SupplierInfo>()
  for (let i = 0; i < rows.length; i += 4) {
    await Promise.all(rows.slice(i, i + 4).map(async (row) => {
      try {
        const body = new URLSearchParams({ rid: row.rowId, vid: String(RAAYONIT_VOUCHER_NUM), sid: row.sid })
        infos.set(row.sid, parseSupplierInfo((await getText(fetcher, `${RAAYONIT_BASE}SupplierVoucherInfo.asp`, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } })).text))
      } catch { /* a missing detail pane only leaves that row without its notes */ }
    }))
  }
  return groupListing(rows, live.sections, infos).brands.find((b) => b.key === entry.key) ?? null
}

async function claim(db: Firestore, date: string, now: number): Promise<'claimed' | 'already-ran' | 'in-progress'> {
  const ref = db.collection(LOG_COLLECTION).doc(date)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const d = snap.exists ? snap.data() : undefined
    if (d?.status === 'ok' && d.dry !== true) return 'already-ran' as const
    if (d?.status === 'running' && typeof d.claimedAt === 'number' && now - d.claimedAt < LOCK_STALE_MS) return 'in-progress' as const
    tx.set(ref, { status: 'running', claimedAt: now, dry: false })
    return 'claimed' as const
  })
}

export async function runDailySync(db: Firestore, options: DailySyncOptions = {}, deps: DailySyncDeps = {}): Promise<SyncReport> {
  const dry = options.dry === true
  const fetcher = deps.fetcher ?? fetch
  const startedAt = (deps.now?.() ?? new Date())
  const { date } = jerusalemClock(startedAt)
  const base: SyncReport = { date, status: 'ok', dry, startedAt: startedAt.toISOString(), finishedAt: startedAt.toISOString(), counts: emptyCounts(), added: [], reactivated: [], archived: [] }
  const finish = async (report: SyncReport): Promise<SyncReport> => {
    report.finishedAt = (deps.now?.() ?? new Date()).toISOString()
    if (dry) return report
    try { report.alert = await (deps.notify ?? sendSyncAlert)(report) } catch (err) { console.error('[raayonit-sync] alert failed', err) }
    await db.collection(LOG_COLLECTION).doc(date).set({ ...JSON.parse(JSON.stringify(report)), claimedAt: null, at: Timestamp.now() })
    return report
  }

  if (!dry && options.guarded) {
    const lock = await claim(db, date, startedAt.getTime())
    if (lock !== 'claimed') return { ...base, status: 'skipped', skipped: lock, finishedAt: new Date().toISOString() }
  }

  try {
    // 1. The page, and whether it can be trusted.
    let html: string
    try {
      const got = await getText(fetcher, indexUrl())
      if (!/text\/html/i.test(got.contentType)) throw new Error(`unexpected content-type ${got.contentType || '(none)'}`)
      html = got.text
    } catch (err) {
      return finish({ ...base, status: 'aborted_guard', abortReason: `the Raayonit page could not be read: ${(err as Error).message}` })
    }
    const live = parseLiveDirectory(html)
    const problem = pageProblem(live, html)
    if (problem) return finish({ ...base, status: 'aborted_guard', abortReason: problem, counts: { ...emptyCounts(), rows: live.rows.length, liveBrands: live.entries.length } })

    // 2. The diff. Network pages are known by number only: fetch the name of any that matches no card, then diff again.
    const existing = await readExisting(db)
    const indexLogos = new Map(parseNetworkIndex(html).map((n) => [n.key, n.logoUrl]))
    let entries = live.entries
    let diff = diffCatalog(entries, existing)
    if (diff.unresolved.length > 0) {
      if (diff.unresolved.length > MAX_ADDITIONS) return finish({ ...base, status: 'aborted_guard', abortReason: `${diff.unresolved.length} unknown network pages` })
      const named = new Map<string, LiveEntry>()
      for (const entry of diff.unresolved) {
        try {
          const brand = parseNetworkPage((await getText(fetcher, networkUrl(entry.key))).text, entry.key, indexLogos.get(entry.key) ?? '')
          if (brand) named.set(entry.key, { ...entry, nameHe: brand.nameHe, nameEn: brand.nameEn })
        } catch { /* skipped: it is looked at again tomorrow */ }
      }
      entries = entries.filter((e) => !diff.unresolved.includes(e)).concat([...named.values()])
      diff = diffCatalog(entries, existing)
    }
    const active = existing.filter((c) => /^raayonit:[^:]+$/.test(c.sourceKey) && c.sourceKey !== brandSourceKey('general')).length
    const counts = { ...emptyCounts(), rows: live.rows.length, liveBrands: entries.length, existing: active, unchanged: diff.unchanged }
    const tooBig = options.force ? null : changeProblem(diff, active)
    if (tooBig) return finish({ ...base, status: 'aborted_guard', abortReason: tooBig, counts: { ...counts, added: diff.added.length, reactivated: diff.reactivated.length, archived: diff.removed.length } })

    // 3. What each new or returning brand is, and how it goes out.
    const bundledLogos = new Map(bundledCatalog().map((b) => [b.key, !!b.logoFile]))
    const kinds = new Map<string, AddedKind>()
    const built: SnapshotBrand[] = []
    const reuse = new Map<string, string>()
    const report: SyncReport = { ...base, counts }
    const wanted = [...diff.added.map((entry) => ({ entry, card: null as ExistingCard | null })), ...diff.reactivated]
    for (const { entry, card } of wanted) {
      let brand: RaayonitBrand | null = null
      try { brand = (await buildBrand(fetcher, live, entry, indexLogos)) } catch (err) { console.error('[raayonit-sync] could not read', entry.key, err) }
      const final = brand ? finalizeCatalog([brand])[0] : undefined
      if (!final) continue
      const kind = classifyAdded({ nameHe: final.nameHe, nameEn: final.nameEn, hasLogo: bundledLogos.get(final.key) === true, hasGlossaryName: officialBrandName(final.nameHe, 'en') !== null })
      kinds.set(final.key, kind)
      built.push(final as SnapshotBrand)
      const row = { key: final.key, nameHe: final.nameHe, kind }
      if (card) { report.reactivated.push(row); reuse.set(final.key, card.id) }
      else report.added.push({ ...row, nameEn: final.nameEn, category: final.category })
    }
    report.counts.added = report.added.length
    report.counts.addedKnown = report.added.filter((a) => a.kind === 'known').length
    report.counts.reactivated = report.reactivated.length
    report.counts.pendingReview = [...report.added, ...report.reactivated].filter((a) => a.kind === 'unknown').length
    report.archived = diff.removed.map((c) => ({ id: c.id, nameHe: c.brandName }))
    report.counts.archived = diff.removed.length
    if (dry) return finish(report)

    // 4. Record the difference; publish nothing. Every change waits in businessChanges for an admin's approval
    // (lib/inventory/ledger/businessChanges.ts), and approval itself needs isRaayonitDisplayEnabled().
    // A restored partner Raayonit lists again no longer needs its protection: a later removal archives it as usual.
    for (let i = 0; i < diff.relisted.length; i += CHUNK) {
      const batch = db.batch()
      for (const card of diff.relisted.slice(i, i + CHUNK)) batch.update(db.collection('offers').doc(card.id), { restoredAt: FieldValue.delete(), restoredBy: FieldValue.delete() })
      await batch.commit()
    }
    const rowsOf = (e: LiveEntry) => live.rows.filter((r) => !isSuspended(r.title) && brandOfRow(r).key === e.key)
    const nextSnapshot = snapshotOf(entries, (e) => methodFingerprint(e, live, rowsOf))
    const snapRef = db.collection(SNAPSHOT_DOC[0]).doc(SNAPSHOT_DOC[1])
    const previous = (await snapRef.get()).data()?.entries as MethodSnapshot | undefined
    const recorded: RecordedChange[] = [
      ...built.flatMap((b) => {
        const entry = [...diff.added, ...diff.reactivated.map((r) => r.entry)].find((e) => e.key === b.key)
        return entry ? [{ kind: 'added' as const, key: b.key, nameHe: b.nameHe, nameEn: b.nameEn, after: kinds.get(b.key) ?? 'unknown', payload: { brand: JSON.parse(JSON.stringify(b)), reuseOfferId: reuse.get(b.key) ?? null, known: kinds.get(b.key) === 'known' } }] : []
      }),
      ...diff.removed.map((c) => ({ kind: 'removed' as const, key: c.sourceKey, nameHe: c.brandName, nameEn: c.nameEn ?? '', payload: { offerId: c.id, sourceKey: c.sourceKey } })),
      ...methodChanges(previous ?? null, nextSnapshot).map((m) => ({ kind: 'method_changed' as const, key: m.key, nameHe: m.nameHe, before: m.before, after: m.after })),
    ]
    report.counts.changesRecorded = await recordBusinessChanges(db, date, recorded)
    await snapRef.set({ entries: nextSnapshot, updatedAt: Timestamp.now() })
    return finish(report)
  } catch (err) {
    console.error('[raayonit-sync] failed', err)
    return finish({ ...base, status: 'error', abortReason: (err as Error).message })
  }
}
