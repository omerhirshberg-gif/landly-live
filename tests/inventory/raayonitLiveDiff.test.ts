import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { publicOfferData } from '@/lib/offers/availability'
import { officialBrandName } from '@/lib/inventory/raayonitBrandNames'
import { knownCategory } from '@/lib/inventory/raayonitCatalog'
import { bundledCatalog, type SnapshotBrand } from '@/lib/inventory/raayonitCatalogSync'
import { changeProblem, jerusalemClock, pageProblem, runDailySync, type DailySyncDeps } from '@/lib/inventory/raayonitDailySync'
import { classifyAdded, diffCatalog, parseLiveDirectory, type LiveEntry } from '@/lib/inventory/raayonitLiveDiff'
import { finalizeCatalog } from '@/lib/inventory/raayonitSanitize'

// The daily diff against a real capture of the live directory page (tests/fixtures/raayonit-253.html, VoucherNum=253), with the
// stored cards built from the bundled catalogue: today's page and that catalogue agree, so every case below is one deliberate change.

const HTML = readFileSync(fileURLToPath(new URL('../fixtures/raayonit-253.html', import.meta.url)), 'utf8')

type Doc = Record<string, unknown>
class FakeDb {
  collections = new Map<string, Map<string, Doc>>()
  writes: { op: 'set' | 'update' | 'delete'; path: string; data?: Doc }[] = []
  private col(name: string) { if (!this.collections.has(name)) this.collections.set(name, new Map()); return this.collections.get(name)! }
  seed(name: string, id: string, data: Doc) { this.col(name).set(id, data) }
  doc(name: string, id: string) { return this.col(name).get(id) }
  offerWrites() { return this.writes.filter((w) => w.path.startsWith('offers/')) }
  private ref(name: string, id: string) {
    return { id, path: `${name}/${id}`, set: async (d: Doc) => { this.writes.push({ op: 'set', path: `${name}/${id}`, data: d }); this.col(name).set(id, d) }, update: async (d: Doc) => { this.writes.push({ op: 'update', path: `${name}/${id}`, data: d }); this.col(name).set(id, { ...this.col(name).get(id), ...d }) } }
  }
  collection(name: string) {
    const self = this
    const query = (filters: [string, unknown][]) => ({
      where(field: string, _op: string, value: unknown) { return query([...filters, [field, value]]) },
      async get() {
        const docs = [...self.col(name)].filter(([, d]) => filters.every(([f, v]) => d[f] === v)).map(([id, d]) => ({ id, data: () => d, ref: self.ref(name, id) }))
        return { docs }
      },
    })
    let n = 0
    return { ...query([]), doc: (id?: string) => self.ref(name, id ?? `auto${++n}${self.col(name).size}`) }
  }
  batch() {
    const ops: (() => Promise<void>)[] = []
    return {
      set: (ref: { set: (d: Doc) => Promise<void> }, d: Doc) => { ops.push(() => ref.set(d)) },
      update: (ref: { update: (d: Doc) => Promise<void> }, d: Doc) => { ops.push(() => ref.update(d)) },
      commit: async () => { for (const op of ops) await op() },
    }
  }
  async runTransaction<T>(fn: (tx: { get: (r: { path: string }) => Promise<{ exists: boolean; data: () => Doc | undefined }>; set: (r: { path: string }, d: Doc) => void }) => Promise<T>): Promise<T> {
    return fn({
      get: async (r) => { const [c, id] = r.path.split('/') as [string, string]; const d = this.doc(c, id); return { exists: !!d, data: () => d } },
      set: (r, d) => { const [c, id] = r.path.split('/') as [string, string]; this.writes.push({ op: 'set', path: r.path, data: d }); this.col(c).set(id, d) },
    })
  }
}

