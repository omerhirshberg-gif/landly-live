import 'server-only'
import { Timestamp, type Firestore, type Transaction } from 'firebase-admin/firestore'
import { clientIp } from '@/lib/auth/clientIp'
import { maskCodesDeep, scrubText } from '@/lib/inventory/ledger/codes'

// adminAuditLog/{id}: append-only record of every admin state change. Admin is
// one shared server session, so the actor is always 'admin'; the IP and time
// are what tell sessions apart. Clients can't read or write it (firestore.rules).
export interface AuditEntry {
  action: string // 'user.suspend', 'pool.create', 'payout.lock', ...
  targetType: string // 'user' | 'pool' | 'invite' | 'payoutBatch' | ...
  targetId: string
  before?: unknown
  after?: unknown
  note?: string
}

function entryData(request: Request, entry: AuditEntry) {
  return {
    actor: 'admin', action: entry.action, targetType: entry.targetType, targetId: entry.targetId,
    // Never a voucher code in the log: code fields are masked and code-shaped text is shortened to its last 4 characters.
    before: maskCodesDeep(entry.before ?? null), after: maskCodesDeep(entry.after ?? null), note: entry.note ? scrubText(entry.note) : null,
    ip: clientIp(request), at: Timestamp.now(),
  }
}

/** Standalone write; use inside a transaction with `auditInTransaction` when the change must commit together with it. */
export async function writeAudit(db: Firestore, request: Request, entry: AuditEntry): Promise<void> {
  await db.collection('adminAuditLog').doc().set(entryData(request, entry))
}

export function auditInTransaction(db: Firestore, tx: Transaction, request: Request, entry: AuditEntry): void {
  tx.create(db.collection('adminAuditLog').doc(), entryData(request, entry))
}
