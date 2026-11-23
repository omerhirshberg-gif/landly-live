// The daily "תו על" diff: what Raayonit's live directory (VoucherNum=253) lists now against the offers we already hold.
// Pure (no I/O, no Firebase), so the daily sync, the CLI and the tests share it. The listing page alone names every brand
// that is a single business or a chain section; the 74 "רשתות" network pages are known by their NetworkNum only, and their
// names are fetched by the caller for the few that match no card.
import { isSuspended, brandOfRow, parseListingRows, parseListingSections, type ListingRow, type ListingSection } from './raayonitListing'
import { knownCategory, parseNetworkIndex } from './raayonitCatalog'
import { aliasOf } from './raayonitSanitize'
import { brandSourceKey } from './raayonitMigration'
import { CANONICAL_EXTRA_BRANDS, SUSPENDED_BRAND_KEYS } from './raayonitCanonicalCatalog'

export interface LiveEntry {
  /** Raayonit's stable key: `l-{sid}`, `l-s{section}`, `l-{chain}` (listing) or the NetworkNum (network page). */
  key: string
  nameHe: string
  nameEn: string
  source: 'listing' | 'network'
}

export interface LiveDirectory {
  rows: ListingRow[]
  sections: ListingSection[]
  entries: LiveEntry[]
  /** Titles dropped because the row itself says the business is not honouring vouchers. */
  suspended: string[]
  /** The dropped rows themselves, so a business with only some branches closed can be told apart from a fully suspended one. */
  suspendedRows: ListingRow[]
}

/** Every brand the live directory lists, from the listing page's rows and the network index (both on the one page). */
export function parseLiveDirectory(html: string): LiveDirectory {
  const rows = parseListingRows(html)
  const sections = parseListingSections(html)
  const suspended: string[] = []
  const suspendedRows: ListingRow[] = []
  const byKey = new Map<string, LiveEntry>()
  for (const row of rows) {
    if (isSuspended(row.title)) { suspended.push(row.title); suspendedRows.push(row); continue }
    const brand = brandOfRow(row)
    if (!byKey.has(brand.key)) byKey.set(brand.key, { key: brand.key, nameHe: brand.nameHe, nameEn: brand.nameEn, source: 'listing' })
  }
  for (const { key } of parseNetworkIndex(html)) if (!byKey.has(key) && !SUSPENDED_BRAND_KEYS.includes(key)) byKey.set(key, { key, nameHe: '', nameEn: '', source: 'network' })
  return { rows, sections, entries: [...byKey.values()], suspended, suspendedRows }
}

/** A stored offer card, reduced to what the diff needs. */
export interface ExistingCard {
  id: string
  sourceKey: string
  brandName: string
  nameEn?: string
  published: boolean
  pending: boolean
  archivedReason?: string
  /** The `raayonit:…` key an archived card had before it became `retired:{id}`. */
  archivedSourceKey?: string
  /** The card's branch list as stored (address, phone and kosher flag are what the drift check compares). */
  branches?: { name?: string; address?: string; phone?: string; kosher?: boolean }[]
  /** An admin restored this card by hand: the nightly sync must not archive it again until Raayonit lists it and later drops it. */
  restored?: boolean
}

const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/[.‎‏'"׳״]/g, '').replace(/[\s\-–]+/g, ' ').trim()
/** The names one business goes by: its alias group when it has one, plus its Hebrew and English names. */
export function identitiesOf(nameHe: string, nameEn = ''): string[] {
  const alias = aliasOf({ nameHe, nameEn })
  return [...new Set([alias ? `alias:${alias}` : '', norm(nameHe), norm(nameEn)].filter(Boolean))]
}

export interface CatalogDiff {
  /** Listed now, no card, nothing archived to bring back. */
  added: LiveEntry[]
  /** Listed now, and an archived card of the same brand exists: bring it back. */
  reactivated: { entry: LiveEntry; card: ExistingCard }[]
  /** Cards whose brand the directory no longer lists. */
  removed: ExistingCard[]
  unchanged: number
  /** Network entries that match no card by key and have no name yet: the caller fetches their pages and diffs again. */
  unresolved: LiveEntry[]
  /** Manually restored cards Raayonit lists again: their restore protection has done its job and is cleared. */
  relisted: ExistingCard[]
}

// Brands the sync adds by hand (the canonical extras: Raayonit's pages never list them under a key of their own) are never "removed".
const EXEMPT = new Set(CANONICAL_EXTRA_BRANDS.map((b) => brandSourceKey(b.key)))
const isActiveCard = (c: ExistingCard) => /^raayonit:[^:]+$/.test(c.sourceKey) && c.sourceKey !== brandSourceKey('general')

export function diffCatalog(entries: readonly LiveEntry[], existing: readonly ExistingCard[]): CatalogDiff {
  const active = existing.filter(isActiveCard)
  const byKey = new Map(active.map((c) => [c.sourceKey, c]))
  const byIdentity = new Map<string, ExistingCard>()
  for (const c of active) for (const id of identitiesOf(c.brandName, c.nameEn)) if (!byIdentity.has(id)) byIdentity.set(id, c)
  const archived = existing.filter((c) => c.archivedReason === 'removed_from_raayonit_catalog' && c.archivedSourceKey)
  const archivedByKey = new Map(archived.map((c) => [c.archivedSourceKey!, c]))
  const archivedByIdentity = new Map<string, ExistingCard>()
  for (const c of archived) for (const id of identitiesOf(c.brandName, c.nameEn)) if (!archivedByIdentity.has(id)) archivedByIdentity.set(id, c)

  const matched = new Set<string>()
  const taken = new Set<string>()
  const out: CatalogDiff = { added: [], reactivated: [], removed: [], unchanged: 0, unresolved: [], relisted: [] }
  for (const entry of entries) {
    const ids = identitiesOf(entry.nameHe, entry.nameEn)
    const hit = byKey.get(brandSourceKey(entry.key)) ?? ids.map((i) => byIdentity.get(i)).find(Boolean)
    if (hit) { matched.add(hit.id); out.unchanged++; continue }
    if (entry.source === 'network' && !entry.nameHe) {
      const back = archivedByKey.get(brandSourceKey(entry.key))
      if (back && !taken.has(back.id)) { taken.add(back.id); out.reactivated.push({ entry, card: back }); continue }
      out.unresolved.push(entry)
      continue
    }
    const back = archivedByKey.get(brandSourceKey(entry.key)) ?? ids.map((i) => archivedByIdentity.get(i)).find(Boolean)
    if (back && !taken.has(back.id)) { taken.add(back.id); out.reactivated.push({ entry, card: back }); continue }
    out.added.push(entry)
  }
  out.removed = active.filter((c) => !matched.has(c.id) && !EXEMPT.has(c.sourceKey) && !c.restored)
  out.relisted = active.filter((c) => c.restored && matched.has(c.id))
  return out
}

export type AddedKind = 'known' | 'unknown'
export interface BrandFacts { nameHe: string; nameEn: string; hasLogo: boolean; hasGlossaryName: boolean }

/**
 * A new brand goes live by itself only when everything needed to show it well is already known: a category in
 * CATEGORY_RULES, an official name in every language (raayonitBrandNames.ts) and an image. Anything else is staged for an admin.
 */
export function classifyAdded(brand: BrandFacts): AddedKind {
  return knownCategory(brand.nameHe, brand.nameEn) !== null && brand.hasGlossaryName && brand.hasLogo ? 'known' : 'unknown'
}
