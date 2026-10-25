import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Reading the other environment's usage counters (lib/usage/peerGuard.ts):
// which direction uses what, the reader's guards, and the HTTPS export
// client's handling of every answer it can get.

const mocks = vi.hoisted(() => ({
  apps: [] as { name: string }[],
  initializeApp: vi.fn(),
  doc: vi.fn(),
}))
vi.mock('firebase-admin/app', () => ({
  cert: (credential: unknown) => credential,
  getApps: () => mocks.apps,
  initializeApp: (options: unknown, name: string) => {
    mocks.initializeApp(options, name)
    const app = { name, options }
    mocks.apps.push(app)
    return app
  },
}))
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: (app: unknown) => ({
    collection: (name: string) => ({
      doc: (id: string) => ({ get: () => mocks.doc(app, name, id) }),
      select: () => ({ get: async () => ({ docs: [{ id: '2026-10' }, { id: '2026-09' }, { id: 'junk' }] }) }),
    }),
  }),
}))

import { assertDevReader, parsePeerExport, peerAccessFor, usageExportToken } from '@/lib/usage/peerGuard'
import { clearPeerExportCache, fetchProdUsage, PeerExportError, prodExportOrigin } from '@/lib/usage/peerUsageExport'
import { DEV_READER_APP_NAME, isDevReaderConfigured, listDevUsageMonths, readDevUsageMonth } from '@/lib/usage/peerUsageDb'
import { emptyCounters } from '@/lib/usage/usageTypes'

const TOKEN = 'x'.repeat(40)
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const exported = (extra: Record<string, unknown> = {}) => ({ projectId: 'landly-be752', month: '2026-10', months: ['2026-10'], counters: emptyCounters(), ...extra })

