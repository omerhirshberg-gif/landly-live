// Dev-only: syncs Raayonit's bundled catalogue (lib/inventory/raayonitCatalog.snapshot.json) into the DEV Firestore as published,
// one-card-per-brand offers with 100/150 variants, merging any older per-stock cards. Refuses any project but landly-dev.
// Bundle then run: npx esbuild scripts/seed-raayonit-dev.mts --bundle --platform=node --format=esm --external:firebase-admin --external:sharp \
//   --alias:@=. --alias:server-only=./scripts/lib/emptyModule.mjs --outfile=.seed-tmp.mjs && node .seed-tmp.mjs [--dry]
import { getFirestore } from 'firebase-admin/firestore'
import { initAdminForScript } from './lib/adminInit.mjs'
import { addPoolCodes } from '../lib/inventory/poolAdmin'
import { finalizeCatalog } from '../lib/inventory/raayonitSanitize'
import { cloudTranslator } from '../lib/translate/cloudTranslate'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { bundledCatalog, syncRaayonitCatalog } from '../lib/inventory/raayonitCatalogSync'

const args = process.argv.slice(2)
const { projectId } = initAdminForScript(['--project', 'landly-dev', ...args.filter((a) => a !== '--dry')])
if (projectId !== 'landly-dev') { console.error(`Refusing to run against ${projectId}: this seeds landly-dev only.`); process.exit(1) }
const db = getFirestore()
const brands = finalizeCatalog(bundledCatalog())
console.log(`project ${projectId}: ${brands.length} brands, ${brands.reduce((n, b) => n + b.branches.length, 0)} branches`)
const cats: Record<string, number> = {}
for (const b of brands) cats[b.category] = (cats[b.category] ?? 0) + 1
console.log(JSON.stringify(cats))
if (args.includes('--dry')) process.exit(0)
const later: (() => Promise<void>)[] = []
// Translations are cached on disk (RAAYONIT_I18N_CACHE) so a re-run never pays Cloud Translation for the same text twice.
const cachePath = process.env.RAAYONIT_I18N_CACHE
const cache: Record<string, string> = cachePath && existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {}
const translateBatch = args.includes('--no-translate') ? undefined : async (texts: string[], lang: string) => {
  const need = texts.filter((t) => !cache[`${lang}|${t}`])
  if (need.length) {
    const done = await cloudTranslator.translate(need, lang, 'he')
    need.forEach((t, i) => { cache[`${lang}|${t}`] = done[i] ?? '' })
    if (cachePath) writeFileSync(cachePath, JSON.stringify(cache))
  }
  return texts.map((t) => cache[`${lang}|${t}`] ?? '')
}
const result = await syncRaayonitCatalog(db, { brands, origin: 'http://localhost:3000', publish: true, purgeRetired: true, translateBatch, after: (task) => { later.push(task) } })
console.log(JSON.stringify(result))
if (!args.includes('--no-translate')) { for (const task of later) await task(); console.log('translations done') }

// Dev stock: the public catalogue lists only offers with voucher codes left, so top each shared pool up with clearly fake codes.
if (!args.includes('--no-stock')) {
  const pools = (await db.collection('couponPools').where('kind', '==', 'shared').get()).docs
  for (const p of pools) {
    const remaining = Number(p.data().remainingCount) || 0
    if (remaining >= 25) continue
    const face = Number(p.data().faceValueAgorot) / 100
    const stamp = Date.now().toString(36)
    const res = await addPoolCodes(db, p.id, Array.from({ length: 25 }, (_, i) => `DEV-${face}-${stamp}-${i + 1}`))
    console.log(`pool ${face}: added`, JSON.stringify(res))
  }
}
