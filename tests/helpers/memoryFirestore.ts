import { FieldValue, Timestamp, type DocumentData, type Firestore } from 'firebase-admin/firestore'

type Write = { kind: 'set' | 'update' | 'delete'; path: string; value?: DocumentData }
type Op = '==' | 'in' | '<' | '<=' | '>' | '>='
type Filter = { field: string; op: Op; expected: unknown }
type Order = { field: string; direction: 'asc' | 'desc' }

const sortKey = (value: unknown) => (value instanceof Timestamp ? value.toMillis() : (value as number))

// Like Firestore, a doc without the field matches no filter.
function matches(value: unknown, { op, expected }: Filter): boolean {
  if (value === undefined) return false
  if (op === '==') return value === expected
  if (op === 'in') return (expected as unknown[]).includes(value)
  const a = sortKey(value)
  const b = sortKey(expected)
  return op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b
}

function clone(value: unknown): any {
  if (value instanceof Timestamp || value instanceof FieldValue) return value
  if (Array.isArray(value)) return value.map(clone)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]))
  return value
}

// Just enough of the Admin Firestore API for the /api/account change routes,
// the WhatsApp bot and its support inbox: doc get/create/set (with
// merge)/update/delete, subcollections and auto-ids, batches, transactions
// (reads first, writes applied together, queries readable inside), queries
// chaining where (==, in, <, <=, >, >=), orderBy and limit, recursiveDelete,
// and the FieldValue sentinels they use (delete, increment, serverTimestamp).
export class MemoryFirestore {
  private records = new Map<string, DocumentData>()

  seed(path: string, value: DocumentData) { this.records.set(path, clone(value)) }
  read(path: string): DocumentData | undefined { return clone(this.records.get(path)) }
  /** The docs directly in a collection, by id. */
  list(collectionPath: string): Record<string, DocumentData> {
    return Object.fromEntries(this.childPaths(collectionPath).map((path) => [path.split('/').at(-1)!, this.read(path)!]))
  }

  private autoId = 0
  private childPaths(collectionPath: string) {
    return [...this.records.keys()].filter((path) => path.startsWith(`${collectionPath}/`) && !path.slice(collectionPath.length + 1).includes('/'))
  }

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
      collection: (name: string) => this.collection(`${path}/${name}`),
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
      set: (ref: { path: string }, value: DocumentData, options?: { merge?: boolean }) => {
        writes.push({ kind: options?.merge && this.records.has(ref.path) ? 'update' : 'set', path: ref.path, value })
      },
      update: (ref: { path: string }, value: DocumentData) => { writes.push({ kind: 'update', path: ref.path, value }) },
      delete: (ref: { path: string }) => { writes.push({ kind: 'delete', path: ref.path }) },
    }
  }

  private query(paths: string[]) {
    const docs = paths.map((path) => ({ ...this.snap(path), ref: this.ref(path) }))
    return { empty: docs.length === 0, docs }
  }

  private find(name: string, filters: Filter[], order: Order | undefined, max: number): any {
    const run = () => {
      let paths = this.childPaths(name).filter((path) => filters.every((filter) => matches(this.records.get(path)![filter.field], filter)))
      // Like Firestore, docs without the ordered field are left out.
      if (order) {
        paths = paths
          .filter((path) => this.records.get(path)![order.field] !== undefined)
          .sort((a, b) => (sortKey(this.records.get(a)![order.field]) - sortKey(this.records.get(b)![order.field])) * (order.direction === 'desc' ? -1 : 1))
      }
      return this.query(paths.slice(0, max))
    }
    return {
      where: (field: string, op: Op, expected: unknown) => this.find(name, [...filters, { field, op, expected }], order, max),
      orderBy: (field: string, direction: 'asc' | 'desc' = 'asc') => this.find(name, filters, { field, direction }, max),
      limit: (n: number) => this.find(name, filters, order, n),
      get: async () => run(),
    }
  }

  private collection(name: string): any {
    return {
      ...this.find(name, [], undefined, Infinity),
      doc: (id?: string) => this.ref(`${name}/${id ?? `auto-${++this.autoId}`}`),
    }
  }

  readonly db = {
    collection: (name: string) => this.collection(name),
    /** The doc and everything under it. */
    recursiveDelete: async (ref: { path: string }) => {
      for (const path of [...this.records.keys()]) if (path === ref.path || path.startsWith(`${ref.path}/`)) this.records.delete(path)
    },
    batch: () => {
      const writes: Write[] = []
      return { ...this.writer(writes), commit: async () => this.apply(writes) }
    },
    runTransaction: async (work: (tx: any) => Promise<unknown>) => {
      const writes: Write[] = []
      // A doc ref has a path; anything else is a query, read as it stands.
      const tx = {
        get: async (target: { path?: string; get: () => Promise<unknown> }) => (target.path ? this.snap(target.path) : target.get()),
        ...this.writer(writes),
      }
      const result = await work(tx)
      this.apply(writes)
      return result
    },
  } as unknown as Firestore
}
