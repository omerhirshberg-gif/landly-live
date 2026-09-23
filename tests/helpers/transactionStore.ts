import { FieldValue, Firestore, Timestamp, type DocumentData } from 'firebase-admin/firestore'

export function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

function clone(value: unknown): any {
  if (value instanceof Timestamp || value instanceof FieldValue) return value
  if (Array.isArray(value)) return value.map(clone)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]))
  return value
}

// Small optimistic transaction model for deterministic interleavings/failures.
// Emulator tests separately verify that the real Firestore SDK has these semantics.
export class TransactionStore {
  private records = new Map<string, DocumentData>()
  private versions = new Map<string, number>()
  attempts = 0
  beforeCommit?: () => Promise<void>

  seed(path: string, value: DocumentData) {
    this.records.set(path, clone(value))
    this.versions.set(path, (this.versions.get(path) ?? 0) + 1)
  }
  read(path: string): DocumentData | undefined { return clone(this.records.get(path)) }
  snapshot() { return clone(Object.fromEntries(this.records)) }
  count(collection: string) { return [...this.records.keys()].filter((key) => key.startsWith(`${collection}/`)).length }
  private ref(path: string) { return { path, id: path.split('/').at(-1)! } }

  readonly db = {
    collection: (name: string) => ({ doc: (id: string) => this.ref(`${name}/${id}`) }),
    runTransaction: async (work: (tx: any) => Promise<unknown>) => {
      for (let retry = 0; retry < 10; retry++) {
        this.attempts++
        const reads = new Map<string, number>()
        const writes: { kind: 'create' | 'update'; path: string; value: DocumentData }[] = []
        const tx = {
          get: async (ref: { path: string }) => {
            if (writes.length) throw new Error('Reads must precede writes')
            reads.set(ref.path, this.versions.get(ref.path) ?? 0)
            const value = this.read(ref.path)
            return { exists: value !== undefined, data: () => value }
          },
          create: (ref: { path: string }, value: DocumentData) => { writes.push({ kind: 'create', path: ref.path, value }) },
          update: (ref: { path: string }, value: DocumentData) => { writes.push({ kind: 'update', path: ref.path, value }) },
        }
        const result = await work(tx)
        const hook = this.beforeCommit
        this.beforeCommit = undefined
        await hook?.()
        if ([...reads].some(([path, version]) => (this.versions.get(path) ?? 0) !== version)) continue
        const next = new Map(this.records)
        for (const write of writes) {
          if (write.kind === 'create') {
            if (next.has(write.path)) throw new Error('Already exists')
            next.set(write.path, clone(write.value))
          } else {
            if (!next.has(write.path)) throw new Error('Missing update target')
            const value = clone(next.get(write.path))
            for (const [key, update] of Object.entries(write.value)) {
              const parts = key.split('.')
              let parent = value
              for (const part of parts.slice(0, -1)) parent = parent[part] ??= {}
              const leaf = parts.at(-1)!
              parent[leaf] = update instanceof FieldValue
                ? (parent[leaf] ?? 0) + (update as unknown as { operand: number }).operand : clone(update)
            }
            next.set(write.path, value)
          }
        }
        this.records = next
        for (const write of writes) this.versions.set(write.path, (this.versions.get(write.path) ?? 0) + 1)
        return result
      }
      throw new Error('Transaction contention exhausted retries')
    },
  } as unknown as Firestore
}
