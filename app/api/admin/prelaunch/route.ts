import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { filterLeads, parseLeadFilters, prelaunchStats, type AdminLead } from '@/lib/admin/prelaunchStats'
import { getAdminDb, getAdminProjectId } from '@/lib/firebase/admin'
import { leadsCsv, withReferrals } from '@/lib/prelaunch/demand.mjs'
import { LEADS_COLLECTION } from '@/lib/prelaunch/leads.server'

// /admin/prelaunch: the /join sign-ups, read-only. GET gives the dashboard its
// rows and totals. GET ?format=csv&q=&lang=&persona= downloads what the filters
// show, with every field, as a broadcast tool or a spreadsheet wants it: the
// byte-order mark is what makes Excel read Hebrew names as UTF-8. Reads through
// getAdminDb, so Production sees PROD and local and Preview see DEV.
const NO_STORE = { 'Cache-Control': 'no-store' }

type StoredLead = AdminLead & { attribution?: { utm_source?: string | null; utm_campaign?: string | null } }

const toAdminLead = (lead: StoredLead & { createdAtMs: number }): AdminLead => ({
  id: lead.id,
  firstName: lead.firstName,
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
    return NextResponse.json({ leads: rows, stats: prelaunchStats(rows), projectId: getAdminProjectId(), generatedAt: new Date().toISOString() }, { headers: NO_STORE })
  } catch (error) {
    // The error alone: a lead's details never reach the log.
    console.error('Pre-launch leads failed', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Pre-launch leads are unavailable right now.' }, { status: 502, headers: NO_STORE })
  }
}
