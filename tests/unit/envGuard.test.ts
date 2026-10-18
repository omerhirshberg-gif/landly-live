import { describe, expect, it } from 'vitest'
import { assertDevAdminCredentials, assertDevFirebaseProject } from '@/lib/firebase/envGuard'

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

describe('assertDevAdminCredentials', () => {
  const staging = {
    projectId: 'landly-dev',
    clientEmail: 'firebase-adminsdk-abc@landly-dev.iam.gserviceaccount.com',
    privateKey: '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n',
    clientProjectId: 'landly-dev',
    isDevelopment: true,
  }

  it('accepts a staging service account matching the client project', () => {
    expect(() => assertDevAdminCredentials(staging)).not.toThrow()
  })
  it('refuses the production project', () => {
    expect(() => assertDevAdminCredentials({ ...staging, projectId: 'landly-be752', clientProjectId: 'landly-be752' })).toThrow(/production/)
  })
  it('refuses a project that differs from the client SDK', () => {
    expect(() => assertDevAdminCredentials({ ...staging, clientProjectId: 'landly-other' })).toThrow(/doesn't match/)
  })
  it('refuses missing credentials (the blanked .env.local lines)', () => {
    expect(() => assertDevAdminCredentials({ ...staging, clientEmail: '', privateKey: undefined })).toThrow(/no service account for landly-dev/)
  })
  it('refuses a production key paired with the staging project ID', () => {
    expect(() =>
      assertDevAdminCredentials({ ...staging, clientEmail: 'firebase-adminsdk-abc@landly-be752.iam.gserviceaccount.com' }),
    ).toThrow(/isn't a landly-dev service account/)
  })
  it('leaves production builds alone', () => {
    expect(() =>
      assertDevAdminCredentials({ projectId: 'landly-be752', clientEmail: undefined, privateKey: undefined, clientProjectId: undefined, isDevelopment: false }),
    ).not.toThrow()
  })
})
