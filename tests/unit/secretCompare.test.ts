import { afterEach, describe, expect, it, vi } from 'vitest'
import { secretsEqual } from '@/lib/auth/secretCompare'
import { isAdminPassword } from '@/lib/admin/checkAdminPassword'
import { isTranzilaWebhookSecret } from '@/lib/payments/verifyWebhookSecret'

afterEach(() => vi.unstubAllEnvs())

describe('secretsEqual', () => {
  it('matches only identical strings, whatever their lengths', () => {
    expect(secretsEqual('correct horse', 'correct horse')).toBe(true)
    expect(secretsEqual('correct horse', 'correct horsf')).toBe(false)
    expect(secretsEqual('x', 'correct horse')).toBe(false)
    expect(secretsEqual('correct horse battery staple', 'correct horse')).toBe(false)
    expect(secretsEqual('', 'a')).toBe(false)
    expect(secretsEqual('סיסמה', 'סיסמה')).toBe(true)
  })
})

describe('isAdminPassword', () => {
  it('is fail-closed and exact', () => {
    expect(isAdminPassword('pw')).toBe(false)
    vi.stubEnv('ADMIN_PASSWORD', 'long-random-admin-password')
    expect(isAdminPassword('long-random-admin-password')).toBe(true)
    expect(isAdminPassword('long-random-admin-passwor')).toBe(false)
    expect(isAdminPassword('long-random-admin-password!')).toBe(false)
    expect(isAdminPassword('')).toBe(false)
    expect(isAdminPassword(null)).toBe(false)
  })
})

describe('isTranzilaWebhookSecret', () => {
  it('is fail-closed and exact', () => {
    expect(isTranzilaWebhookSecret('s3cret')).toBe(false)
    vi.stubEnv('TRANZILA_WEBHOOK_SECRET', 's3cret')
    expect(isTranzilaWebhookSecret('s3cret')).toBe(true)
    expect(isTranzilaWebhookSecret('s3cre')).toBe(false)
    expect(isTranzilaWebhookSecret('s3cretx')).toBe(false)
    expect(isTranzilaWebhookSecret(undefined)).toBe(false)
  })
})
