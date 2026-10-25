import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

// GET /api/admin/usage and lib/usage/usageSources.ts: the view and month
// it's asked for, and how each deployment gets the two environments' counters.

const mocks = vi.hoisted(() => ({
  authError: null as Response | null,
  projectId: 'landly-dev',
  own: undefined as Record<string, unknown> | undefined,
  ownFails: false,
  ownReads: 0,
  readerConfigured: true,
  readDev: vi.fn(),
  listDev: vi.fn(),
  fetchProd: vi.fn(),
}))
vi.mock('@/lib/admin/adminAuth', () => ({ requireAdminAuth: () => mocks.authError }))
vi.mock('@/lib/firebase/admin', () => ({
  getAdminProjectId: () => mocks.projectId,
  getAdminDb: () => ({
    collection: () => ({
      doc: () => ({
        get: async () => {
          mocks.ownReads += 1
          if (mocks.ownFails) throw new Error('UNAVAILABLE')
          return { exists: mocks.own !== undefined, data: () => mocks.own }
        },
      }),
      select: () => ({ get: async () => ({ docs: [{ id: '2026-09' }] }) }),
    }),
  }),
}))
vi.mock('@/lib/usage/peerUsageDb', () => ({
  isDevReaderConfigured: () => mocks.readerConfigured,
  readDevUsageMonth: mocks.readDev,
  listDevUsageMonths: mocks.listDev,
}))
vi.mock('@/lib/usage/peerUsageExport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/usage/peerUsageExport')>()),
  fetchProdUsage: mocks.fetchProd,
}))

import { GET } from '@/app/api/admin/usage/route'
import { loadUsageSources } from '@/lib/usage/usageSources'
import { PeerExportError } from '@/lib/usage/peerUsageExport'
import { emptyCounters } from '@/lib/usage/usageTypes'
import type { UsageReport } from '@/lib/usage/usageReport'

const call = (query = '') => GET(new Request(`https://www.golandly.com/api/admin/usage${query}`))
const report = async (query = '') => (await (await call(query)).json()) as UsageReport

function deployedAs(target: 'production' | 'preview' | 'local') {
  vi.stubEnv('NODE_ENV', target === 'local' ? 'development' : 'production')
  vi.stubEnv('LANDLY_VERCEL', target === 'local' ? '' : '1')
  vi.stubEnv('LANDLY_VERCEL_ENV', target === 'local' ? '' : target)
  mocks.projectId = target === 'production' ? 'landly-be752' : 'landly-dev'
}

const prodExport = (authSent: number) => ({ projectId: 'landly-be752', month: '2026-10', months: ['2026-08'], counters: { ...emptyCounters(), whatsapp: { ...emptyCounters().whatsapp, authSent } } })

