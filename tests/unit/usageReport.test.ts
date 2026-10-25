import { describe, expect, it } from 'vitest'
import { grossCostIls, netCostIls, SKUS, USD_TO_ILS, type SkuId } from '@/lib/usage/pricing'
import { buildUsageReport, meterStatus, type SourceData, type UsageReport } from '@/lib/usage/usageReport'
import { countersOf, dayKeyOf, emptyCounters, isMonthKey, monthKeyOf, usageEnvOf, type UsageCounters } from '@/lib/usage/usageTypes'

// The /admin/system/costs arithmetic: free allowances, Google's volume
// bands, shekel conversion, meter thresholds and the month list.

const NOW = new Date('2026-10-25T12:00:00Z')

function counters(edit: (c: UsageCounters) => void): UsageCounters {
  const c = emptyCounters()
  edit(c)
  return c
}

const source = (env: 'prod' | 'dev', counters: UsageCounters | null, months: string[] = []): SourceData => ({
  source: { env, projectId: env === 'prod' ? 'landly-be752' : 'landly-dev', status: counters ? 'ok' : 'unavailable', via: 'local' },
  counters,
  months,
})

/** One environment's month, alone: the pricing of a single view. */
function report(c: UsageCounters, extra: Partial<Parameters<typeof buildUsageReport>[0]> = {}): UsageReport {
  return buildUsageReport({ month: '2026-10', view: 'prod', prod: source('prod', c), dev: source('dev', emptyCounters()), now: NOW, ...extra })
}

const line = (r: UsageReport, id: SkuId) => r.lines.find((l) => l.skuId === id)!
const sku = (id: SkuId) => SKUS.find((s) => s.id === id)!

