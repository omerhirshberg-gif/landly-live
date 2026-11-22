// Dev-only: moves landly-dev's Raayonit Card to the 3-tier ladder (100 for 89, 150 for 132, 200 for 174). Refuses any project but landly-dev;
// production (landly-be752) is never touched: there the admin makes the same change by hand on Stock & Vouchers, or runs the catalogue sync.
//   1. each ladder value's shared stock: created when missing, its sale price corrected when it differs (and the ledger product's, when it has one)
//   2. every Raayonit offer's `variants` list rebuilt from the stocks, so the 200 value appears and the 150 value costs 132
// Codes are not added here: the dev payment sandbox tops an empty stock up with RAAYONIT-DEMO-{value}-XXXX codes on a test purchase.
// Bundle then run: npx esbuild scripts/set-raayonit-ladder-dev.mts --bundle --platform=node --format=esm --external:firebase-admin --external:sharp \
//   --alias:@=. --alias:server-only=./scripts/lib/emptyModule.mjs --outfile=.ladder-tmp.mjs && node .ladder-tmp.mjs [--dry]
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { initAdminForScript } from './lib/adminInit.mjs'
import { createSharedPool } from '../lib/inventory/poolAdmin'
import { DEFAULT_STOCKS } from '../lib/inventory/raayonitCatalogSync'
import { POOL_COLLECTION } from '../lib/inventory/types'
import { PRODUCTS_COLLECTION } from '../lib/inventory/ledger/types'

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const { projectId } = initAdminForScript(['--project', 'landly-dev', ...args.filter((a) => a !== '--dry')])
if (projectId !== 'landly-dev') { console.error(`Refusing to run against ${projectId}: this changes landly-dev only.`); process.exit(1) }
const db = getFirestore()
console.log(`project ${projectId}${dry ? ' (dry run)' : ''}`)

for (const stock of DEFAULT_STOCKS) {
  const snap = await db.collection(POOL_COLLECTION).where('kind', '==', 'shared').where('faceValueAgorot', '==', stock.faceValueAgorot).get()
  const live = snap.docs.find((d) => d.data().status !== 'archived')
  if (!live) {
    console.log(`stock ${stock.faceValueAgorot / 100}: missing -> create at ${stock.priceAgorot / 100}`)
    if (!dry) await createSharedPool(db, { title: `רעיונית - תו על ${stock.faceValueAgorot / 100} ₪`, faceValueAgorot: stock.faceValueAgorot, priceAgorot: stock.priceAgorot, warningThreshold: 10, unitCostAgorot: 0 })
    continue
  }
  if (live.data().priceAgorot !== stock.priceAgorot) {
    console.log(`stock ${stock.faceValueAgorot / 100}: price ${live.data().priceAgorot / 100} -> ${stock.priceAgorot / 100}`)
    if (!dry) {
      await live.ref.update({ priceAgorot: stock.priceAgorot, updatedAt: Timestamp.now() })
      const product = db.collection(PRODUCTS_COLLECTION).doc(live.id)
      if ((await product.get()).exists) await product.update({ salePriceAgorot: stock.priceAgorot, updatedAt: Timestamp.now() })
    }
  } else console.log(`stock ${stock.faceValueAgorot / 100}: already ${stock.priceAgorot / 100}`)
}

const pools = (await db.collection(POOL_COLLECTION).where('kind', '==', 'shared').get()).docs
  .filter((d) => d.data().status !== 'archived' && Number.isInteger(d.data().faceValueAgorot) && Number.isInteger(d.data().priceAgorot))
  .map((d) => ({ faceValueAgorot: d.data().faceValueAgorot as number, priceAgorot: d.data().priceAgorot as number, poolId: d.id }))
  .sort((a, b) => a.faceValueAgorot - b.faceValueAgorot)
console.log('variants:', JSON.stringify(pools.map((p) => `${p.faceValueAgorot / 100}/${p.priceAgorot / 100}`)))
const offers = (await db.collection('offers').where('fulfillmentType', '==', 'raayonit_pool').get()).docs.filter((d) => Array.isArray(d.data().variants) && d.data().variants.length > 0)
let changed = 0
for (let i = 0; i < offers.length; i += 400) {
  const batch = db.batch()
  for (const doc of offers.slice(i, i + 400)) { batch.update(doc.ref, { variants: pools }); changed++ }
  if (!dry) await batch.commit()
}
console.log(`${changed} Raayonit offers now carry ${pools.length} variants`)
