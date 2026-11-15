import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearOverlay, getOverlayVersion, markPhoneVerified, overlayFor, overlaySettled, subscribeOverlays, withVerifiedPhone } from '@/lib/firebase/liveUserOverlay'
import type { UserDocument } from '@/lib/firebase/users'

const profile = (over: Partial<UserDocument> = {}): UserDocument =>
  ({ email: 'a@b.co', phone: '+972500000001', customerType: 'tourist', onboardingCompleted: true, phoneVerified: false, pendingPhone: '+972525714422', ...over }) as UserDocument

const NEW = '+972525714422'

afterEach(() => clearOverlay('u1'))

describe('live user overlay', () => {
  it('lays the verified number over a stale snapshot: no pending change, phone verified', () => {
    markPhoneVerified('u1', NEW)
    const shown = withVerifiedPhone(profile(), overlayFor('u1'))
    expect(shown).toMatchObject({ phone: NEW, phoneVerified: true, pendingPhone: '' })
    expect(profile()).toMatchObject({ phoneVerified: false, pendingPhone: NEW })
  })

  it('leaves the snapshot alone without an overlay, and for a missing document', () => {
    const p = profile()
    expect(withVerifiedPhone(p, undefined)).toBe(p)
    markPhoneVerified('u1', NEW)
    expect(withVerifiedPhone(null, overlayFor('u1'))).toBeNull()
  })

  it('is settled once a snapshot shows the verified number', () => {
    markPhoneVerified('u1', NEW)
    const overlay = overlayFor('u1')!
    const confirmed = profile({ phone: NEW, phoneVerified: true, pendingPhone: '' })
    expect(overlaySettled(confirmed, overlay)).toBe(true)
    expect(withVerifiedPhone(confirmed, overlay)).toBe(confirmed)
    expect(overlaySettled(profile(), overlay)).toBe(false)
    expect(overlaySettled(null, overlay)).toBe(false)
  })

  it('gives way to a newer pending change instead of hiding it', () => {
    markPhoneVerified('u1', NEW)
    const overlay = overlayFor('u1')!
    const another = profile({ phoneVerified: true, pendingPhone: '+972501111111' })
    expect(overlaySettled(another, overlay)).toBe(true)
    expect(withVerifiedPhone(another, overlay)).toBe(another)
  })

  it('notifies subscribers when set and cleared', () => {
    const listener = vi.fn()
    const off = subscribeOverlays(listener)
    const before = getOverlayVersion()
    markPhoneVerified('u1', NEW)
    clearOverlay('u1')
    clearOverlay('u1')
    off()
    expect(listener).toHaveBeenCalledTimes(2)
    expect(getOverlayVersion()).toBe(before + 2)
    expect(overlayFor('u1')).toBeUndefined()
    expect(overlayFor(null)).toBeUndefined()
  })
})
