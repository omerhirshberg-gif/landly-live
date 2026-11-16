import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// getUsdIlsRate: memory -> Firestore (12 h) -> BOI -> Frankfurter -> stale stored -> 3.70.

const mocks = vi.hoisted(() => ({ stored: undefined as Record<string, unknown> | undefined, writes: [] as unknown[], readFails: false, writeFails: false }))
vi.mock('@/lib/firebase/admin', () => ({
  getAdminProjectId: () => 'landly-dev',
  getAdminDb: () => ({
    doc: () => ({
      get: async () => {
        if (mocks.readFails) throw new Error('UNAVAILABLE')
        return { exists: mocks.stored !== undefined, data: () => mocks.stored }
      },
      set: async (value: unknown) => {
        if (mocks.writeFails) throw new Error('UNAVAILABLE')
        mocks.writes.push(value)
        mocks.stored = value as Record<string, unknown>
      },
    }),
  }),
}))

import { getUsdIlsRate, parseBoi, parseFrankfurter, resetRateCache } from '@/lib/usage/exchangeRate.server'

const NOW = new Date('2026-11-16T12:00:00Z')
const boiBody = (value: unknown) => ({ data: { dataSets: [{ series: { '0:0:0:0:0:0': { observations: { '0': [value, 0] } } } }] } })
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body })

let fetchMock: ReturnType<typeof vi.fn>
const route = (boi: () => unknown, frankfurter: () => unknown) =>
  fetchMock.mockImplementation(async (url: string) => (url.includes('boi.gov.il') ? boi() : frankfurter()))

beforeEach(() => {
  resetRateCache()
  mocks.stored = undefined
  mocks.writes = []
  mocks.readFails = false
  mocks.writeFails = false
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('parsers', () => {
  it('reads the Bank of Israel observation (a string) and Frankfurter\'s ILS', () => {
    expect(parseBoi(boiBody('3.223'))).toBe(3.223)
    expect(parseFrankfurter({ rates: { ILS: 3.2107 } })).toBe(3.2107)
  })
  it('rejects malformed and implausible values', () => {
    expect(parseBoi({})).toBeNull()
    expect(parseBoi(boiBody('abc'))).toBeNull()
    expect(parseBoi(boiBody('0.3'))).toBeNull()
    expect(parseFrankfurter({ rates: { ILS: 99 } })).toBeNull()
    expect(parseFrankfurter(null)).toBeNull()
  })
})

describe('getUsdIlsRate', () => {
  it('uses the Bank of Israel rate and stores it', async () => {
    route(() => ok(boiBody('3.223')), () => ok({ rates: { ILS: 3.2 } }))
    const fx = await getUsdIlsRate(NOW)
    expect(fx).toMatchObject({ usdToIls: 3.223, source: 'boi', stale: false, updatedAt: NOW.toISOString() })
    expect(mocks.writes[0]).toMatchObject({ rate: 3.223, source: 'boi', fetchedAt: NOW.toISOString(), projectId: 'landly-dev' })
  })

  it('falls back to Frankfurter when the Bank of Israel fails or answers garbage', async () => {
    route(() => { throw new Error('timeout') }, () => ok({ rates: { ILS: 3.21 } }))
    expect(await getUsdIlsRate(NOW)).toMatchObject({ usdToIls: 3.21, source: 'frankfurter' })
    resetRateCache()
    mocks.stored = undefined
    route(() => ok(boiBody('nonsense')), () => ok({ rates: { ILS: 3.3 } }))
    expect((await getUsdIlsRate(NOW)).source).toBe('frankfurter')
  })

  it('serves from memory for 12 hours without fetching again', async () => {
    route(() => ok(boiBody('3.2')), () => ok({}))
    await getUsdIlsRate(NOW)
    fetchMock.mockClear()
    expect((await getUsdIlsRate(new Date(NOW.getTime() + 11 * 3600_000))).usdToIls).toBe(3.2)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('serves a fresh Firestore rate without fetching', async () => {
    mocks.stored = { rate: 3.3, fetchedAt: new Date(NOW.getTime() - 3600_000).toISOString(), source: 'boi' }
    expect(await getUsdIlsRate(NOW)).toMatchObject({ usdToIls: 3.3, stale: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refetches once the stored rate is over 12 hours old', async () => {
    mocks.stored = { rate: 3.3, fetchedAt: new Date(NOW.getTime() - 13 * 3600_000).toISOString(), source: 'boi' }
    route(() => ok(boiBody('3.25')), () => ok({}))
    expect((await getUsdIlsRate(NOW)).usdToIls).toBe(3.25)
  })

  it('uses the stale stored rate when every live source fails', async () => {
    mocks.stored = { rate: 3.3, fetchedAt: '2026-11-01T00:00:00.000Z', source: 'frankfurter' }
    route(() => { throw new Error('down') }, () => ({ ok: false, status: 503 }))
    expect(await getUsdIlsRate(NOW)).toMatchObject({ usdToIls: 3.3, stale: true, source: 'frankfurter', updatedAt: '2026-11-01T00:00:00.000Z' })
  })

  it('falls back to 3.70 only when nothing was ever stored', async () => {
    route(() => { throw new Error('down') }, () => { throw new Error('down') })
    expect(await getUsdIlsRate(NOW)).toMatchObject({ usdToIls: 3.7, source: 'default', updatedAt: null })
  })

  it('never throws on Firestore failures and still returns the live rate', async () => {
    mocks.readFails = true
    mocks.writeFails = true
    route(() => ok(boiBody('3.22')), () => ok({}))
    expect((await getUsdIlsRate(NOW)).usdToIls).toBe(3.22)
  })

  it('ignores an implausible stored rate', async () => {
    mocks.stored = { rate: 0, fetchedAt: NOW.toISOString(), source: 'boi' }
    route(() => { throw new Error('down') }, () => { throw new Error('down') })
    expect((await getUsdIlsRate(NOW)).source).toBe('default')
  })
})
