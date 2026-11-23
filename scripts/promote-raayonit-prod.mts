// Promotes Raayonit's catalogue (the bundled snapshot, the same one landly-dev is seeded from) to PRODUCTION (landly-be752).
// DRY BY DEFAULT: with no flags it only READS (production, plus landly-dev for the translations and the parity diff) and prints a report.
//
// What a live run does, and does not:
//   - creates the three EMPTY shared stocks (100/150/200) when missing: no voucher codes, no test codes, nothing encrypted;
//   - creates every brand card and the multi-chain card as a DRAFT (published:false); an existing card keeps its published flag, counters and date;
//   - never purges, never deletes, never publishes; refuses to retire cards that are not in the catalogue unless --allow-retire;
//   - sets system_config/feature_flags.raayonitDisplay=false BEFORE writing any card (the default is ON when the flag is unset), and refuses if it is already true;
//   - reuses landly-dev's translated fine print; no Cloud Translation call is made (LANDLY_TRANSLATION_ENABLED is not needed).
// Live needs: --project landly-be752 --allow-prod --confirm landly-be752, and Application Default Credentials with access to both projects.
//   --allow-untranslated   keep a fine-print line in Hebrew when DEV has no translation of it
//   --allow-retire         let the sync retire/merge PROD Raayonit cards that are not in the catalogue
// Bundle then run (from the repo root; the bundle file goes outside the repo):
//   npx esbuild scripts/promote-raayonit-prod.mts --bundle --platform=node --format=esm --packages=external --alias:@=. \
//     --alias:server-only=./scripts/lib/emptyModule.mjs --alias:next/server=./scripts/lib/nextServerStub.mjs --outfile=$TMP/promote.mjs && node $TMP/promote.mjs --project landly-be752
import { existsSync } from 'node:fs'
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { flagValue, initAdminForScript } from './lib/adminInit.mjs'
import { bundledCatalog, protectBrandWords, syncRaayonitCatalog } from '../lib/inventory/raayonitCatalogSync'
import { finalizeCatalog } from '../lib/inventory/raayonitSanitize'
import { officialBrandName } from '../lib/inventory/raayonitBrandNames'
import { planRaayonitMigration } from '../lib/inventory/raayonitMigration'
import { livePromotionBlockers, missingTranslations, translationCacheFromOffers, brandKeysOf, TRANSLATED_LANGS } from '../lib/inventory/raayonitPromote'

const PROD_PROJECT = 'landly-be752'
const DEV_PROJECT = 'landly-dev'
const PROD_ORIGIN = 'https://golandly.com'
const args = process.argv.slice(2)
const live = args.includes('--allow-prod') || args.includes('--confirm')
const { projectId } = initAdminForScript(args)
if (projectId !== PROD_PROJECT) { console.error(`This script promotes to ${PROD_PROJECT} only (got ${projectId}). Pass --project ${PROD_PROJECT}.`); process.exit(1) }
const prod = getFirestore()
const dev = getFirestore(initializeApp({ projectId: DEV_PROJECT, credential: applicationDefault() }, 'dev-source'))

const brands = finalizeCatalog(bundledCatalog()).filter((b) => b.nameHe)
const unnamed = brands.filter((b) => officialBrandName(b.nameHe, 'en') === null).map((b) => b.nameHe)

// 1. What production holds today.
const prodCards = (await prod.collection('offers').where('fulfillmentType', '==', 'raayonit_pool').get()).docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { id: string })[]
const prodKeys = prodCards.map((c) => String(c.sourceKey ?? ''))
const prodPools = (await prod.collection('couponPools').where('kind', '==', 'shared').get()).docs.map((d) => d.data())
const flagDoc = (await prod.doc('system_config/feature_flags').get()).data()
const catalogKeys = brands.map((b) => b.key)
const prodByKey = new Set(prodKeys)
const unexpected = prodKeys.filter((k) => k.startsWith('raayonit:') && !['raayonit:general', ...catalogKeys.map((x) => `raayonit:${x}`)].includes(k))
const migration = planRaayonitMigration(prodCards.map((c) => ({ id: c.id, sourceKey: String(c.sourceKey ?? ''), faceValueAgorot: Math.round((Number(c.originalPrice) || 0) * 100) })).filter((c) => c.sourceKey.startsWith('raayonit:')))

