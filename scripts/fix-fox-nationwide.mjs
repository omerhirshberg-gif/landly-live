// One-off fix: FOX's "Children's shirt for 20 NIS" offer was created before chain
// support, so it shows a single branch address. This marks that one offer
// `isNationwide: true` ("Valid at all stores", no address or navigation).
//
// Safety:
//   - refuses landly-be752 (production);
//   - dry run by default: prints the matched offer(s) and writes nothing;
//   - aborts unless exactly ONE offer matches (pass --offer-id <id> to pin it);
//   - idempotent: no write when the offer is already nationwide;
//   - only `isNationwide` is written. Issued vouchers are never touched.
//
//   node scripts/fix-fox-nationwide.mjs --project landly-dev
//   node scripts/fix-fox-nationwide.mjs --project landly-dev --apply

import { getFirestore } from 'firebase-admin/firestore'
import { ADC_HINT, flagValue, initAdminForScript } from './lib/adminInit.mjs'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const offerIdFlag = flagValue(args, '--offer-id')

const { app, projectId, usesAdc } = initAdminForScript(args)
if (projectId === 'landly-be752') {
  console.error('Refusing to run against production (landly-be752).')
  process.exit(1)
}
const db = getFirestore(app)

const BUSINESS_RE = /fox|פוקס/i
const TITLE_RE = /children'?s shirt for 20 nis|חולצת ילדים ב-?\s?20/i

let docs
try {
  if (offerIdFlag) {
    const one = await db.collection('offers').doc(offerIdFlag).get()
    docs = one.exists ? [one] : []
  } else {
    docs = (await db.collection('offers').get()).docs
  }
} catch (err) {
  console.error(`Could not read offers in ${projectId}: ${err?.message ?? err}`)
  if (usesAdc) console.error(ADC_HINT)
  process.exit(1)
}

const titlesOf = (d) => [d.get('title'), ...Object.values(d.get('translations') ?? {}).map((t) => t?.title)].filter((x) => typeof x === 'string')
const matches = offerIdFlag ? docs : docs.filter((d) => BUSINESS_RE.test(String(d.get('businessName') ?? '')) && titlesOf(d).some((t) => TITLE_RE.test(t)))

console.log(`Project: ${projectId}${apply ? '' : ' (dry run; pass --apply to write)'}`)
for (const d of matches) {
  console.log(JSON.stringify({ id: d.id, businessId: d.get('businessId'), businessName: d.get('businessName'), title: d.get('title'), location: d.get('location'), isNationwide: d.get('isNationwide') ?? false, status: d.get('status') ?? null }, null, 2))
}
if (matches.length !== 1) {
  console.error(`Expected exactly 1 matching offer, found ${matches.length}. Nothing changed${matches.length ? '; pass --offer-id <id> to choose one' : ''}.`)
  process.exit(1)
}

const [offer] = matches
if (offer.get('isNationwide') === true) {
  console.log('Already nationwide. Nothing to do.')
  process.exit(0)
}
if (!apply) {
  console.log('Would set isNationwide: true on this offer.')
  process.exit(0)
}
await offer.ref.update({ isNationwide: true })
console.log('Set isNationwide: true.')
