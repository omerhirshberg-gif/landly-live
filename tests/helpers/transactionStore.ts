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
  private autoId = 0
  beforeCommit?: () => Promise<void>

  seed(path: string, value: DocumentData) {
    this.records.set(path, clone(value))
    this.versions.set(path, (this.versions.get(path) ?? 0) + 1)
  }
  read(path: string): DocumentData | undefined { return clone(this.records.get(path)) }
  snapshot() { return clone(Object.fromEntries(this.records)) }
  count(collection: string) { return [...this.records.keys()].filter((key) => key.startsWith(`${collection}/`)).length }
  private snap(path: string): { exists: boolean; id: string; data: () => DocumentData | undefined; get: (field: string) => any; ref: any } {
    const value = this.read(path)
    return { exists: value !== undefined, id: path.split('/').at(-1)!, data: () => value, get: (field: string) => value?.[field], ref: this.ref(path) }
  }
  // Direct children of a collection path matching every [field, value] equality filter.
  private query(prefix: string, filters: [string, unknown][]) {
    const get = async (): Promise<{ docs: ReturnType<TransactionStore['snap']>[]; size: number; empty: boolean }> => {
      const docs = [...this.records.keys()]
        .filter((key) => key.startsWith(`${prefix}/`) && !key.slice(prefix.length + 1).includes('/'))
        .map((key) => this.snap(key))
        .filter((d) => filters.every(([f, v]) => (d.get(f) ?? null) === v))
      return { docs, size: docs.length, empty: docs.length === 0 }
    }
    return { get, limit: (_n: number) => this.query(prefix, filters), where: (field: string, _op: string, value: unknown) => this.query(prefix, [...filters, [field, value]]) }
  }
  private coll(prefix: string) {
    return { doc: (id: string = `auto${++this.autoId}`) => this.ref(`${prefix}/${id}`), ...this.query(prefix, []) }
  }
  private ref(path: string) {
    return {
      path, id: path.split('/').at(-1)!,
      collection: (name: string) => this.coll(`${path}/${name}`),
      // A plain read outside any transaction.
      get: async () => this.snap(path),
      update: async (value: DocumentData) => { const now = this.read(path); if (!now) throw new Error('Missing update target'); this.seed(path, { ...now, ...value }) },
      set: async (value: DocumentData) => { this.seed(path, value) },
      delete: async () => { this.records.delete(path); this.versions.set(path, (this.versions.get(path) ?? 0) + 1) },
    }
  }

  readonly db = {
    collection: (name: string) => this.coll(name),
    // Like the Admin SDK: every ref in one call, snapshots in the order asked.
    getAll: async (...refs: { path: string }[]) => refs.map((ref) => this.snap(ref.path)),
    batch: () => {
      const deletes: { delete: () => Promise<void> }[] = []
      return { delete: (ref: { delete: () => Promise<void> }) => { deletes.push(ref) }, commit: async () => { for (const ref of deletes) await ref.delete() } }
    },
    runTransaction: async (work: (tx: any) => Promise<unknown>) => {
      for (let retry = 0; retry < 10; retry++) {
        this.attempts++
        const reads = new Map<string, number>()
        const writes: { kind: 'create' | 'set' | 'update'; path: string; value: DocumentData }[] = []
        const tx = {
          get: async (ref: { path: string }) => {
            if (writes.length) throw new Error('Reads must precede writes')
            reads.set(ref.path, this.versions.get(ref.path) ?? 0)
            return this.snap(ref.path)
          },
          create: (ref: { path: string }, value: DocumentData) => { writes.push({ kind: 'create', path: ref.path, value }) },
          set: (ref: { path: string }, value: DocumentData) => { writes.push({ kind: 'set', path: ref.path, value }) },
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
          } else if (write.kind === 'set') {
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
