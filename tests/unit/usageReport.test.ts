import { describe, expect, it } from 'vitest'
import { en } from '@/lib/admin/translations/en'
import { he } from '@/lib/admin/translations/he'
import { buildQuota, quotaOf, quotaState, quotaStatus, sumLifetime } from '@/lib/usage/quota'
import { formatIlsRate, grossCostIls, netCostIls, SKUS, USD_TO_ILS, type SkuId } from '@/lib/usage/pricing'
import { buildUsageReport, meterStatus, reportLines, type UsageReport } from '@/lib/usage/usageReport'
import { countersOf, dayKeyOf, emptyCounters, isMonthKey, monthKeyOf, usageEnvOf, type UsageCounters } from '@/lib/usage/usageTypes'

// The /admin/system/costs arithmetic: free allowances, Google's volume
// bands, shekel conversion, meter thresholds and the month list.

const NOW = new Date('2026-10-25T12:00:00Z')

function counters(edit: (c: UsageCounters) => void): UsageCounters {
  const c = emptyCounters()
  edit(c)
  return c
}

function report(c: UsageCounters, extra: Partial<Parameters<typeof buildUsageReport>[0]> = {}): UsageReport {
  return buildUsageReport({ month: '2026-10', months: [], projectId: 'landly-be752', counters: c, now: NOW, ...extra })
}

const lines = (r: UsageReport) => reportLines(r)
const line = (r: UsageReport, id: SkuId) => lines(r).find((l) => l.skuId === id)!
const sku = (id: SkuId) => SKUS.find((s) => s.id === id)!