describe('usage report', () => {
  it('prices an empty month at zero with full coverage and every meter green', () => {
    const r = report(emptyCounters())
    expect(r.totals).toEqual({ grossIls: 0, netIls: 0, freeCoveragePct: 100, otpSent: 0 })
    expect(r.lines.map((l) => l.status)).toEqual(r.lines.map(() => 'ok'))
    expect(r.lines.map((l) => l.skuId)).toEqual(['translation', 'placesAutocomplete', 'placesDetails', 'geocoding', 'waAuth', 'waService', 'waSimulated'])
  })

  it('bills translation past 500k characters at $20 per million, detection included', () => {
    const r = report(counters((c) => {
      c.google.translation.chars = 550_000
      c.google.translation.detectChars = 50_000
    }))
    const t = line(r, 'translation')
    expect(t.used).toBe(600_000)
    expect(t.billable).toBe(100_000)
    expect(t.netIls).toBeCloseTo(100_000 * (20 / 1e6) * 3.7, 6)
    expect(t.grossIls).toBeCloseTo(600_000 * (20 / 1e6) * 3.7, 6)
    expect(t.status).toBe('over')
    expect(t.note).toContain('50,000')
  })

  it('walks the Essentials volume bands after 10,000 free calls', () => {
    const details = sku('placesDetails')
    expect(netCostIls(details, 10_000)).toBe(0)
    expect(netCostIls(details, 150_000)).toBeCloseTo((90_000 * 5 + 50_000 * 4) / 1000 * USD_TO_ILS.rate, 6)
    expect(grossCostIls(details, 150_000)).toBeCloseTo(netCostIls(details, 150_000) + (10_000 * 5 / 1000) * USD_TO_ILS.rate, 6)
  })

  it('marks Places Autocomplete as an upper bound', () => {
    const r = report(counters((c) => {
      c.google.places.autocompleteRequests = 312
      c.google.places.sessionsCompleted = 40
    }))
    const a = line(r, 'placesAutocomplete')
    expect(a.isUpperBound).toBe(true)
    expect(a.used).toBe(312)
    expect(a.note).toContain('40 sessions')
    expect(r.lines.filter((l) => l.isUpperBound).map((l) => l.skuId)).toEqual(['placesAutocomplete'])
  })

  it('bills every OTP at 0.12 ₪ with no free allowance and no meter', () => {
    const r = report(counters((c) => {
      c.whatsapp.authSent = 32
    }))
    const otp = line(r, 'waAuth')
    expect(otp.freeAllowance).toBe(0)
    expect(otp.billable).toBe(32)
    expect(otp.netIls).toBeCloseTo(3.84, 6)
    expect(otp.grossIls).toBeCloseTo(3.84, 6)
    expect(otp.coverage).toBeNull()
    expect(r.totals.otpSent).toBe(32)
    expect(r.totals.freeCoveragePct).toBe(0)
  })

  it('keeps support replies and simulated sends free, whatever the volume', () => {
    const r = report(counters((c) => {
      c.whatsapp.serviceSent = 5000
      c.whatsapp.inboundMessages = 4200
      c.whatsapp.simulated = 17
    }))
    for (const id of ['waService', 'waSimulated'] as const) {
      expect(line(r, id)).toMatchObject({ freeAllowance: null, billable: 0, grossIls: 0, netIls: 0, coverage: null, status: 'ok' })
    }
    expect(line(r, 'waSimulated').used).toBe(17)
    expect(line(r, 'waService').note).toContain('4,200 member messages')
  })

  it('works out the free-tier coverage of the whole month', () => {
    const r = report(counters((c) => {
      c.google.places.detailsRequests = 640 // free: gross 640 × $0.005
      c.whatsapp.authSent = 10 // 1.20 ₪ gross and net
    }))
    const gross = 640 * 0.005 * USD_TO_ILS.rate + 1.2
    expect(r.totals.grossIls).toBeCloseTo(gross, 6)
    expect(r.totals.netIls).toBeCloseTo(1.2, 6)
    expect(r.totals.freeCoveragePct).toBe(Math.round((1 - 1.2 / gross) * 100))
  })

  it('turns a meter amber from 80% and red only once units are billed', () => {
    expect(meterStatus(0.79, 0)).toBe('ok')
    expect(meterStatus(0.8, 0)).toBe('warn')
    expect(meterStatus(1, 0)).toBe('warn')
    expect(meterStatus(1.0001, 1)).toBe('over')
    expect(meterStatus(null, 0)).toBe('ok')
    expect(line(report(counters((c) => (c.google.geocoding.requests = 10_001))), 'geocoding').status).toBe('over')
  })

  it('names the environment from the project', () => {
    expect(usageEnvOf('landly-be752')).toBe('prod')
    expect(usageEnvOf('landly-dev')).toBe('dev')
    expect(usageEnvOf('demo-landly')).toBeNull()
    expect(usageEnvOf(undefined)).toBeNull()
  })

  it('lists both environments’ months newest first, with the shown and the current month', () => {
    const r = report(emptyCounters(), {
      month: '2026-07',
      prod: source('prod', emptyCounters(), ['2026-08', '2026-07']),
      dev: source('dev', emptyCounters(), ['2026-09', '2026-08']),
    })
    expect(r.months).toEqual(['2026-10', '2026-09', '2026-08', '2026-07'])
  })
})

describe('usage counters', () => {
  it('reads a stored month, ignoring junk', () => {
    const c = countersOf({
      month: '2026-10',
      google: { translation: { chars: 120, detectChars: 'x' }, places: { detailsRequests: -3 }, geocoding: { requests: Infinity } },
      whatsapp: { authSent: 2, unknown: 9 },
      daily: { '25': { whatsapp: { authSent: 2 } } },
    })
    expect(c.google.translation).toEqual({ chars: 120, detectChars: 0, requests: 0 })
    expect(c.google.places.detailsRequests).toBe(0)
    expect(c.google.geocoding.requests).toBe(0)
    expect(c.whatsapp).toEqual({ inboundMessages: 0, serviceSent: 0, authSent: 2, simulated: 0 })
    expect(countersOf(undefined)).toEqual(emptyCounters())
  })

  it('keys months and days in UTC', () => {
    // 01:30 in Israel on 1 November is still 31 October in UTC.
    const lateOctoberUtc = new Date('2026-10-31T23:30:00Z')
    expect(monthKeyOf(lateOctoberUtc)).toBe('2026-10')
    expect(dayKeyOf(lateOctoberUtc)).toBe('31')
    expect(isMonthKey('2026-10')).toBe(true)
    for (const bad of ['2026-13', '2026-1', '26-10', '2026-10-01', '', null]) expect(isMonthKey(bad)).toBe(false)
  })
})
