import { FieldValue, Timestamp, type DocumentData, type Firestore } from 'firebase-admin/firestore'

type Write = { kind: 'set' | 'update' | 'delete'; path: string; value?: DocumentData }

function clone(value: unknown): any {
  if (value instanceof Timestamp || value instanceof FieldValue) return value
  if (Array.isArray(value)) return value.map(clone)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]))
  return value
}

// Just enough of the Admin Firestore API for the /api/account change routes
// and the WhatsApp bot: doc get/create/set (with merge)/update/delete,
// batches, transactions (reads first, writes applied together), a
// single-field equality query, and the FieldValue sentinels they use
// (delete, increment, serverTimestamp).
export class MemoryFirestore {
  private records = new Map<string, DocumentData>()

  seed(path: string, value: DocumentData) { this.records.set(path, clone(value)) }
  read(path: string): DocumentData | undefined { return clone(this.records.get(path)) }

  private snap(path: string) {
    const value = this.read(path)
    return { id: path.split('/').at(-1)!, exists: value !== undefined, data: () => value, get: (field: string) => value?.[field] }
  }

  private apply(writes: Write[]) {
    for (const write of writes) {
      if (write.kind === 'delete') {
        this.records.delete(write.path)
      } else if (write.kind === 'set') {
        this.records.set(write.path, clone(write.value))
      } else {
        const current = this.records.get(write.path)
        if (!current) throw Object.assign(new Error('No document to update'), { code: 5 })
        const next = clone(current)
        for (const [key, update] of Object.entries(write.value!)) {
          if (update instanceof FieldValue) {
            if (update.isEqual(FieldValue.delete())) delete next[key]
            else if (update.isEqual(FieldValue.serverTimestamp())) next[key] = Timestamp.now()
            else next[key] = (next[key] ?? 0) + (update as unknown as { operand: number }).operand
          } else {
            next[key] = clone(update)
          }
        }
        this.records.set(write.path, next)
      }
    }
  }

  private ref(path: string): any {
    return {
      path,
      id: path.split('/').at(-1)!,
      get: async () => this.snap(path),
      create: async (value: DocumentData) => {
        if (this.records.has(path)) throw Object.assign(new Error('Document already exists'), { code: 6 })
        this.apply([{ kind: 'set', path, value }])
      },
      set: async (value: DocumentData, options?: { merge?: boolean }) =>
        options?.merge && this.records.has(path)
          ? this.apply([{ kind: 'update', path, value }])
          : this.apply([{ kind: 'set', path, value }]),
      update: async (value: DocumentData) => this.apply([{ kind: 'update', path, value }]),
      delete: async () => this.apply([{ kind: 'delete', path }]),
    }
  }

  private writer(writes: Write[]) {
    return {
      set: (ref: { path: string }, value: DocumentData) => { writes.push({ kind: 'set', path: ref.path, value }) },
      update: (ref: { path: string }, value: DocumentData) => { writes.push({ kind: 'update', path: ref.path, value }) },
      delete: (ref: { path: string }) => { writes.push({ kind: 'delete', path: ref.path }) },
    }
  }

  readonly db = {
    collection: (name: string) => ({
      doc: (id: string) => this.ref(`${name}/${id}`),
      where: (field: string, _op: '==', expected: unknown) => ({
        limit: (n: number) => ({
          get: async () => {
            const docs = [...this.records.entries()]
              .filter(([path, value]) => path.startsWith(`${name}/`) && value[field] === expected)
              .slice(0, n)
              .map(([path]) => ({ ...this.snap(path), ref: this.ref(path) }))
            return { empty: docs.length === 0, docs }
          },
        }),
      }),
    }),
    batch: () => {
      const writes: Write[] = []
      return { ...this.writer(writes), commit: async () => this.apply(writes) }
    },
    runTransaction: async (work: (tx: any) => Promise<unknown>) => {
      const writes: Write[] = []
      const tx = { get: async (ref: { path: string }) => this.snap(ref.path), ...this.writer(writes) }
      const result = await work(tx)
      this.apply(writes)
      return result
    },
  } as unknown as Firestore
}
