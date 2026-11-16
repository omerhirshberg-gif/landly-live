import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TRANZILA_FEE, tranzilaFeeIls } from '@/lib/usage/pricing'
import { buildUsageReport, NO_TRANZILA } from '@/lib/usage/usageReport'
import { emptyCounters } from '@/lib/usage/usageTypes'

const mocks = vi.hoisted(() => ({ docs: [] as Record<string, unknown>[], queries: [] as unknown[][], fail: false }))
vi.mock('firebase-admin/firestore', () => ({ Timestamp: { fromDate: (date: Date) => ({ iso: date.toISOString() }) } }))

import { loadTranzilaUsage } from '@/lib/usage/tranzilaCost.server'

function fakeDb() {
  const chain = {
    where: (...args: unknown[]) => (mocks.queries.push(args), chain),
    select: () => chain,
    get: async () => {
      if (mocks.fail) throw new Error('FAILED_PRECONDITION: index')
      return { docs: mocks.docs.map((data) => ({ data: () => data })) }
    },
  }
  return { collection: (name: string) => (mocks.queries.push(['collection', name]), chain) } as never
}

beforeEach(() => {
  mocks.docs = []
  mocks.queries = []
  mocks.fail = false
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('Tranzila fee constants', () => {
  it('ship at zero, so the fee is 0 until real rates are set in code', () => {
    expect(TRANZILA_FEE).toEqual({ perTransactionIls: 0, percent: 0 })
    expect(tranzilaFeeIls(50, 5000)).toBe(0)
  })
  it('computes a per-transaction plus percentage fee', () => {
    expect(tranzilaFeeIls(10, 1000, { perTransactionIls: 0.3, percent: 1.5 })).toBeCloseTo(3 + 15, 10)
    expect(tranzilaFeeIls(0, 1000, { perTransactionIls: 0.3, percent: 1.5 })).toBe(0)
  })
})

describe('loadTranzilaUsage', () => {
  it('reads nothing while TRANZILA_TERMINAL is unset', async () => {
    vi.stubEnv('TRANZILA_TERMINAL', '')
    expect(await loadTranzilaUsage(fakeDb(), '2026-10')).toEqual(NO_TRANZILA)
    expect(mocks.queries).toHaveLength(0)
  })
  it('counts the month\'s paid orders and skips sandbox ones', async () => {
    vi.stubEnv('TRANZILA_TERMINAL', 'landlyterm')
    mocks.docs = [
      { amount: 49.9, amountAgorot: 4990, terminal: 'landlyterm' },
      { amount: 10, terminal: 'landlyterm' },
      { amount: 99, amountAgorot: 9900, terminal: 'landly_sandbox' },
      { amount: 'bad', terminal: 'landlyterm' },
    ]
    const usage = await loadTranzilaUsage(fakeDb(), '2026-10')
    expect(usage).toEqual({ configured: true, transactions: 2, volumeIls: 59.9, unavailable: false })
    expect(mocks.queries).toContainEqual(['status', '==', 'paid'])
    expect(mocks.queries).toContainEqual(['paidAt', '>=', { iso: '2026-10-01T00:00:00.000Z' }])
    expect(mocks.queries).toContainEqual(['paidAt', '<', { iso: '2026-11-01T00:00:00.000Z' }])
  })
  it('rolls December into January', async () => {
    vi.stubEnv('TRANZILA_TERMINAL', 'landlyterm')
    await loadTranzilaUsage(fakeDb(), '2026-12')
    expect(mocks.queries).toContainEqual(['paidAt', '<', { iso: '2027-01-01T00:00:00.000Z' }])
  })
  it('reports unavailable, not a made-up zero, when the query fails', async () => {
    vi.stubEnv('TRANZILA_TERMINAL', 'landlyterm')
    mocks.fail = true
    expect(await loadTranzilaUsage(fakeDb(), '2026-10')).toEqual({ configured: true, transactions: 0, volumeIls: 0, unavailable: true })
  })
})

describe('report: fixed lines and combined totals', () => {
  const base = { month: '2026-10', months: ['2026-10'], projectId: 'landly-be752', counters: emptyCounters(), fx: { usdToIls: 3.5, updatedAt: null, source: 'default' as const, stale: false, verifiedAt: '2026-10' } }

  it('prices Vercel Pro at the live rate, leaves Resend and an unconfigured Tranzila at zero', () => {
    const report = buildUsageReport(base)
    expect(report.fixed.lines.map((l) => [l.id, l.status, l.netIls])).toEqual([['vercelPro', 'billed', 70], ['resend', 'free', 0], ['tranzila', 'notConfigured', 0]])
    expect(report.fixed.netIls).toBe(70)
    expect(report.outlay.fixed).toMatchObject({ netIls: 70, vatIls: 12.6 })
    expect(report.outlay.fixed.grossIls).toBeCloseTo(82.6, 10)
    expect(report.outlay.total.netIls).toBe(report.outlay.metered.netIls + 70)
  })
  it('ignores an inactive subscription and shows Resend against 3,000, flagging overage without double counting', () => {
    const counters = emptyCounters()
    counters.resend.emailsSent = 3_500
    const report = buildUsageReport({ ...base, counters, subscriptions: [{ id: 'vercelPro', label: 'Vercel Pro', amount: 20, currency: 'USD', active: false }] })
    const resend = report.fixed.lines.find((l) => l.id === 'resend')!
    expect(resend).toMatchObject({ used: 3_500, freeAllowance: 3_000, status: 'over', netIls: 0 })
    expect(report.fixed.netIls).toBe(0)
    expect(report.outlay.total.netIls).toBeCloseTo(report.outlay.metered.netIls, 10)
    expect(report.outlay.metered.netIls).toBeGreaterThan(0)
  })
  it('adds Tranzila\'s fee, with 18% VAT, once it is connected and the fee constants are non-zero', () => {
    vi.resetModules()
    const tranzila = { configured: true, transactions: 10, volumeIls: 1000, unavailable: false }
    const report = buildUsageReport({ ...base, tranzila })
    expect(report.fixed.lines.find((l) => l.id === 'tranzila')).toMatchObject({ status: 'active', transactions: 10, volumeIls: 1000, netIls: 0 })
    // The fee itself, as it will be with real rates, flows through the same helper.
    const fee = tranzilaFeeIls(10, 1000, { perTransactionIls: 0.3, percent: 1.5 })
    expect(fee * 1.18).toBeCloseTo(21.24, 10)
  })
})
