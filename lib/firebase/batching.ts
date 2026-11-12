import type { DocumentReference, DocumentSnapshot, Firestore } from 'firebase-admin/firestore'

// Helpers for reading many documents at once instead of one read per item (the
// N+1 pattern). Server side (Admin SDK); the browser's equivalents live next to
// their readers (lib/firebase/offers.ts, orders.ts).

/** Firestore's `in` operator takes at most 30 values. */
export const IN_QUERY_LIMIT = 30

export function chunked<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Every ref in one round trip (db.getAll), de-duplicated, as a Map by document
 * id. A document that doesn't exist is still in the map, with `exists: false`.
 * One batched read for the whole list, however long it is.
 */
export async function getAllById(db: Firestore, refs: readonly DocumentReference[]): Promise<Map<string, DocumentSnapshot>> {
  const unique = [...new Map(refs.map((ref) => [ref.path, ref])).values()]
  if (unique.length === 0) return new Map()
  const snaps = await db.getAll(...unique)
  // getAll returns the snapshots in the order of the refs it was given.
  return new Map(unique.map((ref, i) => [ref.path, snaps[i]!]))
}
