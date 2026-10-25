import { describe, expect, it } from 'vitest'
import { USD_TO_ILS } from '@/lib/usage/pricing'
import { buildUsageReport, isUsageView, viewCounters, type SourceData, type UsageView } from '@/lib/usage/usageReport'
import { emptyCounters, sumCounters, type UsageCounters } from '@/lib/usage/usageTypes'

// The Combined view: PROD and DEV share one billing account, so their
// units are added first and priced once, against one free allowance.

const NOW = new Date('2026-10-25T12:00:00Z')

function counters(edit: (c: UsageCounters) => void): UsageCounters {
  const c = emptyCounters()
  edit(c)
  return c
}

const ok = (env: 'prod' | 'dev', c: UsageCounters, months: string[] = []): SourceData => ({
  source: { env, projectId: env === 'prod' ? 'landly-be752' : 'landly-dev', status: 'ok', via: env === 'prod' ? 'local' : 'peer-reader' },
  counters: c,
  months,
})
const down = (env: 'prod' | 'dev', status: 'unconfigured' | 'unavailable' | 'mismatch' = 'unavailable'): SourceData => ({
  source: { env, projectId: env === 'prod' ? 'landly-be752' : 'landly-dev', status, via: 'peer-export', message: 'no route' },
  counters: null,
  months: [],
})

const PROD = counters((c) => {
  c.google.translation.chars = 400_000
  c.google.places.detailsRequests = 9_000
  c.whatsapp.authSent = 30
  c.whatsapp.serviceSent = 200
})
const DEV = counters((c) => {
  c.google.translation.chars = 150_000
  c.google.translation.detectChars = 50_000
  c.google.places.detailsRequests = 2_000
  c.whatsapp.authSent = 2
  c.whatsapp.simulated = 14
})

const build = (view: UsageView, prod: SourceData = ok('prod', PROD), dev: SourceData = ok('dev', DEV)) =>
  buildUsageReport({ month: '2026-10', view, prod, dev, now: NOW })
const line = (view: UsageView, id: string, prod?: SourceData, dev?: SourceData) => build(view, prod, dev).lines.find((l) => l.skuId === id)!

describe('sumCounters', () => {
  it('adds every counter of every environment', () => {
    const total = sumCounters(PROD, DEV)
    expect(total.google.translation).toEqual({ chars: 550_000, detectChars: 50_000, requests: 0 })
    expect(total.google.places.detailsRequests).toBe(11_000)
    expect(total.whatsapp).toEqual({ inboundMessages: 0, serviceSent: 200, authSent: 32, simulated: 14 })
    expect(sumCounters()).toEqual(emptyCounters())
    expect(sumCounters(PROD)).toEqual(PROD)
  })
})

describe('combined view', () => {
  it('prices the summed units once, against a single free allowance', () => {
    // 400k + 200k characters: each environment is inside 500k on its own, the bill is not.
    expect(line('prod', 'translation').netIls).toBe(0)
    expect(line('dev', 'translation').netIls).toBe(0)
    const combined = line('combined', 'translation')
    expect(combined.used).toBe(600_000)
    expect(combined.billable).toBe(100_000)
    expect(combined.netIls).toBeCloseTo(100_000 * (20 / 1e6) * USD_TO_ILS.rate, 6)

    // 9,000 + 2,000 Details lookups: 1,000 over the shared 10,000.
    expect(line('combined', 'placesDetails')).toMatchObject({ used: 11_000, billable: 1_000, status: 'over' })
    expect(line('combined', 'placesDetails').netIls).toBeCloseTo(1_000 * (5 / 1000) * USD_TO_ILS.rate, 6)
  })

  it('is not the sum of the separately priced views', () => {
    const separately = build('prod').totals.netIls + build('dev').totals.netIls
    expect(build('combined').totals.netIls).toBeGreaterThan(separately)
  })

  it('splits each line’s units by environment, and only in Combined', () => {
    expect(line('combined', 'translation').byEnv).toEqual({ prod: 400_000, dev: 200_000 })
    expect(line('combined', 'waAuth').byEnv).toEqual({ prod: 30, dev: 2 })
    expect(line('prod', 'translation').byEnv).toBeUndefined()
    expect(line('dev', 'translation').byEnv).toBeUndefined()
  })

  it('counts both environments’ OTPs', () => {
    expect(build('combined').totals.otpSent).toBe(32)
    expect(build('prod').totals.otpSent).toBe(30)
    expect(build('dev').totals.otpSent).toBe(2)
  })

  it('flags a total that is missing one environment, and covers the other', () => {
    const r = build('combined', ok('prod', PROD), down('dev'))
    expect(r).toMatchObject({ available: true, partial: true })
    expect(r.lines.find((l) => l.skuId === 'translation')).toMatchObject({ used: 400_000, byEnv: { prod: 400_000, dev: null } })
    expect(r.sources.map((s) => s.status)).toEqual(['ok', 'unavailable'])
    expect(build('combined').partial).toBe(false)
  })

  it('has nothing to show when no environment could be read', () => {
    const r = build('combined', down('prod', 'unconfigured'), down('dev'))
    expect(r).toMatchObject({ available: false, partial: false, lines: [] })
    expect(r.totals.netIls).toBe(0)
  })
})

describe('single-environment views', () => {
  it('price one environment alone, noting that the free tiers are shared', () => {
    const r = build('dev')
    expect(r).toMatchObject({ view: 'dev', sharedFreeTier: true, available: true, partial: false })
    expect(r.lines.find((l) => l.skuId === 'waSimulated')!.used).toBe(14)
    expect(build('combined').sharedFreeTier).toBe(false)
  })

  it('are unavailable, never empty-but-fine, when their environment couldn’t be read', () => {
    const r = build('prod', down('prod', 'mismatch'), ok('dev', DEV))
    expect(r).toMatchObject({ available: false, lines: [] })
    expect(viewCounters('prod', down('prod'), ok('dev', DEV))).toBeNull()
    expect(viewCounters('dev', down('prod'), ok('dev', DEV))).toEqual(DEV)
  })

  it('always list PROD first among the sources', () => {
    expect(build('dev').sources.map((s) => s.env)).toEqual(['prod', 'dev'])
  })
})

describe('isUsageView', () => {
  it('accepts the three views only', () => {
    for (const view of ['combined', 'prod', 'dev']) expect(isUsageView(view)).toBe(true)
    for (const bad of ['all', 'PROD', '', null, undefined]) expect(isUsageView(bad)).toBe(false)
  })
})