const dbOf = (fake: FakeDb) => fake as unknown as Parameters<typeof runDailySync>[0]
const BRANDS = finalizeCatalog(bundledCatalog())
const seedCards = (fake: FakeDb, skip: (b: SnapshotBrand) => boolean = () => false) => {
  fake.seed('offers', 'general', { fulfillmentType: 'raayonit_pool', sourceKey: 'raayonit:general', brandName: 'תו על רב-רשתי', published: true })
  for (const b of BRANDS) if (!skip(b)) fake.seed('offers', `o-${b.key}`, { fulfillmentType: 'raayonit_pool', sourceKey: `raayonit:${b.key}`, brandName: b.nameHe, published: true })
  fake.seed('couponPools', 'p100', { kind: 'shared', faceValueAgorot: 10000, priceAgorot: 8900, status: 'active' })
  fake.seed('couponPools', 'p150', { kind: 'shared', faceValueAgorot: 15000, priceAgorot: 12900, status: 'active' })
}
const reply = (html: string) => new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
const fetcherOf = (page: string): typeof fetch => (async (url: RequestInfo | URL) => (String(url).includes('SupplierVoucherInfo') ? reply('<img src="https://www.raayonit.co.il/data/x.jpg">') : reply(page))) as typeof fetch
const NOW = new Date('2026-11-18T02:00:00Z') // 04:00 in Jerusalem (UTC+2)
const noMail: DailySyncDeps['notify'] = async () => 'none'
// A single-business listing brand that is fully known: a category rule, an official name and its own bundled image.
const KNOWN = BRANDS.find((b) => /^\d+$/.test(b.key) === false && b.key.startsWith('l-') && !b.key.startsWith('l-s') && !!b.logoFile && knownCategory(b.nameHe, b.nameEn) && officialBrandName(b.nameHe, 'en') !== null && /^\S+( \S+)?$/.test(b.nameHe) && HTML.includes(`>${b.nameHe}<`))!

let fake: FakeDb
let apply: ReturnType<typeof vi.fn>
const run = (opts: Parameters<typeof runDailySync>[1] = {}, page = HTML, deps: DailySyncDeps = {}) => runDailySync(dbOf(fake), opts, { fetcher: fetcherOf(page), now: () => NOW, notify: noMail, apply: apply as never, ...deps })
beforeEach(() => { fake = new FakeDb(); apply = vi.fn(async () => undefined); seedCards(fake) })

describe('parsing the live directory', () => {
  it('reads every brand from the one page', () => {
    const live = parseLiveDirectory(HTML)
    expect(live.rows.length).toBeGreaterThanOrEqual(400)
    expect(live.entries.length).toBeGreaterThanOrEqual(150)
    expect(pageProblem(live, HTML)).toBeNull()
  })
})

describe('unchanged catalogue', () => {
  it('writes no offer and calls no translator', async () => {
    const translateBatch = vi.fn(async (t: string[]) => t)
    const r = await run({}, HTML, { translateBatch })
    expect(r.status).toBe('ok')
    expect(r.counts).toMatchObject({ added: 0, archived: 0, reactivated: 0, pendingReview: 0 })
    expect(r.counts.unchanged).toBeGreaterThan(200)
    expect(fake.offerWrites()).toHaveLength(0)
    expect(apply).not.toHaveBeenCalled()
    expect(translateBatch).not.toHaveBeenCalled()
    expect(fake.doc('raayonit_sync_logs', '2026-11-18')).toMatchObject({ status: 'ok' }) // the run log is the only write
  })
  it('a dry run writes nothing at all', async () => {
    const r = await run({ dry: true })
    expect(r.status).toBe('ok')
    expect(fake.writes).toHaveLength(0)
  })
})

