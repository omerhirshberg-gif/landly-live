#!/usr/bin/env node
// Seeds the month's Resend email count to what Resend's own dashboard shows
// (Settings > Usage), for the emails sent before the server counted every send
// itself (resend.emailsSent in apiUsageStats/{YYYY-MM}). Run it ONCE per
// month: after the counting code is deployed, read the number on
// resend.com/settings/usage, then pass it here. It SETS the counter to that
// authoritative figure (it does not add), and later sends keep adding to it
// with the server's atomic increments, so nothing is counted twice.
//
// It marks the month (resend.baselineSeededAt), so a second run refuses unless
// --force: a rerun after more emails went out would otherwise reset the count
// to the older dashboard figure. Only the month total is seeded; the per-day
// sparkline data is left alone. Counters are per Firebase project: seed the
// project whose deployment sends the emails (landly-be752 for production).
//
//   node scripts/sync-resend-usage-baseline.mjs --project landly-be752 --month 2026-11 --count 60          (preview)
//   node scripts/sync-resend-usage-baseline.mjs --project landly-be752 --month 2026-11 --count 60 --yes     (Application Default Credentials)
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { flagValue, initAdminForScript } from './lib/adminInit.mjs'

const args = process.argv.slice(2)
const month = flagValue(args, '--month')
const rawCount = flagValue(args, '--count')
const count = Number(rawCount)
if (!flagValue(args, '--project') || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month ?? '') || !/^\d+$/.test(rawCount ?? '') || count > 1_000_000) {
  console.error('Usage: sync-resend-usage-baseline.mjs --project <projectId> --month YYYY-MM --count <emails shown by Resend> [--yes] [--force]')
  process.exit(1)
}

const { app, projectId } = initAdminForScript(args)
const ref = getFirestore(app).collection('apiUsageStats').doc(month)

const outcome = await getFirestore(app).runTransaction(async (tx) => {
  const data = (await tx.get(ref)).data()
  if (data?.projectId && data.projectId !== projectId) return { status: 'otherProject', named: data.projectId }
  const current = Number(data?.resend?.emailsSent) || 0
  const seededAt = data?.resend?.baselineSeededAt?.toDate?.()
  if (seededAt && !args.includes('--force')) return { status: 'alreadySeeded', current, seededAt }
  if (!args.includes('--yes')) return { status: 'preview', current }
  tx.set(
    ref,
    { month, projectId, updatedAt: FieldValue.serverTimestamp(), resend: { emailsSent: count, baselineSeededAt: FieldValue.serverTimestamp(), baselineCount: count } },
    { merge: true }
  )
  return { status: 'seeded', current }
})

if (outcome.status === 'otherProject') {
  console.error(`apiUsageStats/${month} names project ${outcome.named}, not ${projectId}. Nothing written.`)
  process.exit(1)
}
if (outcome.status === 'alreadySeeded') {
  console.error(`apiUsageStats/${month} was already seeded on ${outcome.seededAt.toISOString()} (counter now ${outcome.current}). Nothing written. Pass --force only if you mean to reset it to ${count}.`)
  process.exit(1)
}
if (outcome.status === 'preview') {
  console.log(`Preview: ${projectId} ${month} resend.emailsSent is ${outcome.current}; it would be set to ${count}. Add --yes to write it.`)
  process.exit(0)
}
console.log(`Set ${projectId} ${month} resend.emailsSent: ${outcome.current} -> ${count}. Later sends add to it.`)
