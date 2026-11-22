import 'server-only'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'
import { BUSINESS_CHANGES_COLLECTION, type SupplierId } from './types'
import type { LiveDirectory, LiveEntry } from '../raayonitLiveDiff'

// The daily 04:00 Raayonit sync records what changed in the directory into businessChanges/{day_kind_key} and publishes NOTHING.
// An admin approves each change (and only while isRaayonitDisplayEnabled()); approval is what touches the storefront.
//   added            a business now listed that we hold no card for (or an archived one that came back)
//   removed          a card whose business the directory no longer lists
//   method_changed   the business's redemption fingerprint changed (in store / online / by phone, or listing <-> network)

export type ChangeKind = 'added' | 'removed' | 'method_changed'
export type ChangeStatus = 'pending' | 'approved' | 'dismissed'

export interface BusinessChange {
  supplierId: SupplierId
  kind: ChangeKind
  key: string
  nameHe: string
  nameEn: string
  before: string | null
  after: string | null
  /** For 'added': the built brand, kept so approval needs no second fetch. For 'removed': the offer id to archive. */
  payload: Record<string, unknown> | null
  day: string
  status: ChangeStatus
  detectedAt: Timestamp
  decidedAt: Timestamp | null
  decidedBy: string | null
}

export type MethodSnapshot = Record<string, { nameHe: string; method: string }>

/** in_store plus online/phone when any of the business's rows carries a website or phone, plus how the directory lists it. */
export function methodFingerprint(entry: LiveEntry, live: Pick<LiveDirectory, 'rows'>, rowsOf: (e: LiveEntry) => LiveDirectory['rows']): string {
  const rows = rowsOf(entry)
  const tags = new Set<string>([entry.source])
  if (rows.some((r) => r.website)) tags.add('online')
  if (rows.some((r) => r.phone)) tags.add('phone')
  void live
  return [...tags].sort().join('+')
}

export function snapshotOf(entries: readonly LiveEntry[], fingerprint: (e: LiveEntry) => string): MethodSnapshot {
  return Object.fromEntries(entries.map((e) => [e.key, { nameHe: e.nameHe, method: fingerprint(e) }]))
}

/** Pure: businesses whose fingerprint changed since the last snapshot (only those present in both). */
export function methodChanges(prev: MethodSnapshot | null, next: MethodSnapshot): { key: string; nameHe: string; before: string; after: string }[] {
  if (!prev) return []
  return Object.entries(next).flatMap(([key, v]) => (prev[key] && prev[key]!.method !== v.method ? [{ key, nameHe: v.nameHe || prev[key]!.nameHe, before: prev[key]!.method, after: v.method }] : []))
}

export interface RecordedChange { kind: ChangeKind; key: string; nameHe: string; nameEn?: string; before?: string | null; after?: string | null; payload?: Record<string, unknown> | null }

const safeId = (s: string) => s.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 80)

/** Writes the changes as pending, idempotently (the same change on the same day is written once). Returns how many are new. */
export async function recordBusinessChanges(db: Firestore, day: string, changes: readonly RecordedChange[], now: Timestamp = Timestamp.now(), supplierId: SupplierId = 'raayonit'): Promise<number> {
  let created = 0
  for (const c of changes) {
    const ref = db.collection(BUSINESS_CHANGES_COLLECTION).doc(`${day}_${c.kind}_${safeId(c.key)}`)
    try {
      await ref.create({
        supplierId, kind: c.kind, key: c.key, nameHe: c.nameHe, nameEn: c.nameEn ?? '', before: c.before ?? null, after: c.after ?? null, payload: c.payload ?? null,
        day, status: 'pending', detectedAt: now, decidedAt: null, decidedBy: null,
      } satisfies BusinessChange)
      created++
    } catch { /* already recorded today */ }
  }
  return created
}

export const SNAPSHOT_DOC = ['system_config', 'raayonit_directory_snapshot'] as const
