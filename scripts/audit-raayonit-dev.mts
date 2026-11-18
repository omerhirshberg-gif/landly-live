// Dev-only, READ-ONLY: what the Raayonit cards in landly-dev look like (legacy 150 NIS rows, retired and orphan cards, drafts, the images they point at).
// Refuses any project but landly-dev. Bundle then run: npx esbuild scripts/audit-raayonit-dev.mts --bundle --platform=node --format=esm --packages=external --alias:@=. --alias:server-only=./scripts/lib/emptyModule.mjs --outfile=.audit-tmp.mjs && node .audit-tmp.mjs
import { getFirestore } from 'firebase-admin/firestore'
import { initAdminForScript } from './lib/adminInit.mjs'
import { brandImageFile } from '../landly-mobile/src/lib/imageSource'
import { readdirSync } from 'node:fs'

const { projectId } = initAdminForScript(['--project', 'landly-dev'])
if (projectId !== 'landly-dev') { console.error(`Refusing to run against ${projectId}.`); process.exit(1) }
const db = getFirestore()
const snap = await db.collection('offers').where('fulfillmentType', '==', 'raayonit_pool').get()
const bundled = new Set(readdirSync('landly-mobile/assets/raayonit-brands'))
const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { id: string })[]
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const retired = rows.filter((r) => str(r.sourceKey).startsWith('retired:'))
const legacy = rows.filter((r) => /^raayonit:[^:]+:.+/.test(str(r.sourceKey)) || /^תו על \d+ ₪/.test(str(r.title)))
const orphans = rows.filter((r) => /לא מכבד תווים|סגור לרגל שיפוצים/.test(`${str(r.title)} ${str(r.brandName)}`))
const unified = rows.filter((r) => /^raayonit:[^:]+$/.test(str(r.sourceKey)))
const missing: string[] = []
for (const r of rows) for (const u of [str(r.imageUrl), str(r.businessLogoUrl)]) { const f = brandImageFile(u); if (f && !bundled.has(f)) missing.push(`${r.id}:${f}`) }
const sample = (a: typeof rows) => a.slice(0, 6).map((r) => `${r.id} | ${str(r.sourceKey)} | ${str(r.title)} | published=${r.published}`)
console.log(JSON.stringify({ project: projectId, raayonitCards: rows.length, unified: unified.length, unifiedPublished: unified.filter((r) => r.published === true).length, unifiedDraft: unified.filter((r) => r.published !== true).length, retired: retired.length, legacyKeyOrTitle: legacy.length, orphans: orphans.length, referencesToUnbundledImages: missing.length }, null, 1))
console.log('legacy sample', sample(legacy)); console.log('retired sample', sample(retired)); console.log('orphan sample', sample(orphans)); console.log('unbundled', missing.slice(0, 10))
