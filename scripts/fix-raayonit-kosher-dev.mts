// DEV ONLY: brings the kosher flags of landly-dev's Raayonit cards in line with the catalogue (the bundled snapshot, after the listing's kosher flags
// were carried onto the network brands). Writes ONLY branches (the kosher flag of a branch that is kosher on Raayonit), kosherBranchCount and the
// " · כשר" suffix in participatingChains. Imports no translator (no Cloud Translation call), so titles, translations, images, prices and every other
// field stay as they are, and a branch is never turned OFF. Idempotent. Refuses any project but landly-dev; production is never touched.
//   --dry   print what would change and write nothing
// Bundle then run: npx esbuild scripts/fix-raayonit-kosher-dev.mts --bundle --platform=node --format=esm --packages=external --alias:@=. \
//   --alias:server-only=./scripts/lib/emptyModule.mjs --alias:next/server=./scripts/lib/nextServerStub.mjs --outfile=$TMP/fix-kosher.mjs && node $TMP/fix-kosher.mjs [--dry]
import { getFirestore } from 'firebase-admin/firestore'
import { initAdminForScript } from './lib/adminInit.mjs'
import { bundledCatalog } from '../lib/inventory/raayonitCatalogSync'
import { finalizeCatalog } from '../lib/inventory/raayonitSanitize'
import { planKosherFix } from '../lib/inventory/raayonitKosherFix'

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const { projectId } = initAdminForScript(['--project', 'landly-dev', ...args.filter((a) => a !== '--dry')])
if (projectId !== 'landly-dev') { console.error(`Refusing to run against ${projectId}: this changes landly-dev only.`); process.exit(1) }
const db = getFirestore()
const brands = new Map(finalizeCatalog(bundledCatalog()).map((b) => [b.key, b]))
const cards = (await db.collection('offers').where('fulfillmentType', '==', 'raayonit_pool').get()).docs
console.log(`project ${projectId}${dry ? ' (dry run)' : ''}: ${cards.length} Raayonit card(s)`)
const writes: { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown>; label: string; flagged: number }[] = []
for (const doc of cards) {
  const d = doc.data()
  const key = typeof d.sourceKey === 'string' ? d.sourceKey.replace(/^raayonit:/, '') : ''
  const brand = d.perkScope === 'multi_chain' || !/^[^:]+$/.test(key) ? undefined : brands.get(key)
  if (!brand) continue
  const fix = planKosherFix(d, brand)
  if (!fix) continue
  writes.push({ ref: doc.ref, data: { branches: fix.branches, kosherBranchCount: fix.kosherBranchCount, participatingChains: fix.participatingChains }, label: `${key} ${d.brandName}`, flagged: fix.flagged })
}
for (const w of writes) console.log(`  ${w.label}: +${w.flagged} kosher branch(es)`)
console.log(`${writes.length} card(s) to update (${writes.reduce((n, w) => n + w.flagged, 0)} branches)`)
if (dry || writes.length === 0) { console.log(dry ? 'Dry run only: nothing was written.' : 'Already up to date.'); process.exit(0) }
for (let i = 0; i < writes.length; i += 200) {
  const batch = db.batch()
  for (const w of writes.slice(i, i + 200)) batch.update(w.ref, w.data)
  await batch.commit()
}
console.log('Done.')
