import { FieldValue } from 'firebase-admin/firestore'

// A small in-memory Firestore for the Raayonit admin tests: equality queries, doc get/set/update/delete, batches. update() honours
// FieldValue.delete(). Every write is recorded in `writes`.
type Doc = Record<string, unknown>
const isDeleteSentinel = (v: unknown) => !!v && typeof v === 'object' && typeof (v as { isEqual?: unknown }).isEqual === 'function' && (v as { isEqual: (o: unknown) => boolean }).isEqual(FieldValue.delete())

export class FakeFirestore {
  collections = new Map<string, Map<string, Doc>>()
  writes: { op: 'set' | 'update' | 'delete'; path: string; data?: Doc }[] = []
  private col(name: string) { if (!this.collections.has(name)) this.collections.set(name, new Map()); return this.collections.get(name)! }
  seed(name: string, id: string, data: Doc) { this.col(name).set(id, data) }
  doc(name: string, id: string) { return this.col(name).get(id) }
  has(name: string, id: string) { return this.col(name).has(id) }
  private ref(name: string, id: string) {
    const self = this
    return {
      id, path: `${name}/${id}`,
      async get() { const d = self.col(name).get(id); return { id, exists: !!d, data: () => d } },
      async set(d: Doc) { self.writes.push({ op: 'set', path: `${name}/${id}`, data: d }); self.col(name).set(id, d) },
      async update(d: Doc) {
        self.writes.push({ op: 'update', path: `${name}/${id}`, data: d })
        const next = { ...self.col(name).get(id) }
        for (const [k, v] of Object.entries(d)) { if (isDeleteSentinel(v)) delete next[k]; else next[k] = v }
        self.col(name).set(id, next)
      },
      async delete() { self.writes.push({ op: 'delete', path: `${name}/${id}` }); self.col(name).delete(id) },
    }
  }
  collection(name: string) {
    const self = this
    const query = (filters: [string, unknown][], max = Infinity) => ({
      where(field: string, _op: string, value: unknown) { return query([...filters, [field, value]], max) },
      limit(n: number) { return query(filters, n) },
      async get() {
        const docs = [...self.col(name)].filter(([, d]) => filters.every(([f, v]) => d[f] === v)).slice(0, max).map(([id, d]) => ({ id, data: () => d, ref: self.ref(name, id) }))
        return { docs, empty: docs.length === 0 }
      },
    })
    let n = 0
    return { ...query([]), doc: (id?: string) => self.ref(name, id ?? `auto${++n}`) }
  }
  batch() {
    const ops: (() => Promise<void>)[] = []
    return {
      set: (r: { set: (d: Doc) => Promise<void> }, d: Doc) => { ops.push(() => r.set(d)) },
      update: (r: { update: (d: Doc) => Promise<void> }, d: Doc) => { ops.push(() => r.update(d)) },
      delete: (r: { delete: () => Promise<void> }) => { ops.push(() => r.delete()) },
      commit: async () => { for (const op of ops) await op() },
    }
  }
}
