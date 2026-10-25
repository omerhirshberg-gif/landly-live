// API usage telemetry: one document per UTC month, apiUsageStats/{YYYY-MM},
// in the deployment's own Firebase project (DEV or PROD, checked by
// lib/firebase/envGuard.ts), so the two environments' counters never mix. The
// servers add to it with FieldValue.increment (lib/usage/recordUsage.ts) and
// /admin/system/costs reads it (app/api/admin/usage/route.ts); clients
// never touch it (firestore.rules). Only units are stored, never money:
// lib/usage/pricing.ts prices them when the dashboard reads, so a price
// change recalculates past months too. Shared by the server, the page and
// the tests, so nothing here may be server-only. The other environment's
// month arrives through lib/usage/usageSources.ts, as a UsageExport.

import { PRODUCTION_FIREBASE_PROJECT_ID, STAGING_FIREBASE_PROJECT_ID } from '@/lib/firebase/envGuard'

export const USAGE_COLLECTION = 'apiUsageStats'

/** The two projects the dashboard reports on; they share one Google Cloud billing account and one Meta account. */
export type UsageEnv = 'prod' | 'dev'

export const USAGE_PROJECTS: Record<UsageEnv, string> = { prod: PRODUCTION_FIREBASE_PROJECT_ID, dev: STAGING_FIREBASE_PROJECT_ID }

export function usageEnvOf(projectId: string | undefined): UsageEnv | null {
  if (projectId === PRODUCTION_FIREBASE_PROJECT_ID) return 'prod'
  if (projectId === STAGING_FIREBASE_PROJECT_ID) return 'dev'
  return null
}

export interface UsageCounters {
  google: {
    translation: { chars: number; detectChars: number; requests: number }
    places: { autocompleteRequests: number; detailsRequests: number; sessionsCompleted: number }
    geocoding: { requests: number }
  }
  whatsapp: {
    /** Member messages the webhook received. */
    inboundMessages: number
    /** Bot, team and idle-sweep replies Meta accepted (free inside the 24h window). */
    serviceSent: number
    /** OTP authentication templates Meta accepted (HTTP 200 with a wamid). */
    authSent: number
    /** Sends logged instead of sent (WhatsApp not live: `next dev`, Preview). */
    simulated: number
  }
}

export const USAGE_METRICS = [
  'google.translation.chars',
  'google.translation.detectChars',
  'google.translation.requests',
  'google.places.autocompleteRequests',
  'google.places.detailsRequests',
  'google.places.sessionsCompleted',
  'google.geocoding.requests',
  'whatsapp.inboundMessages',
  'whatsapp.serviceSent',
  'whatsapp.authSent',
  'whatsapp.simulated',
] as const

export type UsageMetric = (typeof USAGE_METRICS)[number]

/** The stored month: the counters, plus the same counters per UTC day ('01'..'31') for sparklines. */
export interface UsageMonthDoc {
  month: string
  projectId: string
  counters: UsageCounters
  daily: Record<string, UsageCounters>
}

/** What PROD's /api/usage/export answers: its counters only, never prices or the daily maps. */
export interface UsageExport {
  projectId: string
  month: string
  months: string[]
  counters: UsageCounters
}

const MONTH_KEY = /^\d{4}-(?:0[1-9]|1[0-2])$/

export function isMonthKey(value: unknown): value is string {
  return typeof value === 'string' && MONTH_KEY.test(value)
}

/** 'YYYY-MM' of `date` in UTC. */
export function monthKeyOf(date: Date): string {
  return date.toISOString().slice(0, 7)
}

/** 'DD' of `date` in UTC. */
export function dayKeyOf(date: Date): string {
  return date.toISOString().slice(8, 10)
}

export function emptyCounters(): UsageCounters {
  return {
    google: {
      translation: { chars: 0, detectChars: 0, requests: 0 },
      places: { autocompleteRequests: 0, detailsRequests: 0, sessionsCompleted: 0 },
      geocoding: { requests: 0 },
    },
    whatsapp: { inboundMessages: 0, serviceSent: 0, authSent: 0, simulated: 0 },
  }
}

function at(raw: unknown, path: string[]): unknown {
  let value = raw
  for (const key of path) {
    if (!value || typeof value !== 'object') return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return value
}

/** The counters in stored data (a month or one of its days); anything missing or malformed counts as 0. */
export function countersOf(raw: unknown): UsageCounters {
  const counters = emptyCounters()
  for (const metric of USAGE_METRICS) {
    const value = at(raw, metric.split('.'))
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) setCounter(counters, metric, value)
  }
  return counters
}

/** Unit-by-unit total of several environments' counters (one bill, so they're priced together). */
export function sumCounters(...all: UsageCounters[]): UsageCounters {
  const total = emptyCounters()
  for (const metric of USAGE_METRICS) {
    setCounter(total, metric, all.reduce((sum, counters) => sum + counterValue(counters, metric), 0))
  }
  return total
}

export function counterValue(counters: UsageCounters, metric: UsageMetric): number {
  const value = at(counters, metric.split('.'))
  return typeof value === 'number' ? value : 0
}

function setCounter(counters: UsageCounters, metric: UsageMetric, value: number) {
  const path = metric.split('.')
  let node = counters as unknown as Record<string, unknown>
  for (const key of path.slice(0, -1)) node = node[key] as Record<string, unknown>
  node[path.at(-1)!] = value
}
