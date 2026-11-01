import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { filterLeads, leadSyncStatus, parseLeadFilters, prelaunchStats, type AdminLead } from '@/lib/admin/prelaunchStats'
import { getAdminDb, getAdminProjectId } from '@/lib/firebase/admin'
import { ravMesserListId, syncLeadToRavMesser } from '@/lib/marketing/ravMesser.server'
import { leadsCsv, withReferrals } from '@/lib/prelaunch/demand.mjs'
import { LEADS_COLLECTION } from '@/lib/prelaunch/leads.server'
import { REFERRAL_CODE_RE } from '@/lib/prelaunch/validation'

// /admin/prelaunch: the /join sign-ups. POST retries one lead's mailing-list
// sync, the only thing here that writes. GET gives the dashboard its
// rows and totals. GET ?format=csv&q=&lang=&persona= downloads what the filters
// show, with every field, as a broadcast tool or a spreadsheet wants it: the
// byte-order mark is what makes Excel read Hebrew names as UTF-8. Reads through
// getAdminDb, so Production sees PROD and local and Preview see DEV.
const NO_STORE = { 'Cache-Control': 'no-store' }

type StoredLead = AdminLead & {
  attribution?: { utm_source?: string | null; utm_campaign?: string | null }
  ravMesserSync?: { synced?: unknown; error?: string | null } | null
}

const toAdminLead = (lead: StoredLead & { createdAtMs: number }): AdminLead => ({
  id: lead.id,
  firstName: lead.firstName,
  lastName: lead.lastName ?? null,
  phone: lead.phone,
  email: lead.email,
  lang: lead.lang,
  persona: lead.persona ?? null,
  createdAt: lead.createdAtMs ? new Date(lead.createdAtMs).toISOString() : null,
  referredBy: lead.referredBy ?? null,
  validReferrals: lead.validReferrals,
  foundingMember: lead.foundingMember,
  utmSource: lead.attribution?.utm_source ?? null,
  utmCampaign: lead.attribution?.utm_campaign ?? null,
  syncStatus: leadSyncStatus(lead.ravMesserSync),
  syncError: lead.ravMesserSync?.error ?? null,
})

export async function GET(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError

  try {
    const snapshot = await getAdminDb().collection(LEADS_COLLECTION).get()
    const leads = withReferrals(snapshot.docs.map((doc) => {
      const lead = doc.data()
      return { ...lead, id: doc.id, createdAtMs: lead.createdAt?.toMillis?.() ?? 0 }
    })) as (StoredLead & { createdAtMs: number })[]
    const params = new URL(request.url).searchParams

    if (params.get('format') === 'csv') {
      const date = new Date().toISOString().slice(0, 10)
      return new Response(`﻿${leadsCsv(filterLeads(leads, parseLeadFilters(params)))}`, {
        headers: {
          ...NO_STORE,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="landly-prelaunch-leads-${date}.csv"`,
        },
      })
    }

    const rows = leads.map(toAdminLead).reverse()
    return NextResponse.json({ leads: rows, stats: prelaunchStats(rows), projectId: getAdminProjectId(), listId: ravMesserListId(), generatedAt: new Date().toISOString() }, { headers: NO_STORE })
  } catch (error) {
    // The error alone: a lead's details never reach the log.
    console.error('Pre-launch leads failed', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Pre-launch leads are unavailable right now.' }, { status: 502, headers: NO_STORE })
  }
}

export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError

  const body = await request.json().catch(() => null) as { leadId?: unknown } | null
  const leadId = body?.leadId
  if (typeof leadId !== 'string' || !REFERRAL_CODE_RE.test(leadId)) {
    return NextResponse.json({ error: 'Invalid lead.' }, { status: 400, headers: NO_STORE })
  }

  const result = await syncLeadToRavMesser(getAdminDb(), leadId)
  if (result === 'missing') return NextResponse.json({ error: 'Lead not found.' }, { status: 404, headers: NO_STORE })
  if (result === 'skipped') return NextResponse.json({ error: 'The mailing list is not configured.' }, { status: 503, headers: NO_STORE })
  if (result === 'failed') return NextResponse.json({ error: 'The sync failed.' }, { status: 502, headers: NO_STORE })
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
