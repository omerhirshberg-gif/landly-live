// Branch-level drift between Raayonit's live directory and the cards we hold, and the closures that hit only some of a business's branches.
// REPORT ONLY: nothing here writes a card, a phone or a branch, and an empty phone on Raayonit stays empty. The daily sync adds the result to its
// report and its raayonit_sync_logs document. Pure (no I/O): the sync, the CLI and the tests share it.
//
// Scope: the live directory page lists every branch of every listing-based business, so those are compared in full. A business that is only a
// "רשתות" network page has no branch rows on that page (its branches live on its own page, one request each), so for a card keyed by a
// NetworkNum only new live branches are reported, never "missing" ones.
import { aliasOf, finalizeCatalog } from './raayonitSanitize'
import { brandOfRow, groupListing, type ListingRow } from './raayonitListing'
import { identitiesOf, type ExistingCard, type LiveDirectory } from './raayonitLiveDiff'
import { brandSourceKey } from './raayonitMigration'
import { CLOSURE_PATTERN } from './raayonitClosure'

export interface BranchRef { address: string; phone: string }
export interface BranchChange { address: string; field: 'phone' | 'kosher'; before: string; after: string }
export interface BranchDriftEntry { key: string; nameHe: string; cardBranches: number; liveBranches: number; added: BranchRef[]; missing: BranchRef[]; changed: BranchChange[] }
/** A business that still has live branches while Raayonit marks some others as not honouring vouchers. */
export interface PartialClosure { key: string; nameHe: string; closed: string[]; liveBranches: number }
export interface DriftReport {
  brands: BranchDriftEntry[]
  partialClosures: PartialClosure[]
  /** Businesses whose every listed row carries a closure notice (they leave the catalogue through the removal path). */
  fullSuspensions: string[]
  counts: { brandsCompared: number; brandsDrifted: number; added: number; missing: number; changed: number; partialClosures: number; fullSuspensions: number }
}

const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/[.‎‏'"׳״,]/g, '').replace(/[\s\-–]+/g, ' ').trim()
const digits = (s: string) => s.replace(/\D/g, '')
const addrKey = (b: { address?: string; name?: string }) => norm(b.address || '') || norm(b.name || '')
/** Same phone when one number's digits contain the other's (formatting and a second number never count as a change); two empty phones match. */
const samePhone = (a: string, b: string): boolean => { const x = digits(a); const y = digits(b); return x === y || (!!x && !!y && (x.includes(y) || y.includes(x))) }

/** The business name without the closure notice Raayonit appends or prepends ("… - האתר לא מכבד תווים עד להודעה חדשה"). */
export function nameWithoutNotice(title: string): string {
  const kept = title.split(/\s+-\s+|\s*!?-\s*(?=[A-Za-z!])/).map((p) => p.trim()).filter((p) => p && !CLOSURE_PATTERN.test(p))
  return (kept.join(' - ') || title).replace(/[!]+/g, '').trim()
}

const isActive = (c: ExistingCard) => /^raayonit:[^:]+$/.test(c.sourceKey) && c.sourceKey !== brandSourceKey('general')

export function branchDrift(live: LiveDirectory, existing: readonly ExistingCard[]): DriftReport {
  const cards = existing.filter(isActive)
  const byKey = new Map(cards.map((c) => [c.sourceKey, c]))
  const byIdentity = new Map<string, ExistingCard>()
  for (const c of cards) for (const id of identitiesOf(c.brandName, c.nameEn)) if (!byIdentity.has(id)) byIdentity.set(id, c)
  const cardOf = (key: string, nameHe: string, nameEn: string) => byKey.get(brandSourceKey(key)) ?? identitiesOf(nameHe, nameEn).map((i) => byIdentity.get(i)).find(Boolean)

  // The live directory as our catalogue would build it (same grouping, merging and branch sanitising as the cards).
  const liveBrands = finalizeCatalog(groupListing(live.rows, live.sections, new Map()).brands)
  const out: DriftReport = { brands: [], partialClosures: [], fullSuspensions: [], counts: { brandsCompared: 0, brandsDrifted: 0, added: 0, missing: 0, changed: 0, partialClosures: 0, fullSuspensions: 0 } }

  for (const brand of liveBrands) {
    const card = cardOf(brand.key, brand.nameHe, brand.nameEn)
    if (!card || !card.branches) continue
    out.counts.brandsCompared++
    const networkKeyed = /^\d+$/.test(card.sourceKey.slice('raayonit:'.length))
    const cardBy = new Map(card.branches.map((b) => [addrKey(b), b]))
    const liveBy = new Map(brand.branches.map((b) => [addrKey(b), b]))
    const entry: BranchDriftEntry = { key: card.sourceKey.slice('raayonit:'.length), nameHe: card.brandName, cardBranches: card.branches.length, liveBranches: liveBy.size, added: [], missing: [], changed: [] }
    for (const [k, b] of liveBy) {
      const have = cardBy.get(k)
      if (!have) { entry.added.push({ address: b.address, phone: b.phone }); continue }
      if (!samePhone(have.phone ?? '', b.phone)) entry.changed.push({ address: b.address, field: 'phone', before: have.phone ?? '', after: b.phone })
      if ((have.kosher === true) !== (b.kosher === true)) entry.changed.push({ address: b.address, field: 'kosher', before: String(have.kosher === true), after: String(b.kosher === true) })
    }
    if (!networkKeyed) for (const [k, b] of cardBy) if (!liveBy.has(k)) entry.missing.push({ address: b.address ?? b.name ?? '', phone: b.phone ?? '' })
    if (entry.added.length + entry.missing.length + entry.changed.length > 0) out.brands.push(entry)
  }

  // Closures: a suspended row whose business still has live branches is a PARTIAL closure; one with none left is a full suspension.
  const closed = new Map<string, { nameHe: string; key: string; titles: string[] }>()
  for (const row of live.suspendedRows) {
    const cleaned: ListingRow = { ...row, title: nameWithoutNotice(row.title) }
    const b = brandOfRow(cleaned)
    const lead = liveBrands.find((x) => x.key === b.key || (aliasOf(b) !== null && aliasOf(b) === aliasOf(x)) || identitiesOf(b.nameHe, b.nameEn).some((i) => identitiesOf(x.nameHe, x.nameEn).includes(i)))
    const id = lead ? `live:${lead.key}` : `gone:${b.key}`
    const slot = closed.get(id) ?? { nameHe: lead?.nameHe ?? b.nameHe, key: lead?.key ?? b.key, titles: [] }
    slot.titles.push(row.title)
    closed.set(id, slot)
  }
  for (const [id, slot] of closed) {
    if (id.startsWith('live:')) out.partialClosures.push({ key: slot.key, nameHe: slot.nameHe, closed: slot.titles, liveBranches: liveBrands.find((x) => x.key === slot.key)?.branches.length ?? 0 })
    else out.fullSuspensions.push(slot.nameHe)
  }
  out.counts.brandsDrifted = out.brands.length
  out.counts.added = out.brands.reduce((n, b) => n + b.added.length, 0)
  out.counts.missing = out.brands.reduce((n, b) => n + b.missing.length, 0)
  out.counts.changed = out.brands.reduce((n, b) => n + b.changed.length, 0)
  out.counts.partialClosures = out.partialClosures.length
  out.counts.fullSuspensions = out.fullSuspensions.length
  return out
}