describe('usage report', () => {
  it('prices an empty month at zero with full coverage and every meter green', () => {
    const r = report(emptyCounters())
    expect(r.totals).toEqual({ grossIls: 0, netIls: 0, freeCoveragePct: 100, otpSent: 0 })
    expect(lines(r).map((l) => l.status)).toEqual(lines(r).map(() => 'ok'))
    // No simulated sends and no legacy Meta OTPs: neither row.
    expect(lines(r).map((l) => l.skuId)).toEqual(['translation', 'placesAutocomplete', 'placesDetails', 'geocoding', 'sms019Otp', 'wa019Otp', 'waService'])
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
    expect(lines(r).filter((l) => l.isUpperBound).map((l) => l.skuId)).toEqual(['placesAutocomplete'])
  })

  it('bills 019 SMS at 0.02 ₪ and 019 WhatsApp at 0.075 ₪, with no free allowance and no meter', () => {
    const r = report(counters((c) => {
      c.gateway019.smsOtpSent = 50
      c.gateway019.whatsappOtpSent = 32
    }))
    const sms = line(r, 'sms019Otp')
    expect(sms).toMatchObject({ freeAllowance: 0, billable: 50, coverage: null })
    expect(sms.netIls).toBeCloseTo(50 * 0.02, 6) // 1.00
    expect(sms.grossIls).toBeCloseTo(1, 6)
    const wa = line(r, 'wa019Otp')
    expect(wa).toMatchObject({ freeAllowance: 0, billable: 32, coverage: null })
    expect(wa.netIls).toBeCloseTo(32 * 0.075, 6) // 2.40
    expect(wa.grossIls).toBeCloseTo(2.4, 6)
    expect(r.totals.otpSent).toBe(82)
    expect(r.totals.freeCoveragePct).toBe(0)
  })

  it('prices the 019 units exactly: 0.02 ₪ per SMS, 0.075 ₪ per WhatsApp message, Meta\'s legacy OTP unchanged', () => {
    const unit = (id: SkuId) => SKUS.find((sku) => sku.id === id)!.tiers[0].unitPrice
    expect(unit('sms019Otp')).toEqual({ amount: 0.02, currency: 'ILS' })
    expect(unit('wa019Otp')).toEqual({ amount: 0.075, currency: 'ILS' })
    expect(unit('waAuthLegacy')).toEqual({ amount: 0.12, currency: 'ILS' })
    expect(netCostIls(SKUS.find((s) => s.id === 'sms019Otp')!, 1_000)).toBeCloseTo(20, 6)
    expect(netCostIls(SKUS.find((s) => s.id === 'wa019Otp')!, 1_000)).toBeCloseTo(75, 6)
    expect(formatIlsRate(0.075)).toContain('0.075')
    expect(formatIlsRate(0.02)).toContain('0.02')
    expect(formatIlsRate(0.02)).not.toContain('0.020')
  })

  it('keeps support replies and simulated sends free, whatever the volume', () => {
    const r = report(counters((c) => {
      c.whatsapp.serviceSent = 5000
      c.whatsapp.inboundMessages = 4200
      c.gateway019.simulated = 17
    }))
    for (const id of ['waService', 'sim019'] as const) {
      expect(line(r, id)).toMatchObject({ freeAllowance: null, billable: 0, grossIls: 0, netIls: 0, coverage: null, status: 'ok' })
    }
    expect(line(r, 'sim019').used).toBe(17)
    expect(line(r, 'waService').note).toContain('4,200 member messages')
  })

  it('works out the free-tier coverage of the whole month', () => {
    const r = report(counters((c) => {
      c.google.places.detailsRequests = 640 // free: gross 640 × $0.005
      c.gateway019.whatsappOtpSent = 10 // 0.75 ₪ gross and net
    }))
    const gross = 640 * 0.005 * USD_TO_ILS.rate + 0.75
    expect(r.totals.grossIls).toBeCloseTo(gross, 6)
    expect(r.totals.netIls).toBeCloseTo(0.75, 6)
    expect(r.totals.freeCoveragePct).toBe(Math.round((1 - 0.75 / gross) * 100))
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
    expect(usageEnvOf('demo-landly')).toBe('other')
    expect(usageEnvOf(undefined)).toBe('other')
    expect(report(emptyCounters()).environment).toBe('prod')
    expect(report(emptyCounters(), { projectId: 'landly-dev' })).toMatchObject({ environment: 'dev', projectId: 'landly-dev' })
  })

  it('lists months newest first, with the shown and the current month', () => {
    const r = report(emptyCounters(), { month: '2026-07', months: ['2026-08', '2026-07', '2026-09'] })
    expect(r.months).toEqual(['2026-10', '2026-09', '2026-08', '2026-07'])
  })
})