describe('a brand added', () => {
  it('a known brand is written live, once, with its own translation pass only', async () => {
    fake = new FakeDb(); seedCards(fake, (b) => b.key === KNOWN.key)
    const r = await run({ dry: true })
    expect(r.added.map((a) => a.nameHe)).toEqual([KNOWN.nameHe])
    expect(r.added[0]).toMatchObject({ kind: 'known', category: knownCategory(KNOWN.nameHe, KNOWN.nameEn) })
    const live = await run()
    expect(live.counts).toMatchObject({ added: 1, addedKnown: 1, pendingReview: 0 })
    expect(apply).toHaveBeenCalledTimes(1)
    const [brands, partial] = apply.mock.calls[0] as [SnapshotBrand[], { decide: (b: SnapshotBrand) => unknown }]
    expect(brands).toHaveLength(1)
    expect(partial.decide(brands[0]!)).toEqual({ published: true, pending: false })
  })

  it('an unknown brand is staged unpublished for review, translated once, and never public', async () => {
    // A business Raayonit lists under a name no rule knows, with no card of ours yet (its row is renamed; matching is by Raayonit's own key).
    fake = new FakeDb(); seedCards(fake, (b) => b.nameHe === 'קפה פולה')
    const page = HTML.replaceAll('קפה פולה', 'מסעדת הניסוי')
    const translateBatch = vi.fn(async (texts: string[]) => texts.map((t) => `x:${t}`))
    const r = await runDailySync(dbOf(fake), {}, { fetcher: fetcherOf(page), now: () => NOW, notify: noMail, translateBatch })
    expect(r.counts).toMatchObject({ added: 1, addedKnown: 0, pendingReview: 1, archived: 0 })
    const staged = fake.offerWrites().find((w) => w.op === 'set')!.data!
    expect(staged).toMatchObject({ published: false, raayonitSyncPending: true, source: 'raayonit-sync', brandName: 'מסעדת הניסוי' })
    expect(staged.pendingSince).toBeDefined()
    expect(publicOfferData(staged, { poolRemaining: new Map([['p100', 9]]), activeBusinesses: null })).toBeNull()
    expect(fake.offerWrites().filter((w) => w.op === 'set')).toHaveLength(1) // nothing else is rewritten
    expect(translateBatch.mock.calls.length).toBeLessThanOrEqual(4) // one pass per language, only this brand's strings
  })
})

describe('a brand removed', () => {
  it('is soft-archived, never deleted', async () => {
    fake.seed('offers', 'gone1', { fulfillmentType: 'raayonit_pool', sourceKey: 'raayonit:l-99999', brandName: 'עסק שנסגר', published: true })
    const r = await run()
    expect(r.counts.archived).toBe(1)
    expect(fake.writes.some((w) => w.op === 'delete')).toBe(false)
    expect(fake.doc('offers', 'gone1')).toMatchObject({ published: false, archivedReason: 'removed_from_raayonit_catalog', archivedSourceKey: 'raayonit:l-99999', sourceKey: 'retired:gone1' })
    expect(fake.doc('offers', 'gone1')!.archivedAt).toBeDefined()
    expect(fake.offerWrites()).toHaveLength(1)
  })
})

describe('a brand back after removal', () => {
  it('reactivates the same card instead of creating another', async () => {
    fake = new FakeDb(); seedCards(fake, (b) => b.key === KNOWN.key)
    fake.seed('offers', 'old1', { fulfillmentType: 'raayonit_pool', sourceKey: 'retired:old1', brandName: KNOWN.nameHe, published: false, archivedReason: 'removed_from_raayonit_catalog', archivedSourceKey: `raayonit:${KNOWN.key}` })
    const r = await run()
    expect(r.counts).toMatchObject({ added: 0, reactivated: 1 })
    const [, partial] = apply.mock.calls[0] as [SnapshotBrand[], { reuse: Map<string, string> }]
    expect(partial.reuse.get(KNOWN.key)).toBe('old1')
  })
})

describe('a manually restored brand', () => {
  it('is not archived while Raayonit omits it, and its protection is cleared once Raayonit lists it', async () => {
    fake.seed('offers', 'gone2', { fulfillmentType: 'raayonit_pool', sourceKey: 'raayonit:l-99995', brandName: 'עסק שהוחזר', published: true, restoredAt: new Date() })
    const r = await run()
    expect(r.counts.archived).toBe(0)
    expect(fake.offerWrites()).toHaveLength(0)
    const listed = BRANDS.find((b) => b.key.startsWith('l-') && !b.key.startsWith('l-s'))!
    fake.seed('offers', `o-${listed.key}`, { fulfillmentType: 'raayonit_pool', sourceKey: `raayonit:${listed.key}`, brandName: listed.nameHe, published: true, restoredAt: new Date() })
    await run()
    expect(fake.offerWrites().map((w) => w.path)).toEqual([`offers/o-${listed.key}`])
    expect(Object.keys(fake.offerWrites()[0]!.data!)).toEqual(['restoredAt', 'restoredBy'])
  })
})

