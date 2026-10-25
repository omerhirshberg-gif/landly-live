import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// lib/firebase/admin.ts with the Firebase Admin SDK stubbed out: proves which
// project it would connect to, and that it refuses before connecting at all.

const initializeApp = vi.fn((options: unknown) => ({ name: '[DEFAULT]', options }))
const apps: { name: string; options: unknown }[] = []
vi.mock('firebase-admin/app', () => ({
  cert: (credential: unknown) => credential,
  getApps: () => apps,
  initializeApp: (options: unknown) => initializeApp(options),
}))
vi.mock('firebase-admin/firestore', () => ({ getFirestore: (app: unknown) => ({ app }) }))
vi.mock('firebase-admin/auth', () => ({ getAuth: (app: unknown) => ({ app }) }))

const KEY = '-----BEGIN PRIVATE KEY-----\\nx\\n-----END PRIVATE KEY-----\\n'

function stubFirebaseEnv(projectId: string, deploy: { vercel: string; vercelEnv: string; nodeEnv: string }) {
  vi.stubEnv('NODE_ENV', deploy.nodeEnv)
  vi.stubEnv('LANDLY_VERCEL', deploy.vercel)
  vi.stubEnv('LANDLY_VERCEL_ENV', deploy.vercelEnv)
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', projectId)
  vi.stubEnv('FIREBASE_ADMIN_PROJECT_ID', projectId)
  vi.stubEnv('FIREBASE_ADMIN_CLIENT_EMAIL', `firebase-adminsdk-x@${projectId}.iam.gserviceaccount.com`)
  vi.stubEnv('FIREBASE_ADMIN_PRIVATE_KEY', KEY)
}

const LOCAL_DEV = { vercel: '', vercelEnv: '', nodeEnv: 'development' }
const LOCAL_START = { vercel: '', vercelEnv: '', nodeEnv: 'production' }
const PREVIEW = { vercel: '1', vercelEnv: 'preview', nodeEnv: 'production' }
const PRODUCTION = { vercel: '1', vercelEnv: 'production', nodeEnv: 'production' }

async function adminDb() {
  const { getAdminDb } = await import('@/lib/firebase/admin')
  return getAdminDb()
}

beforeEach(() => {
  vi.resetModules()
  initializeApp.mockClear()
  apps.length = 0
})
afterEach(() => vi.unstubAllEnvs())

describe('getAdminDb project selection', () => {
  it.each([
    ['localhost next dev', LOCAL_DEV, 'landly-dev'],
    ['localhost next start', LOCAL_START, 'landly-dev'],
    ['Vercel Preview', PREVIEW, 'landly-dev'],
    ['Vercel Production', PRODUCTION, 'landly-be752'],
  ])('%s connects to %s', async (_, deploy, projectId) => {
    stubFirebaseEnv(projectId as string, deploy as typeof LOCAL_DEV)
    await adminDb()
    expect(initializeApp).toHaveBeenCalledOnce()
    expect(initializeApp.mock.calls[0]![0]).toMatchObject({ credential: { projectId } })
  })

  it.each([
    ['localhost next dev', LOCAL_DEV, 'landly-be752'],
    ['localhost next start', LOCAL_START, 'landly-be752'],
    ['Vercel Preview', PREVIEW, 'landly-be752'],
    ['Vercel Production', PRODUCTION, 'landly-dev'],
  ])('%s refuses %s without connecting', async (_, deploy, projectId) => {
    stubFirebaseEnv(projectId as string, deploy as typeof LOCAL_DEV)
    await expect(adminDb()).rejects.toThrow(/Firebase Admin/)
    expect(initializeApp).not.toHaveBeenCalled()
  })

  it('refuses a production service account behind the landly-dev project ID locally', async () => {
    stubFirebaseEnv('landly-dev', LOCAL_DEV)
    vi.stubEnv('FIREBASE_ADMIN_CLIENT_EMAIL', 'firebase-adminsdk-x@landly-be752.iam.gserviceaccount.com')
    await expect(adminDb()).rejects.toThrow(/isn't a landly-dev service account/)
    expect(initializeApp).not.toHaveBeenCalled()
  })
})

describe('getAdminDb with another app in the process', () => {
  // A named app for another project, created first, must not become getAdminDb()'s.
  it('never takes another named app for its own', async () => {
    stubFirebaseEnv('landly-be752', PRODUCTION)
    apps.push({ name: 'usage-reader:landly-dev', options: { projectId: 'landly-dev' } })
    const db = (await adminDb()) as unknown as { app: { options: unknown } }
    expect(initializeApp).toHaveBeenCalledOnce()
    expect(db.app.options).toMatchObject({ credential: { projectId: 'landly-be752' } })
  })

  it('reuses its own default app', async () => {
    stubFirebaseEnv('landly-be752', PRODUCTION)
    const own = { name: '[DEFAULT]', options: { credential: { projectId: 'landly-be752' } } }
    apps.push({ name: 'usage-reader:landly-dev', options: { projectId: 'landly-dev' } }, own)
    const db = (await adminDb()) as unknown as { app: unknown }
    expect(initializeApp).not.toHaveBeenCalled()
    expect(db.app).toBe(own)
  })
})