describe('vendor groups', () => {
  const busy = counters((c) => {
    c.google.translation.chars = 600_000
    c.google.places.detailsRequests = 11_000
    c.gateway019.whatsappOtpSent = 32
    c.whatsapp.serviceSent = 120
  })

  it('splits the services into Google Cloud, 019 Gateway and Meta WhatsApp, in that order', () => {
    const r = report(busy)
    expect(r.groups.map((g) => [g.vendor, g.label])).toEqual([['google', 'Google Cloud'], ['gateway019', '019 Gateway'], ['meta', 'Meta WhatsApp']])
    expect(r.groups[0]!.lines.map((l) => l.skuId)).toEqual(['translation', 'placesAutocomplete', 'placesDetails', 'geocoding'])
    expect(r.groups[1]!.lines.map((l) => l.skuId)).toEqual(['sms019Otp', 'wa019Otp'])
    expect(r.groups[2]!.lines.map((l) => l.skuId)).toEqual(['waService'])
  })

  it('subtotals each vendor, and the subtotals add up to the totals', () => {
    const r = report(busy)
    const [google, gateway, meta] = r.groups
    expect(gateway!.netIls).toBeCloseTo(32 * 0.075, 6) // 2.40
    expect(meta!.netIls).toBe(0)
    expect(google!.netIls).toBeCloseTo(100_000 * (20 / 1e6) * USD_TO_ILS.rate + 1_000 * (5 / 1000) * USD_TO_ILS.rate, 6)
    expect(google!.netIls + gateway!.netIls + meta!.netIls).toBeCloseTo(r.totals.netIls, 6)
    expect(google!.grossIls + gateway!.grossIls + meta!.grossIls).toBeCloseTo(r.totals.grossIls, 6)
  })

  it('shows the simulated-sends row only when there are some, counting the earlier whatsapp.simulated too', () => {
    expect(lines(report(busy)).some((l) => l.skuId === 'sim019')).toBe(false)
    const dev = report(counters((c) => {
      c.gateway019.simulated = 3
      c.whatsapp.simulated = 2
    }), { projectId: 'landly-dev' })
    expect(dev.groups[1]!.lines.map((l) => l.skuId)).toEqual(['sms019Otp', 'wa019Otp', 'sim019'])
    expect(line(dev, 'sim019')).toMatchObject({ used: 5, netIls: 0 })
  })

  it('shows the Legacy Meta OTP row at 0.12 ₪ only for a month that has Meta OTPs', () => {
    expect(lines(report(busy)).some((l) => l.skuId === 'waAuthLegacy')).toBe(false)
    const old = report(counters((c) => (c.whatsapp.authSent = 30)), { month: '2026-08' })
    expect(old.groups[2]!.lines.map((l) => l.skuId)).toEqual(['waAuthLegacy', 'waService'])
    expect(line(old, 'waAuthLegacy')).toMatchObject({ vendor: 'meta', freeAllowance: 0, billable: 30 })
    expect(line(old, 'waAuthLegacy').netIls).toBeCloseTo(3.6, 6)
    expect(old.groups[2]!.netIls).toBeCloseTo(3.6, 6)
    // It was paid, so it is in the totals, but it is not a 019 code.
    expect(old.totals.netIls).toBeCloseTo(3.6, 6)
    expect(old.totals.otpSent).toBe(0)
  })
})

