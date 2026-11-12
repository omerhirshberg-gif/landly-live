// One-off: re-trims the business logos already stored, with the rule the admin
// upload now uses (lib/images/crop.ts logoContentBox: transparent and near-white
// margins trimmed, a 4% breathing inset kept, the logo's own shape preserved), so
// a logo uploaded with baked-in white bands (a "Matanski" with space above and
// below its mark) fills its card badge like every new upload.
//
// For each business whose logoUrl is one of our own uploads (logos/{uuid}.png|jpg
// in the project's bucket) it reads the file, finds the mark, and -- only when
// trimming would remove at least 6% of the picture -- stores the trimmed PNG under
// a fresh name (the files are cached immutably, so a changed logo needs a new URL)
// and points businesses/{id}.logoUrl and that business's offers' businessLogoUrl at
// it. A pasted link to another host is never touched (listed as "external"). The
// old file stays (rollback) unless --delete-old is passed. Idempotent: a trimmed
// logo trims to itself and is skipped.
//
// Dry run by default (reads only, prints what it would change) -- pass --apply to
// write. The project is chosen with --env=dev (landly-dev) or --env=prod
// (landly-be752); there is no default, and prod needs --apply AND --confirm-prod.
// Credentials: scripts/lib/adminInit.mjs (Application Default Credentials, or the
// FIREBASE_ADMIN_* key from the environment).
//
//   node scripts/retrimBusinessLogos.ts --env=dev
//   node scripts/retrimBusinessLogos.ts --env=dev --apply
//   node scripts/retrimBusinessLogos.ts --env=prod                      (dry run only)
//   node scripts/retrimBusinessLogos.ts --env=prod --apply --confirm-prod

import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { ADC_HINT, initAdminForScript } from './lib/adminInit.mjs'
// @ts-expect-error -- Node runs this file directly and needs the .ts extension; tsc's config does not allow it
import { LOGO_MAX_EDGE, logoContentBox } from '../lib/images/crop.ts'

const PROJECTS = { dev: 'landly-dev', prod: 'landly-be752' } as const
/** A logo is only rewritten when trimming removes at least this share of its picture. */
const MIN_SAVING = 0.06

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const deleteOld = args.includes('--delete-old')
const envName = (args.find((a) => a.startsWith('--env='))?.slice('--env='.length) ?? '') as keyof typeof PROJECTS
if (!(envName in PROJECTS)) {
  console.error('Pass --env=dev or --env=prod.')
  process.exit(1)
}
if (envName === 'prod' && apply && !args.includes('--confirm-prod')) {
  console.error('Refusing to write to PRODUCTION (landly-be752) without --confirm-prod.')
  process.exit(1)
}

const projectId = PROJECTS[envName]
const { app, usesAdc } = initAdminForScript([...args, '--project', projectId])
const db = getFirestore(app)
const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.startsWith(projectId) ? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET : `${projectId}.firebasestorage.app`
const bucket = getStorage(app).bucket(bucketName)
console.log(`Bucket ${bucketName}${apply ? '' : ' (dry run; pass --apply to write)'}`)

/** The logos/… object behind one of our own download URLs (lib/storage/bannerPath.ts logoPathFromUrl), else null. */
function ownLogoPath(url: string): string | null {
  const match = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/([^?#]+)/.exec(url.trim())
  if (!match || match[1] !== bucketName) return null
  try {
    const path = decodeURIComponent(match[2]!)
    return /^logos\/[\w-]+\.(jpg|png)$/.test(path) ? path : null
  } catch {
    return null
  }
}

const counts = { businesses: 0, trimmed: 0, tight: 0, external: 0, none: 0, failed: 0 }
try {
  const businesses = await db.collection('businesses').get()
  for (const doc of businesses.docs) {
    counts.businesses++
    const data = doc.data()
    const name = String(data.name ?? data.businessName ?? doc.id)
    const logoUrl = typeof data.logoUrl === 'string' ? data.logoUrl : ''
    if (!logoUrl) {
      counts.none++
      continue
    }
    const path = ownLogoPath(logoUrl)
    if (!path) {
      counts.external++
      console.log(`  external  ${name}: ${logoUrl.slice(0, 70)}`)
      continue
    }
    try {
      const [bytes] = await bucket.file(path).download()
      const { data: rgba, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      const box = logoContentBox(rgba, info.width, info.height)
      const saving = 1 - (box.width * box.height) / (info.width * info.height)
      const label = `${name}: ${info.width}x${info.height} -> ${box.width}x${box.height}`
      if (saving < MIN_SAVING) {
        counts.tight++
        console.log(`  tight     ${label} (${Math.round(saving * 100)}% margin)`)
        continue
      }
      counts.trimmed++
      console.log(`  ${apply ? 'trimmed  ' : 'would trim'} ${label} (${Math.round(saving * 100)}% margin removed)`)
      if (!apply) continue

      // The part of the box inside the picture is cut out; any part of the inset past its edge is transparent padding.
      const left = Math.max(0, box.x)
      const top = Math.max(0, box.y)
      const right = Math.min(info.width, box.x + box.width)
      const bottom = Math.min(info.height, box.y + box.height)
      let image = sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).extract({ left, top, width: right - left, height: bottom - top })
      image = image.extend({
        top: top - box.y,
        left: left - box.x,
        bottom: box.y + box.height - bottom,
        right: box.x + box.width - right,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      if (Math.max(box.width, box.height) > LOGO_MAX_EDGE) image = image.resize({ width: LOGO_MAX_EDGE, height: LOGO_MAX_EDGE, fit: 'inside' })
      const png = await image.png().toBuffer()

      const newPath = `logos/${randomUUID()}.png`
      const token = randomUUID()
      await bucket.file(newPath).save(png, {
        resumable: false,
        contentType: 'image/png',
        metadata: { cacheControl: 'public, max-age=31536000, immutable', metadata: { firebaseStorageDownloadTokens: token } },
      })
      const newUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(newPath)}?alt=media&token=${token}`

      // The business, then every offer that carries a copy of its logo.
      await doc.ref.update({ logoUrl: newUrl })
      const offers = await db.collection('offers').where('businessId', '==', doc.id).get()
      const batch = db.batch()
      let copies = 0
      for (const offer of offers.docs) {
        if (offer.get('businessLogoUrl') === logoUrl) {
          batch.update(offer.ref, { businessLogoUrl: newUrl })
          copies++
        }
      }
      if (copies) await batch.commit()
      console.log(`            stored ${newPath}; updated the business and ${copies} offer(s)`)
      if (deleteOld) await bucket.file(path).delete({ ignoreNotFound: true })
    } catch (error) {
      counts.failed++
      console.error(`  FAILED    ${name}:`, error instanceof Error ? error.message : error)
    }
  }
  console.log(`\n${counts.businesses} business(es): ${counts.trimmed} ${apply ? 'trimmed' : 'to trim'}, ${counts.tight} already tight, ${counts.external} external link(s) left alone, ${counts.none} without a logo, ${counts.failed} failed.`)
  if (!apply && counts.trimmed) console.log('Dry run: nothing was written. Pass --apply to write.')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  if (usesAdc) console.error(ADC_HINT)
  process.exit(1)
}
