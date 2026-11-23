// Runs the daily Raayonit "תו על" diff sync by hand: the same code the cron route and the admin button run.
//   --dry         read the live page and print the diff; writes nothing (the default is a live run)
//   --force       apply a change a safety guard would stop (mass archive / many additions)
//   --project X   Firebase project (else FIREBASE_ADMIN_PROJECT_ID / GOOGLE_CLOUD_PROJECT / gcloud)
//   --allow-prod  required to run LIVE against a production project; a dry run needs no flag
// A project is production unless it is landly-dev. Bundle then run:
//   npx esbuild scripts/raayonit-daily-sync.mts --bundle --platform=node --format=esm --external:firebase-admin --external:sharp --external:resend \
//     --alias:@=. --alias:server-only=./scripts/lib/emptyModule.mjs --alias:next/server=./scripts/lib/nextServerStub.mjs --outfile=$TMP/daily.mjs && node $TMP/daily.mjs --dry
import { getFirestore } from 'firebase-admin/firestore'
import { initAdminForScript } from './lib/adminInit.mjs'
import { runDailySync } from '../lib/inventory/raayonitDailySync'
import { cloudTranslator, isTranslationEnabled } from '../lib/translate/cloudTranslate'

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const { projectId } = initAdminForScript(args)
if (!dry && projectId !== 'landly-dev' && !args.includes('--allow-prod')) {
  console.error(`Refusing a live run against ${projectId}: only landly-dev is allowed without --allow-prod. Use --dry to preview.`)
  process.exit(1)
}
const translateBatch = isTranslationEnabled() ? async (texts: string[], lang: string) => cloudTranslator.translate(texts, lang, 'he') : undefined
const report = await runDailySync(getFirestore(), { dry, force: args.includes('--force') }, { origin: projectId === 'landly-dev' ? 'http://localhost:3000' : 'https://golandly.com', translateBatch })
console.log(JSON.stringify(report, null, 2))
if (report.drift) {
  const d = report.drift.counts
  console.log(`Branch drift: ${d.brandsDrifted} of ${d.brandsCompared} compared businesses differ (${d.added} added, ${d.missing} missing, ${d.changed} changed); ${d.partialClosures} partial closure(s), ${d.fullSuspensions} fully suspended.`)
  for (const b of report.drift.brands) console.log(`  ${b.nameHe} [${b.key}] card ${b.cardBranches} / live ${b.liveBranches}: +${b.added.length} -${b.missing.length} ~${b.changed.length}`)
  for (const p of report.drift.partialClosures) console.log(`  Partial closure: ${p.nameHe} [${p.key}] ${p.closed.length} closed, ${p.liveBranches} live`)
  if (report.drift.fullSuspensions.length) console.log(`  Fully suspended: ${report.drift.fullSuspensions.join(' | ')}`)
}
if (report.status === 'aborted_guard') console.log(`Guard: ${report.abortReason}${report.unresolved?.length ? `\nUnresolved NetworkNum keys (${report.unresolved.length}): ${report.unresolved.join(', ')}` : ''}`)
process.exit(report.status === 'ok' ? 0 : 2)
