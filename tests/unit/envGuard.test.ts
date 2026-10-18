import { describe, expect, it } from 'vitest'
import {
  assertAdminCredentials,
  assertDevFirebaseProject,
  assertFirebaseConfigConsistent,
  assertFirebaseProjectForTarget,
  firebaseDeployTarget,
} from '@/lib/firebase/envGuard'

describe('assertDevFirebaseProject', () => {
  it('accepts the staging project in development', () => {
    expect(() => assertDevFirebaseProject('landly-dev', true)).not.toThrow()
  })
  it('refuses the production project in development', () => {
    expect(() => assertDevFirebaseProject('landly-be752', true)).toThrow(/production project \(landly-be752\)/)
  })
  it('refuses a missing project in development', () => {
    expect(() => assertDevFirebaseProject(undefined, true)).toThrow(/no Firebase project ID/)
    expect(() => assertDevFirebaseProject('', true)).toThrow(/no Firebase project ID/)
  })
  it('leaves production builds alone', () => {
    expect(() => assertDevFirebaseProject('landly-be752', false)).not.toThrow()
    expect(() => assertDevFirebaseProject(undefined, false)).not.toThrow()
  })
})

describe('assertAdminCredentials', () => {
  const staging = {
    projectId: 'landly-dev',
    clientEmail: 'firebase-adminsdk-abc@landly-dev.iam.gserviceaccount.com',
    privateKey: '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n',
    clientProjectId: 'landly-dev',
    target: 'local' as const,
  }

  it('accepts a staging service account matching the client project', () => {
    expect(() => assertAdminCredentials(staging)).not.toThrow()
  })
  it('refuses the production project', () => {
    expect(() => assertAdminCredentials({ ...staging, projectId: 'landly-be752', clientProjectId: 'landly-be752' })).toThrow(/production/)
  })
  it('refuses a project that differs from the client SDK', () => {
    expect(() => assertAdminCredentials({ ...staging, clientProjectId: 'landly-other' })).toThrow(/doesn't match/)
  })
  it('refuses missing credentials (the blanked .env.local lines)', () => {
    expect(() => assertAdminCredentials({ ...staging, clientEmail: '', privateKey: undefined })).toThrow(/no service account for landly-dev/)
  })
  it('refuses a production key paired with the staging project ID', () => {
    expect(() =>
      assertAdminCredentials({ ...staging, clientEmail: 'firebase-adminsdk-abc@landly-be752.iam.gserviceaccount.com' }),
    ).toThrow(/isn't a landly-dev service account/)
  })
  it('leaves unit tests alone', () => {
    expect(() =>
      assertAdminCredentials({ projectId: 'landly-be752', clientEmail: undefined, privateKey: undefined, clientProjectId: undefined, target: 'unchecked' }),
    ).not.toThrow()
  })

  const production = {
    projectId: 'landly-be752',
    clientEmail: 'firebase-adminsdk-abc@landly-be752.iam.gserviceaccount.com',
    privateKey: '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n',
    clientProjectId: 'landly-be752',
    target: 'production' as const,
  }
  it('accepts the production service account on Vercel Production', () => {
    expect(() => assertAdminCredentials(production)).not.toThrow()
  })
  it('refuses the staging project on Vercel Production', () => {
    expect(() => assertAdminCredentials({ ...staging, target: 'production' })).toThrow(/must use landly-be752/)
  })
  it('accepts staging and refuses production on Vercel Preview', () => {
    expect(() => assertAdminCredentials({ ...staging, target: 'preview' })).not.toThrow()
    expect(() => assertAdminCredentials({ ...production, target: 'preview' })).toThrow(/preview deployment must use landly-dev/)
  })
})

describe('firebaseDeployTarget', () => {
  it('treats every non-Vercel run as local, including a local next start', () => {
    expect(firebaseDeployTarget({ vercel: undefined, vercelEnv: undefined, nodeEnv: 'development' })).toBe('local')
    expect(firebaseDeployTarget({ vercel: '', vercelEnv: '', nodeEnv: 'production' })).toBe('local')
    expect(firebaseDeployTarget({ vercel: '', vercelEnv: 'production', nodeEnv: 'production' })).toBe('local')
  })
  it('maps Vercel environments', () => {
    expect(firebaseDeployTarget({ vercel: '1', vercelEnv: 'production', nodeEnv: 'production' })).toBe('production')
    expect(firebaseDeployTarget({ vercel: '1', vercelEnv: 'preview', nodeEnv: 'production' })).toBe('preview')
    expect(firebaseDeployTarget({ vercel: '1', vercelEnv: 'development', nodeEnv: 'development' })).toBe('local')
  })
  it('skips unit tests', () => {
    expect(firebaseDeployTarget({ vercel: '1', vercelEnv: 'production', nodeEnv: 'test' })).toBe('unchecked')
  })
})

describe('assertFirebaseProjectForTarget', () => {
  it('requires landly-be752 on Vercel Production', () => {
    expect(() => assertFirebaseProjectForTarget('landly-be752', 'production')).not.toThrow()
    expect(() => assertFirebaseProjectForTarget('landly-dev', 'production')).toThrow(/must use landly-be752/)
    expect(() => assertFirebaseProjectForTarget(undefined, 'production')).toThrow(/must use landly-be752/)
  })
  it('requires landly-dev on Vercel Preview', () => {
    expect(() => assertFirebaseProjectForTarget('landly-dev', 'preview')).not.toThrow()
    expect(() => assertFirebaseProjectForTarget('landly-be752', 'preview')).toThrow(/must use landly-dev/)
  })
  it('refuses production locally', () => {
    expect(() => assertFirebaseProjectForTarget('landly-dev', 'local')).not.toThrow()
    expect(() => assertFirebaseProjectForTarget('landly-be752', 'local')).toThrow(/production project/)
  })
})

describe('assertFirebaseConfigConsistent', () => {
  const dev = { projectId: 'landly-dev', storageBucket: 'landly-dev.firebasestorage.app', authDomain: 'landly-dev.firebaseapp.com' }

  it('accepts a config whose bucket and authDomain name its project', () => {
    expect(() => assertFirebaseConfigConsistent(dev, 'local')).not.toThrow()
  })
  it('refuses the production bucket behind the staging project (a missing .env.local line)', () => {
    expect(() => assertFirebaseConfigConsistent({ ...dev, storageBucket: 'landly-be752.firebasestorage.app' }, 'local')).toThrow(
      /STORAGE_BUCKET \(landly-be752\.firebasestorage\.app\) doesn't belong to landly-dev/,
    )
  })
  it('refuses the production authDomain behind the staging project', () => {
    expect(() => assertFirebaseConfigConsistent({ ...dev, authDomain: 'landly-be752.firebaseapp.com' }, 'preview')).toThrow(/AUTH_DOMAIN/)
  })
  it('allows our own host as authDomain', () => {
    expect(() =>
      assertFirebaseConfigConsistent(
        { projectId: 'landly-be752', storageBucket: 'landly-be752.firebasestorage.app', authDomain: 'www.golandly.com' },
        'production',
      ),
    ).not.toThrow()
  })
  it('leaves unchecked builds alone', () => {
    expect(() => assertFirebaseConfigConsistent({ ...dev, storageBucket: 'landly-be752.appspot.com' }, 'unchecked')).not.toThrow()
  })
})
