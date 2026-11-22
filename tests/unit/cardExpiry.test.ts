import { describe, expect, it } from 'vitest'
import { expiryPill } from '@/lib/offers/cardExpiry'

const now = Date.parse('2026-03-10T09:00:00Z')
const H = 3600_000

describe('expiryPill', () => {
  it('is null without a date', () => {
    expect(expiryPill(null, now)).toBeNull()
    expect(expiryPill(undefined, now)).toBeNull()
    expect(expiryPill(new Date('x'), now)).toBeNull()
  })
  it('turns urgent within 48 hours and says tomorrow on the next Israeli day', () => {
    const pill = expiryPill(new Date(now + 24 * H), now)!
    expect(pill.kind).toBe('urgent')
    expect(pill.key).toBe('card_expires_tomorrow')
    expect(pill.date).toBe('11.03')
  })
  it('stays urgent but names the date when it is two days away', () => {
    const pill = expiryPill(new Date(now + 47 * H), now)!
    expect(pill.kind).toBe('urgent')
    expect(pill.key).toBe('card_expires_on')
  })
  it('is normal beyond 48 hours and expired in the past', () => {
    expect(expiryPill(new Date(now + 10 * 24 * H), now)!.kind).toBe('normal')
    expect(expiryPill(new Date(now - H), now)!.kind).toBe('expired')
  })
})