function onVercelProduction() {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('LANDLY_VERCEL', '1')
  vi.stubEnv('LANDLY_VERCEL_ENV', 'production')
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  mocks.apps.length = 0
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  clearPeerExportCache()
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('peerAccessFor', () => {
  it('has Production read landly-dev with the reader, and DEV deployments ask Production', () => {
    expect(peerAccessFor('production')).toEqual({ env: 'dev', projectId: 'landly-dev', via: 'peer-reader' })
    expect(peerAccessFor('preview')).toEqual({ env: 'prod', projectId: 'landly-be752', via: 'peer-export' })
    expect(peerAccessFor('local')).toEqual({ env: 'prod', projectId: 'landly-be752', via: 'peer-export' })
    expect(peerAccessFor('unchecked')).toBeNull()
  })

  it('never gives a DEV deployment direct access to PROD', () => {
    for (const target of ['local', 'preview'] as const) expect(peerAccessFor(target)?.via).not.toBe('peer-reader')
  })
})

describe('assertDevReader', () => {
  it('accepts only a landly-dev service account with a key', () => {
    expect(() => assertDevReader('usage-reader@landly-dev.iam.gserviceaccount.com', 'key')).not.toThrow()
    expect(() => assertDevReader('usage-reader@landly-be752.iam.gserviceaccount.com', 'key')).toThrow(/isn't a landly-dev service account/)
    expect(() => assertDevReader('usage-reader@evil.com', 'key')).toThrow()
    expect(() => assertDevReader('usage-reader@landly-dev.iam.gserviceaccount.com', undefined)).toThrow(/not both set/)
    expect(() => assertDevReader(undefined, 'key')).toThrow(/not both set/)
  })
})

describe('usageExportToken', () => {
  it('needs at least 32 characters', () => {
    expect(usageExportToken(undefined)).toBeNull()
    expect(usageExportToken('short')).toBeNull()
    expect(usageExportToken(`  ${TOKEN}  `)).toBe(TOKEN)
  })
})

describe('parsePeerExport', () => {
  const expected = { projectId: 'landly-be752', month: '2026-10' }

  it('keeps only the counters, cleaned', () => {
    const parsed = parsePeerExport(exported({ months: ['2026-10', 'junk'], daily: { '01': {} }, users: ['x'] }), expected)
    expect(parsed).toEqual({ ok: true, value: { projectId: 'landly-be752', month: '2026-10', months: ['2026-10'], counters: emptyCounters() } })
  })

  it('refuses another project, another month or junk', () => {
    expect(parsePeerExport(exported({ projectId: 'landly-dev' }), expected)).toMatchObject({ ok: false, status: 'mismatch' })
    expect(parsePeerExport(exported({ month: '2026-09' }), expected)).toMatchObject({ ok: false, status: 'unavailable' })
    expect(parsePeerExport(null, expected)).toMatchObject({ ok: false, status: 'unavailable' })
    expect(parsePeerExport('<html>', expected)).toMatchObject({ ok: false, status: 'unavailable' })
  })
})

describe('fetchProdUsage', () => {
  beforeEach(() => vi.stubEnv('USAGE_EXPORT_TOKEN', TOKEN))

  const failure = async () => {
    try {
      await fetchProdUsage('2026-10')
    } catch (err) {
      return err as PeerExportError
    }
    throw new Error('expected a PeerExportError')
  }

  it('asks golandly.com with the bearer token and returns its counters', async () => {
    fetchMock.mockResolvedValue(json(exported()))
    await expect(fetchProdUsage('2026-10')).resolves.toMatchObject({ projectId: 'landly-be752', month: '2026-10' })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://www.golandly.com/api/usage/export?month=2026-10')
    expect(init.headers).toEqual({ Authorization: `Bearer ${TOKEN}` })
  })

  it('keeps an answer for a minute per month', async () => {
    fetchMock.mockImplementation(async () => json(exported()))
    await fetchProdUsage('2026-10', 1_000)
    await fetchProdUsage('2026-10', 60_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await fetchProdUsage('2026-10', 61_001)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('is unconfigured without a token, and calls nobody', async () => {
    vi.stubEnv('USAGE_EXPORT_TOKEN', '')
    expect((await failure()).status).toBe('unconfigured')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    [401, 'unconfigured', /differs/],
    [404, 'unconfigured', /switched off/],
    [500, 'unavailable', /HTTP 500/],
  ])('maps HTTP %i to %s', async (status, expected, message) => {
    fetchMock.mockResolvedValue(json({ error: 'x' }, status))
    const err = await failure()
    expect(err.status).toBe(expected)
    expect(err.message).toMatch(message)
  })

  it('is unavailable when Production can’t be reached', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('timeout'), { name: 'TimeoutError' }))
    expect((await failure()).status).toBe('unavailable')
  })

  it('refuses counters that name another project, and never caches them', async () => {
    fetchMock.mockImplementation(async () => json(exported({ projectId: 'landly-dev' })))
    expect((await failure()).status).toBe('mismatch')
    expect((await failure()).status).toBe('mismatch')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('takes USAGE_PROD_EXPORT_URL over https only', () => {
    expect(prodExportOrigin(undefined)).toBe('https://www.golandly.com')
    expect(prodExportOrigin('https://landly.example/some/path')).toBe('https://landly.example')
    expect(() => prodExportOrigin('http://landly.example')).toThrow(/https/)
    expect(() => prodExportOrigin('not a url')).toThrow(PeerExportError)
  })
})

describe('the landly-dev usage reader', () => {
  const READER = 'usage-reader@landly-dev.iam.gserviceaccount.com'

  beforeEach(() => {
    vi.stubEnv('USAGE_DEV_READER_CLIENT_EMAIL', READER)
    vi.stubEnv('USAGE_DEV_READER_PRIVATE_KEY', '-----BEGIN PRIVATE KEY-----\\nx\\n-----END PRIVATE KEY-----\\n')
    mocks.doc.mockResolvedValue({ exists: true, data: () => ({ projectId: 'landly-dev', whatsapp: { authSent: 2 } }) })
  })

  it('reads on Vercel Production through its own named app, for landly-dev', async () => {
    onVercelProduction()
    expect(isDevReaderConfigured()).toBe(true)
    await expect(readDevUsageMonth('2026-10')).resolves.toMatchObject({ projectId: 'landly-dev' })
    await expect(listDevUsageMonths()).resolves.toEqual(['2026-10', '2026-09'])
    expect(mocks.initializeApp).toHaveBeenCalledOnce()
    const [options, name] = mocks.initializeApp.mock.calls[0]!
    expect(name).toBe(DEV_READER_APP_NAME)
    expect(name).not.toBe('[DEFAULT]')
    expect(options).toMatchObject({ projectId: 'landly-dev', credential: { projectId: 'landly-dev', clientEmail: READER } })
    expect(mocks.doc.mock.calls[0]!.slice(1)).toEqual(['apiUsageStats', '2026-10'])
  })

  it('refuses to start anywhere but Vercel Production', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    await expect(readDevUsageMonth('2026-10')).rejects.toThrow(/Vercel Production only/)
    expect(mocks.initializeApp).not.toHaveBeenCalled()
  })

  it('refuses a key from another project', async () => {
    onVercelProduction()
    vi.stubEnv('USAGE_DEV_READER_CLIENT_EMAIL', 'firebase-adminsdk@landly-be752.iam.gserviceaccount.com')
    await expect(readDevUsageMonth('2026-10')).rejects.toThrow(/isn't a landly-dev service account/)
    expect(mocks.initializeApp).not.toHaveBeenCalled()
  })

  it('is unconfigured without both variables', () => {
    vi.stubEnv('USAGE_DEV_READER_PRIVATE_KEY', '')
    expect(isDevReaderConfigured()).toBe(false)
  })

  it('has no way to write: no write call anywhere in its source', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'lib/usage/peerUsageDb.ts'), 'utf8')
    expect(source).not.toMatch(/\.(set|update|delete|add|create|batch|bulkWriter|runTransaction|recursiveDelete)\(/)
    expect(source).not.toMatch(/export (const|function) \w*(Db|Firestore|App)\b/)
  })
})
