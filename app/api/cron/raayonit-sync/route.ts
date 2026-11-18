import { NextResponse } from 'next/server'
import { verifyTokenMatches } from '@/lib/whatsapp/signature'
import { getAdminDb } from '@/lib/firebase/admin'
import { revalidateGuestHome } from '@/lib/admin/revalidateHome'
import { jerusalemClock, runDailySync } from '@/lib/inventory/raayonitDailySync'
import { isTranslationEnabled, cloudTranslator } from '@/lib/translate/cloudTranslate'

// Vercel Cron (vercel.json) checks Raayonit's "תו על" directory once a day and applies only the difference
// (lib/inventory/raayonitDailySync.ts). Vercel schedules in UTC, so it fires at 01:00 and 02:00 UTC and this route runs
// only when it is 04:00 in Asia/Jerusalem (winter UTC+2 -> the 02:00 firing, summer UTC+3 -> the 01:00 one); the other
// answers { skipped: 'wrong-hour' }. A Firestore lock (raayonit_sync_logs/{day}) makes a repeated trigger a no-op.
// Authorization: Bearer $CRON_SECRET, fail-closed without it, like /api/cron/monthly-costs-report.
// ?dry=1 reads and diffs but writes nothing, at any hour.

export const maxDuration = 300

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[raayonit-sync] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  }
  const header = request.headers.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
  if (!verifyTokenMatches(token, secret)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const url = new URL(request.url)
  const dry = url.searchParams.get('dry') === '1'
  const clock = jerusalemClock(new Date())
  if (!dry && clock.hour !== 4) return NextResponse.json({ skipped: 'wrong-hour', date: clock.date, hour: clock.hour }, { headers: { 'Cache-Control': 'no-store' } })

  try {
    const translateBatch = isTranslationEnabled() ? async (texts: string[], lang: string) => cloudTranslator.translate(texts, lang, 'he') : undefined
    const report = await runDailySync(getAdminDb(), { dry, guarded: true }, { origin: url.origin, translateBatch })
    if (!dry && report.status === 'ok' && (report.counts.added + report.counts.reactivated + report.counts.archived > 0)) revalidateGuestHome()
    return NextResponse.json({ ok: report.status === 'ok' || report.status === 'skipped', ...report }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[raayonit-sync] run failed', error)
    return NextResponse.json({ error: 'The sync could not run.' }, { status: 502 })
  }
}
