// Dev-only, idempotent: puts every Raayonit card in landly-dev into its category from lib/inventory/raayonitCatalog.ts (the same table the sync uses),
// and writes "HOLMES PLACE" for "HoLMES PLACE" wherever a card spells it. Writes ONLY the `category` field and the strings that carry that casing; no
// translator is imported or called, so it costs nothing, and titles, descriptions, images, prices and branches are otherwise untouched.
// Refuses any project but landly-dev (never run it against production). `--dry` prints what would change and writes nothing.
// Bundle then run: npx esbuild scripts/recategorize-raayonit-dev.mts --bundle --platform=node --format=esm --packages=external \
//   --outfile=.recategorize-tmp.mjs && node .recategorize-tmp.mjs [--dry]   (or: npx tsx scripts/recategorize-raayonit-dev.mts [--dry])
import { getFirestore } from 'firebase-admin/firestore'
import { initAdminForScript } from './lib/adminInit.mjs'
import snapshot from '../lib/inventory/raayonitCatalog.snapshot.json'
import { applyCanonical } from '../lib/inventory/raayonitCanonicalCatalog'
import { finalizeCatalog } from '../lib/inventory/raayonitSanitize'
import type { RaayonitBrand } from '../lib/inventory/raayonitCatalog'

const dry = process.argv.includes('--dry')
const { projectId } = initAdminForScript(['--project', 'landly-dev'])
if (projectId !== 'landly-dev') { console.error(`Refusing to run against ${projectId}: this updates landly-dev only.`); process.exit(1) }
const db = getFirestore()

const OLD_CASING = 'HoLMES PLACE'
const NEW_CASING = 'HOLMES PLACE'
/** The value with the old casing replaced everywhere in its strings (keys untouched); the same reference when nothing changed. */
function recase(value: unknown): unknown {
  if (typeof value === 'string') return value.includes(OLD_CASING) ? value.split(OLD_CASING).join(NEW_CASING) : value
  if (Array.isArray(value)) {
    const next = value.map(recase)
    return next.some((v, i) => v !== value[i]) ? next : value
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    let changed = false
    const next: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      const r = recase(v)
      if (r !== v) changed = true
      next[k] = r
    }
    return changed ? next : value
  }
  return value
}

// The category each brand card must carry: the finalized bundled catalogue (names corrected, businesses merged, table applied).
const brands = finalizeCatalog(applyCanonical((snapshot as { brands: RaayonitBrand[] }).brands))
const expected = new Map(brands.map((b) => [`raayonit:${b.key}`, { category: b.category, name: b.nameHe }]))

const snap = await db.collection('offers').where('fulfillmentType', '==', 'raayonit_pool').get()
const moves: Record<string, string[]> = {}
const updates: { ref: FirebaseFirestore.DocumentReference; patch: Record<string, unknown> }[] = []
const notInCatalogue: string[] = []
let recased = 0
let unchanged = 0
for (const doc of snap.docs) {
  const data = doc.data()
  const sourceKey = String(data.sourceKey ?? '')
  const want = expected.get(sourceKey)
  if (!want) { if (sourceKey !== 'raayonit:general') notInCatalogue.push(`${doc.id} ${sourceKey} ${data.title ?? ''}`); continue }
  const patch: Record<string, unknown> = {}
  if (data.category !== want.category) {
    patch.category = want.category
    ;(moves[`${data.category} -> ${want.category}`] ??= []).push(want.name)
  }
  for (const [field, value] of Object.entries(data)) {
    if (field === 'category' || field === 'sourceUrl' || field === 'websiteUrl') continue
    const next = recase(value)
    if (next !== value) patch[field] = next
  }
  if (JSON.stringify(data).includes(OLD_CASING)) recased++
  if (Object.keys(patch).length === 0) { unchanged++; continue }
  updates.push({ ref: doc.ref, patch })
}

console.log(`${dry ? 'DRY RUN, nothing written. ' : ''}project ${projectId}: ${snap.size} Raayonit cards, ${expected.size} brands in the catalogue`)
for (const [move, names] of Object.entries(moves)) console.log(`${names.length}  ${move}  ::  ${names.join(' | ')}`)
console.log(`category changes: ${Object.values(moves).flat().length}, cards carrying "${OLD_CASING}": ${recased}, cards to write: ${updates.length}, already correct: ${unchanged}`)
if (notInCatalogue.length) console.log(`not in the catalogue (left untouched): ${notInCatalogue.length}\n  ${notInCatalogue.join('\n  ')}`)

if (!dry) {
  for (let i = 0; i < updates.length; i += 400) {
    const batch = db.batch()
    for (const u of updates.slice(i, i + 400)) batch.update(u.ref, u.patch)
    await batch.commit()
  }
  console.log(`wrote ${updates.length} cards`)
}