// 2. DEV: the translations to reuse, and the parity diff (every live DEV card must be in the catalogue, and the other way round).
const devCards = (await dev.collection('offers').where('fulfillmentType', '==', 'raayonit_pool').get()).docs.map((d) => d.data())
const cache = translationCacheFromOffers(devCards, protectBrandWords)
const missing = missingTranslations(brands.flatMap((b) => b.restrictions), cache, protectBrandWords)
const devLive = devCards.filter((c) => c.published === true && typeof c.sourceKey === 'string' && /^raayonit:[^:]+$/.test(c.sourceKey))
const devKeys = new Set(brandKeysOf(devLive.map((c) => c.sourceKey)))
const inDevNotCatalog = [...devKeys].filter((k) => !catalogKeys.includes(k))
const inCatalogNotDev = catalogKeys.filter((k) => !devKeys.has(k))

// 3. Quality of what would be written.
const imgDir = 'public/images/raayonit-brands'
const noImage = brands.filter((b) => b.logoFile && !existsSync(`${imgDir}/${b.logoFile}`)).map((b) => b.nameHe)
const noCategory = brands.filter((b) => !b.category).map((b) => b.nameHe)
const noPhone = brands.filter((b) => b.branches.length > 0 && b.branches.every((br) => !String(br.phone ?? '').trim())).length
const looksFake = devCards.length && prodCards.some((c) => /DEV-|RAAYONIT-DEMO-/.test(JSON.stringify(c)))

console.log(JSON.stringify({
  mode: live ? 'LIVE-REQUESTED' : 'DRY (read-only)',
  production: { cards: prodCards.length, published: prodCards.filter((c) => c.published === true).length, sharedStocks: prodPools.map((p) => p.faceValueAgorot), raayonitDisplayFlag: flagDoc?.raayonitDisplay ?? 'unset (defaults to ON)' },
  catalogue: { brands: brands.length, branches: brands.reduce((n, b) => n + b.branches.length, 0), toCreate: brands.filter((b) => !prodByKey.has(`raayonit:${b.key}`)).length + (prodByKey.has('raayonit:general') ? 0 : 1), toUpdate: brands.filter((b) => prodByKey.has(`raayonit:${b.key}`)).length, newCardsAreDrafts: true },
  retireOrMerge: { unexpectedCards: unexpected, migrationRetire: migration.retire.length, migrationRekey: migration.rekey.length },
  translations: { reusedFromDev: Object.keys(cache).length, linesMissingFromDev: missing.length, sampleMissing: missing.slice(0, 5) },
  parityWithDev: { devPublishedBrandCards: devKeys.size, inDevNotInCatalogue: inDevNotCatalog, inCatalogueNotInDev: inCatalogNotDev },
  quality: { unnamedBrands: unnamed, missingImageFiles: noImage, noCategory, brandsWithNoPhoneAnywhere: noPhone, testCodesInProd: !!looksFake },
}, null, 1))
if (unnamed.length) { console.error('Brands missing from raayonitBrandNames.ts:', unnamed.join(' | ')); process.exit(2) }
if (!live) { console.log('Dry run only: nothing was written.'); process.exit(0) }

const blockers = livePromotionBlockers({
  project: projectId, expectedProject: PROD_PROJECT, allowProd: args.includes('--allow-prod'), confirm: flagValue(args, '--confirm'),
  untranslated: missing.length, allowUntranslated: args.includes('--allow-untranslated'),
  unexpected: unexpected.length + migration.retire.length + migration.rekey.length, allowRetire: args.includes('--allow-retire'), displayFlag: flagDoc?.raayonitDisplay,
})
if (noImage.length || noCategory.length || looksFake) blockers.push('The quality section above lists a defect; fix it first.')
if (blockers.length) { console.error('Live run refused:\n - ' + blockers.join('\n - ')); process.exit(3) }

// Display OFF first, so nothing Raayonit-branded can show the moment a card exists.
if (flagDoc?.raayonitDisplay !== false) await prod.doc('system_config/feature_flags').set({ raayonitDisplay: false, raayonitDisplaySetAt: Timestamp.now(), raayonitDisplaySetBy: 'promote-raayonit-prod' }, { merge: true })
console.log('raayonitDisplay=false')

const later: (() => Promise<void>)[] = []
const translateBatch = async (texts: string[], lang: (typeof TRANSLATED_LANGS)[number]) => texts.map((t) => cache[`${lang}|${t}`] ?? '')
const result = await syncRaayonitCatalog(prod, { brands, origin: PROD_ORIGIN, publish: false, purgeRetired: false, translateBatch, after: (task) => { later.push(task) } })
console.log(JSON.stringify(result))
for (const task of later) await task()
console.log('Done. Cards are drafts; load real codes and publish from the admin, then turn the display flag on when ready.')