beforeEach(() => {
  mocks.authError = null
  mocks.own = { projectId: 'landly-dev', whatsapp: { authSent: 2 } }
  mocks.ownFails = false
  mocks.ownReads = 0
  mocks.readerConfigured = true
  mocks.readDev.mockResolvedValue({ projectId: 'landly-dev', whatsapp: { authSent: 2 } })
  mocks.listDev.mockResolvedValue(['2026-07'])
  mocks.fetchProd.mockResolvedValue(prodExport(30))
  deployedAs('local')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('GET /api/admin/usage', () => {
  it('needs the admin session', async () => {
    mocks.authError = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    expect((await call()).status).toBe(401)
    expect(mocks.fetchProd).not.toHaveBeenCalled()
  })

  it('defaults to the Combined view of the current UTC month', async () => {
    const r = await report()
    expect(r.view).toBe('combined')
    expect(r.month).toBe(new Date().toISOString().slice(0, 7))
    expect(r.totals.otpSent).toBe(32)
  })

  it('shows one environment when asked', async () => {
    expect((await report('?view=prod&month=2026-10')).totals.otpSent).toBe(30)
    expect((await report('?view=dev&month=2026-10')).totals.otpSent).toBe(2)
    expect(mocks.fetchProd).toHaveBeenCalledWith('2026-10')
  })

  it.each(['?view=all', '?view=', '?month=2026-13', '?month=oct'])('refuses %s', async (query) => {
    expect((await call(query)).status).toBe(400)
  })

  it('merges both environments’ months', async () => {
    expect((await report('?month=2026-10')).months).toEqual(expect.arrayContaining(['2026-10', '2026-09', '2026-08']))
  })
})

describe('loadUsageSources', () => {
  it('on a DEV deployment: its own counters, and PROD’s from the export', async () => {
    const { prod, dev } = await loadUsageSources('2026-10')
    expect(dev.source).toEqual({ env: 'dev', projectId: 'landly-dev', via: 'local', status: 'ok' })
    expect(prod.source).toEqual({ env: 'prod', projectId: 'landly-be752', via: 'peer-export', status: 'ok' })
    expect(prod.counters!.whatsapp.authSent).toBe(30)
    expect(mocks.readDev).not.toHaveBeenCalled()
  })

  it('on Vercel Preview: the same', async () => {
    deployedAs('preview')
    const { prod } = await loadUsageSources('2026-10')
    expect(prod.source.via).toBe('peer-export')
  })

  it('on Vercel Production: its own counters, and DEV’s with the read-only reader', async () => {
    deployedAs('production')
    mocks.own = { projectId: 'landly-be752', whatsapp: { authSent: 30 } }
    const { prod, dev } = await loadUsageSources('2026-10')
    expect(prod.source).toMatchObject({ env: 'prod', projectId: 'landly-be752', via: 'local', status: 'ok' })
    expect(dev.source).toMatchObject({ env: 'dev', projectId: 'landly-dev', via: 'peer-reader', status: 'ok' })
    expect(dev.months).toEqual(['2026-07'])
    expect(mocks.fetchProd).not.toHaveBeenCalled()
  })

  it('reports the reader as unconfigured without its key', async () => {
    deployedAs('production')
    mocks.own = { projectId: 'landly-be752' }
    mocks.readerConfigured = false
    const { dev } = await loadUsageSources('2026-10')
    expect(dev).toMatchObject({ counters: null, source: { status: 'unconfigured' } })
    expect(mocks.readDev).not.toHaveBeenCalled()
  })

  it('reports the reader as unavailable when it fails, and a DEV month naming PROD as a mismatch', async () => {
    deployedAs('production')
    mocks.own = { projectId: 'landly-be752' }
    mocks.readDev.mockRejectedValueOnce(new Error('PERMISSION_DENIED'))
    expect((await loadUsageSources('2026-10')).dev.source.status).toBe('unavailable')
    mocks.readDev.mockResolvedValueOnce({ projectId: 'landly-be752' })
    expect((await loadUsageSources('2026-10')).dev.source.status).toBe('mismatch')
  })

  it('carries the export’s reason through', async () => {
    mocks.fetchProd.mockRejectedValue(new PeerExportError('unconfigured', 'USAGE_EXPORT_TOKEN is not set here.'))
    const { prod, dev } = await loadUsageSources('2026-10')
    expect(prod).toMatchObject({ counters: null, source: { status: 'unconfigured', message: 'USAGE_EXPORT_TOKEN is not set here.' } })
    expect(dev.source.status).toBe('ok')
    const r = await report('?month=2026-10')
    expect(r).toMatchObject({ partial: true, available: true })
  })

  it('refuses its own counters when they name the other project', async () => {
    mocks.own = { projectId: 'landly-be752' }
    expect((await loadUsageSources('2026-10')).dev.source.status).toBe('mismatch')
  })

  it('keeps the page up when its own Firestore fails', async () => {
    mocks.ownFails = true
    const { dev, prod } = await loadUsageSources('2026-10')
    expect(dev.source.status).toBe('unavailable')
    expect(prod.source.status).toBe('ok')
  })

  it('asks for both sides at once', async () => {
    let releaseProd!: () => void
    mocks.fetchProd.mockImplementation(() => new Promise((resolve) => (releaseProd = () => resolve(prodExport(1)))))
    const pending = loadUsageSources('2026-10')
    // Its own counters are read while PROD's answer is still outstanding.
    await vi.waitFor(() => {
      expect(mocks.fetchProd).toHaveBeenCalled()
      expect(mocks.ownReads).toBeGreaterThan(0)
    })
    releaseProd()
    await expect(pending).resolves.toBeDefined()
  })

  it('reports on the two Landly projects only', async () => {
    mocks.projectId = 'demo-landly'
    await expect(loadUsageSources('2026-10')).rejects.toThrow(/reports on/)
    expect((await call()).status).toBe(502)
  })
})