describe('safety guards', () => {
  it('a truncated page aborts with no offer written', async () => {
    const r = await run({}, HTML.slice(0, 60_000))
    expect(r.status).toBe('aborted_guard')
    expect(r.abortReason).toMatch(/sections|rows|brands|תו על/)
    expect(fake.offerWrites()).toHaveLength(0)
    expect(apply).not.toHaveBeenCalled()
  })
  it('a page that is not HTML aborts', async () => {
    const r = await run({}, HTML, { fetcher: (async () => new Response('{}', { headers: { 'content-type': 'application/json' } })) as typeof fetch })
    expect(r.status).toBe('aborted_guard')
    expect(fake.offerWrites()).toHaveLength(0)
  })
  it('a failed fetch aborts', async () => {
    const r = await run({}, HTML, { fetcher: (async () => new Response('', { status: 503 })) as typeof fetch })
    expect(r.status).toBe('aborted_guard')
    expect(r.abortReason).toMatch(/could not be read/)
  })
  it('a mass-removal spike archives nothing unless forced', async () => {
    for (let i = 0; i < 30; i++) fake.seed('offers', `x${i}`, { fulfillmentType: 'raayonit_pool', sourceKey: `raayonit:l-9${i}`, brandName: `נעלם ${i}`, published: true })
    const r = await run()
    expect(r.status).toBe('aborted_guard')
    expect(r.abortReason).toMatch(/archived/)
    expect(fake.offerWrites()).toHaveLength(0)
    expect(changeProblem({ removed: new Array(2).fill({}), added: [], reactivated: [] }, 230)).toBeNull()
    const forced = await run({ force: true })
    expect(forced.status).toBe('ok')
    expect(forced.counts.archived).toBe(30)
  })
  it('the day is claimed once', async () => {
    await run({ guarded: true })
    const again = await run({ guarded: true })
    expect(again.status).toBe('skipped')
    expect(again.skipped).toBe('already-ran')
  })
})

describe('Asia/Jerusalem clock', () => {
  it('is 04:00 at 02:00 UTC in winter and 01:00 UTC in summer', () => {
    expect(jerusalemClock(new Date('2026-01-15T02:00:00Z'))).toEqual({ date: '2026-01-15', hour: 4 })
    expect(jerusalemClock(new Date('2026-07-15T01:00:00Z'))).toEqual({ date: '2026-07-15', hour: 4 })
    expect(jerusalemClock(new Date('2026-07-15T02:00:00Z')).hour).toBe(5)
    expect(jerusalemClock(new Date('2026-01-14T22:30:00Z'))).toEqual({ date: '2026-01-15', hour: 0 })
  })
})

describe('diff and classification', () => {
  it('matches a returning name through the alias table', () => {
    const live: LiveEntry[] = [{ key: 'l-max-brenner', nameHe: 'מקס ברנר', nameEn: 'Max Brenner', source: 'listing' }]
    const d = diffCatalog(live, [{ id: 'a', sourceKey: 'raayonit:35', brandName: 'MAX BRENNER', published: true, pending: false }])
    expect(d.unchanged).toBe(1)
    expect(d.added).toHaveLength(0)
    expect(d.removed).toHaveLength(0)
  })
  it('only a brand with a category rule, an official name and an image goes live by itself', () => {
    expect(classifyAdded({ nameHe: KNOWN.nameHe, nameEn: KNOWN.nameEn, hasLogo: true, hasGlossaryName: true })).toBe('known')
    expect(classifyAdded({ nameHe: KNOWN.nameHe, nameEn: KNOWN.nameEn, hasLogo: false, hasGlossaryName: true })).toBe('unknown')
    expect(classifyAdded({ nameHe: 'מסעדת הניסוי', nameEn: '', hasLogo: true, hasGlossaryName: true })).toBe('unknown')
  })
})
