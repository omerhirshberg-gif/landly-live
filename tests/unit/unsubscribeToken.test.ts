import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createUnsubscribeToken, verifyUnsubscribeToken } from '@/lib/newsletter/unsubscribeToken'

describe('unsubscribe token', () => {
  const saved = { dedicated: process.env.UNSUBSCRIBE_SECRET, admin: process.env.ADMIN_SESSION_SECRET }
  beforeEach(() => {
    process.env.UNSUBSCRIBE_SECRET = 'test-secret-one'
  })
  afterEach(() => {
    process.env.UNSUBSCRIBE_SECRET = saved.dedicated
    process.env.ADMIN_SESSION_SECRET = saved.admin
    if (saved.dedicated === undefined) delete process.env.UNSUBSCRIBE_SECRET
    if (saved.admin === undefined) delete process.env.ADMIN_SESSION_SECRET
  })

  it('round-trips a lowercased email', () => {
    expect(verifyUnsubscribeToken(createUnsubscribeToken('  Dana@Example.COM '))).toBe('dana@example.com')
  })

  it('rejects a tampered payload or signature', () => {
    const [payload, sig] = createUnsubscribeToken('a@b.co').split('.')
    const forged = Buffer.from(JSON.stringify({ e: 'victim@b.co', v: 1 })).toString('base64url')
    expect(verifyUnsubscribeToken(`${forged}.${sig}`)).toBeNull()
    expect(verifyUnsubscribeToken(`${payload}.${sig!.slice(0, -2)}AA`)).toBeNull()
  })

  it('rejects malformed input', () => {
    for (const bad of [undefined, null, '', 'x', 'a.b.c', 42, 'x'.repeat(2000)]) expect(verifyUnsubscribeToken(bad)).toBeNull()
  })

  it('does not verify under a different secret', () => {
    const token = createUnsubscribeToken('a@b.co')
    process.env.UNSUBSCRIBE_SECRET = 'test-secret-two'
    expect(verifyUnsubscribeToken(token)).toBeNull()
  })

  it('falls back to a domain-separated ADMIN_SESSION_SECRET, and throws with neither', () => {
    delete process.env.UNSUBSCRIBE_SECRET
    process.env.ADMIN_SESSION_SECRET = 'admin-secret'
    const token = createUnsubscribeToken('a@b.co')
    expect(verifyUnsubscribeToken(token)).toBe('a@b.co')
    delete process.env.ADMIN_SESSION_SECRET
    expect(() => createUnsubscribeToken('a@b.co')).toThrow(/UNSUBSCRIBE_SECRET/)
  })
})
