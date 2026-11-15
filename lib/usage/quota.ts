import { COUNTERS_SINCE, DEFAULT_QUOTA, isMonthKey } from './usageTypes'

// The 019 package quota, pure maths shared by the server (the report) and
// the browser (an optimistic update after a top-up). Lifetime sent is the sum
// of every month's counters from COUNTERS_SINCE on; the quota is what was
// bought, so it never resets. Storage and the top-up transaction are in
// quota.server.ts.

export const QUOTA_CHANNELS = ['sms', 'whatsapp'] as const
export type QuotaChannel = (typeof QUOTA_CHANNELS)[number]

export const isQuotaChannel = (value: unknown): value is QuotaChannel => value === 'sms' || value === 'whatsapp'

/** The quota document's field and the monthly counter for each channel. */
export const QUOTA_FIELD = { sms: 'smsQuota', whatsapp: 'whatsappQuota' } as const
export const SENT_PATH = { sms: ['gateway019', 'smsOtpSent'], whatsapp: ['gateway019', 'whatsappOtpSent'] } as const

/** Blue/emerald below 80% used, amber from 80%, red from 95% or with nothing left. */
export type QuotaStatus = 'ok' | 'warn' | 'critical'
export const QUOTA_THRESHOLDS = { warn: 80, critical: 95 } as const // percent used

export interface QuotaChannelState {
  /** Lifetime messages 019 accepted. */
  sent: number
  /** Lifetime messages bought. */
  quota: number
  /** quota - sent, never below 0. */
  remaining: number
  /** sent beyond the quota. */
  over: number
  /** sent / quota in percent, uncapped. */
  pct: number
  status: QuotaStatus
}

export type QuotaReport = Record<QuotaChannel, QuotaChannelState>

/** A stored quota, or the default when missing or malformed. */
export function quotaOf(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : DEFAULT_QUOTA
}

export function quotaStatus(sent: number, quota: number): QuotaStatus {
  // Whole-number comparisons: no float rounding at exactly 80% or 95%.
  if (sent >= quota || sent * 100 >= quota * QUOTA_THRESHOLDS.critical) return 'critical'
  return sent * 100 >= quota * QUOTA_THRESHOLDS.warn ? 'warn' : 'ok'
}

export function quotaState(sent: number, quota: number): QuotaChannelState {
  return {
    sent,
    quota,
    remaining: Math.max(0, quota - sent),
    over: Math.max(0, sent - quota),
    pct: (sent * 100) / quota,
    status: quotaStatus(sent, quota),
  }
}

export interface QuotaInput {
  sent?: Partial<Record<QuotaChannel, number>>
  quota?: Partial<Record<QuotaChannel, unknown>>
}

export function buildQuota({ sent = {}, quota = {} }: QuotaInput = {}): QuotaReport {
  const state = (channel: QuotaChannel) => quotaState(Math.max(0, sent[channel] ?? 0), quotaOf(quota[channel]))
  return { sms: state('sms'), whatsapp: state('whatsapp') }
}

function numberAt(raw: unknown, path: readonly string[]): number {
  let value = raw
  for (const key of path) {
    if (!value || typeof value !== 'object') return 0
    value = (value as Record<string, unknown>)[key]
  }
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

/** Lifetime sent per channel: every month document from COUNTERS_SINCE on; anything else (the quota document, notes) is skipped. */
export function sumLifetime(docs: { id: string; data: unknown }[]): Record<QuotaChannel, number> {
  const total = { sms: 0, whatsapp: 0 }
  for (const doc of docs) {
    if (!isMonthKey(doc.id) || doc.id < COUNTERS_SINCE) continue
    for (const channel of QUOTA_CHANNELS) total[channel] += numberAt(doc.data, SENT_PATH[channel])
  }
  return total
}
