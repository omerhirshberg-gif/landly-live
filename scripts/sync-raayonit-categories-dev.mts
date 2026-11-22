// Dev-only: re-files landly-dev's Raayonit brand offers under the category the brand table (lib/inventory/raayonitCatalog.ts) gives them,
// which now follows Raayonit's own sections (VoucherNum=253): the 14 chef restaurants move to "Chef Restaurants", Arbel to Beauty and
// Skincare, Leonardo to Pampering Bundles. Writes the `category` field only: no titles, images, branches, prices or translations are
// touched, so it costs nothing. Idempotent; refuses any project but landly-dev (production gets the same table through the daily sync).
// Bundle then run: npx esbuild scripts/sync-raayonit-categories-dev.mts --bundle --platform=node --format=esm --external:firebase-admin --external:sharp \
//   --alias:next/server=./scripts/lib/emptyModule.mjs --alias:@=. --alias:server-only=./scripts/lib/emptyModule.mjs --outfile=.cat-tmp.mjs && node .cat-tmp.mjs [--dry]
import { getFirestore } from 'firebase-admin/firestore'
import { initAdminForScript } from './lib/adminInit.mjs'
import { knownCategory } from '../lib/inventory/raayonitCatalog'

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const { projectId } = initAdminForScript(['--project', 'landly-dev', ...args.filter((a) => a !== '--dry')])
if (projectId !== 'landly-dev') { console.error(`Refusing to run against ${projectId}: this changes landly-dev only.`); process.exit(1) }
const db = getFirestore()
const snap = await db.collection('offers').where('fulfillmentType', '==', 'raayonit_pool').get()
let changed = 0
for (const doc of snap.docs) {
  const d = doc.data()
  if (d.perkScope === 'multi_chain') continue
  const name = String(d.brandName ?? d.businessName ?? '')
  const target = knownCategory(name, /^[\x20-\x7e]+$/.test(name) ? name : '')
  if (!target || target === d.category) continue
  console.log(`${name}: ${d.category} -> ${target}`)
  if (!dry) await doc.ref.update({ category: target })
  changed++
}
console.log(`${changed} offers ${dry ? 'would change' : 'updated'}`)
