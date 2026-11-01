import { PERSONAS, PRELAUNCH_LANGS, type Persona, type PrelaunchLang } from '@/lib/prelaunch/copy'

// The /join sign-ups as the admin sees them: pure, so the dashboard's totals,
// its filters and the filtered CSV are one set of rules, tested on their own.

export type LeadSyncStatus = 'synced' | 'pending' | 'failed'

/** A lead's mailing-list state. Leads from before the sync have no record, so they're pending. */
export function leadSyncStatus(sync: { synced?: unknown; error?: unknown } | null | undefined): LeadSyncStatus {
  if (sync?.synced === true) return 'synced'
  return sync?.error ? 'failed' : 'pending'
}

export interface AdminLead {
  id: string
  firstName: string
  phone: string
  email: string
  lang: PrelaunchLang
  persona: Persona | null
  createdAt: string | null
  referredBy: string | null
  validReferrals: number
  foundingMember: boolean
  utmSource: string | null
  utmCampaign: string | null
  syncStatus: LeadSyncStatus
  /** The short code from lib/marketing/ravMesser.server, when the sync failed. */
  syncError: string | null
}

export interface LeadFilters {
  query: string
  lang: PrelaunchLang | null
  /** 'none' finds the leads who skipped the question. */
  persona: Persona | 'none' | null
}

export const TOP_REFERRERS = 5

export interface PrelaunchStats {
  total: number
  foundingMembers: number
  byLang: Record<PrelaunchLang, number>
  byPersona: Record<Persona | 'none', number>
  topReferrers: { id: string; firstName: string; count: number }[]
}

export function prelaunchStats(leads: readonly AdminLead[]): PrelaunchStats {
  const byLang = Object.fromEntries(PRELAUNCH_LANGS.map((lang) => [lang, 0])) as Record<PrelaunchLang, number>
  const byPersona = Object.fromEntries([...PERSONAS, 'none'].map((key) => [key, 0])) as Record<Persona | 'none', number>
  for (const lead of leads) {
    byLang[lead.lang] += 1
    byPersona[lead.persona ?? 'none'] += 1
  }
  return {
    total: leads.length,
    foundingMembers: leads.filter((lead) => lead.foundingMember).length,
    byLang,
    byPersona,
    topReferrers: leads
      .filter((lead) => lead.validReferrals > 0)
      .sort((a, b) => b.validReferrals - a.validReferrals)
      .slice(0, TOP_REFERRERS)
      .map((lead) => ({ id: lead.id, firstName: lead.firstName, count: lead.validReferrals })),
  }
}

// Spaces and dashes don't stop "050 123" finding +972501234..., whose stored
// form has no leading 0.
const digits = (text: string) => text.replace(/\D/g, '').replace(/^0+/, '')

export function filterLeads<T extends AdminLead>(leads: readonly T[], { query, lang, persona }: LeadFilters): T[] {
  const needle = query.trim().toLowerCase()
  const needleDigits = digits(needle)
  return leads.filter((lead) => {
    if (lang && lead.lang !== lang) return false
    if (persona && (lead.persona ?? 'none') !== persona) return false
    if (!needle) return true
    return (
      lead.firstName.toLowerCase().includes(needle) ||
      lead.email.includes(needle) ||
      (needleDigits.length > 0 && lead.phone.includes(needleDigits))
    )
  })
}

/** The filters a URL asks for; anything unknown is no filter. */
export function parseLeadFilters(params: URLSearchParams): LeadFilters {
  const lang = params.get('lang')
  const persona = params.get('persona')
  return {
    query: params.get('q') ?? '',
    lang: (PRELAUNCH_LANGS as readonly (string | null)[]).includes(lang) ? (lang as PrelaunchLang) : null,
    persona: persona === 'none' || (PERSONAS as readonly (string | null)[]).includes(persona) ? (persona as Persona | 'none') : null,
  }
}