describe('usage counters', () => {
  it('reads a stored month, ignoring junk', () => {
    const c = countersOf({
      month: '2026-10',
      google: { translation: { chars: 120, detectChars: 'x' }, places: { detailsRequests: -3 }, geocoding: { requests: Infinity } },
      whatsapp: { authSent: 2, unknown: 9 },
      gateway019: { smsOtpSent: 7, whatsappOtpSent: 'x', simulated: -1 },
      daily: { '25': { whatsapp: { authSent: 2 } } },
    })
    expect(c.google.translation).toEqual({ chars: 120, detectChars: 0, requests: 0 })
    expect(c.google.places.detailsRequests).toBe(0)
    expect(c.google.geocoding.requests).toBe(0)
    expect(c.whatsapp).toEqual({ inboundMessages: 0, serviceSent: 0, authSent: 2, simulated: 0 })
    expect(c.gateway019).toEqual({ smsOtpSent: 7, whatsappOtpSent: 0, simulated: 0 })
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

describe('translated service notes', () => {
  const full = counters((c) => {
    c.google.translation.detectChars = 9
    c.whatsapp.inboundMessages = 5
  })

  it('has an English and a Hebrew note for every service that has one, with the same placeholders', () => {
    for (const sku of SKUS.filter((s) => s.note)) {
      const key = `usage.note.${sku.id}` as keyof typeof en
      expect(en[key], `en ${key}`).toBeTruthy()
      expect((he as Record<string, string>)[key], `he ${key}`).toBeTruthy()
      const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
      expect(placeholders((he as Record<string, string>)[key])).toEqual(placeholders(en[key]))
      // Every placeholder is supplied by the report line.
      const params = sku.noteParams?.(full) ?? {}
      expect(placeholders(en[key]).every((name) => name in params), key).toBe(true)
    }
  })
})

describe('019 package quota', () => {
  it('starts SMS at 1,005 and WhatsApp at 1,000 purchased messages with nothing sent', () => {
    const q = buildQuota()
    expect(q.sms).toEqual({ sent: 0, quota: 1005, remaining: 1005, over: 0, pct: 0, status: 'ok' })
    expect(q.whatsapp).toEqual({ sent: 0, quota: 1000, remaining: 1000, over: 0, pct: 0, status: 'ok' })
    expect(buildUsageReport({ month: '2026-11', months: [], projectId: 'landly-dev', counters: emptyCounters(), now: NOW }).quota).toEqual(q)
  })

  it('works out sent of quota, the balance and the percentage', () => {
    expect(quotaState(412, 1000)).toEqual({ sent: 412, quota: 1000, remaining: 588, over: 0, pct: 41.2, status: 'ok' })
    expect(quotaState(412, 2000)).toMatchObject({ remaining: 1588, pct: 20.6 })
    expect(quotaState(1200, 1000)).toMatchObject({ remaining: 0, over: 200, pct: 120, status: 'critical' })
  })

  it('turns amber from 80% used and red from 95% or with nothing left', () => {
    expect(quotaStatus(799, 1000)).toBe('ok')
    expect(quotaStatus(800, 1000)).toBe('warn')
    expect(quotaStatus(949, 1000)).toBe('warn')
    expect(quotaStatus(950, 1000)).toBe('critical')
    expect(quotaStatus(1000, 1000)).toBe('critical')
    expect(quotaStatus(1001, 1000)).toBe('critical')
    expect(quotaStatus(1_599, 2000)).toBe('ok')
    expect(quotaStatus(1_600, 2000)).toBe('warn')
    expect(quotaStatus(1_900, 2000)).toBe('critical')
  })

  it('takes a stored quota, and falls back to the channel default for anything malformed', () => {
    expect(quotaOf(3000, 'sms')).toBe(3000)
    for (const bad of [undefined, null, 0, -5, 1.5, '2000', NaN, Infinity]) {
      expect(quotaOf(bad, 'sms')).toBe(1005)
      expect(quotaOf(bad, 'whatsapp')).toBe(1000)
    }
    const q = buildQuota({ sent: { sms: 412, whatsapp: 37 }, quota: { sms: 2000, whatsapp: 'x' } })
    expect(q.sms).toMatchObject({ sent: 412, quota: 2000, remaining: 1588 })
    expect(q.whatsapp).toMatchObject({ sent: 37, quota: 1000, remaining: 963 })
  })

  it('sums lifetime sends over every month from 2026-10, never resetting, and skips what is not a month', () => {
    const doc = (id: string, sms: number, wa: number) => ({ id, data: { gateway019: { smsOtpSent: sms, whatsappOtpSent: wa } } })
    expect(
      sumLifetime([
        doc('2026-09', 900, 900), // before counters were kept
        doc('2026-10', 300, 20),
        doc('2026-11', 112, 17),
        doc('2027-01', 5, 1),
        { id: 'quota019', data: { smsQuota: 3000, gateway019: { smsOtpSent: 999 } } },
        { id: 'notes', data: { gateway019: { smsOtpSent: 999 } } },
        { id: '2026-12', data: { gateway019: { smsOtpSent: 'many', whatsappOtpSent: -4 } } },
        { id: '2026-08', data: undefined },
      ])
    ).toEqual({ sms: 417, whatsapp: 38 })
    expect(sumLifetime([])).toEqual({ sms: 0, whatsapp: 0 })
  })

  it('keeps cost lines at rate × messages, whatever the quota', () => {
    const r = buildUsageReport({
      month: '2026-10',
      months: [],
      projectId: 'landly-dev',
      counters: counters((c) => {
        c.gateway019.smsOtpSent = 50
        c.gateway019.whatsappOtpSent = 32
      }),
      now: NOW,
      quota: { sent: { sms: 50, whatsapp: 32 }, quota: { sms: 3000 } },
    })
    expect(line(r, 'sms019Otp').netIls).toBeCloseTo(1, 6)
    expect(line(r, 'wa019Otp').netIls).toBeCloseTo(2.4, 6)
    expect(r.quota.sms).toMatchObject({ sent: 50, quota: 3000 })
  })
})
