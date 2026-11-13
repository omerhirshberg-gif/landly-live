import { describe, expect, it } from 'vitest'
import {
  APP_LOCK_DELAYS,
  APP_LOCK_DELAY_MS,
  DEFAULT_APP_LOCK_DELAY,
  isLongerDelay,
  parseAppLockDelay,
  shouldRelock,
} from '@/lib/auth/appLockPolicy'

describe('app lock delay', () => {
  it('defaults to one minute, as the app always did', () => {
    expect(DEFAULT_APP_LOCK_DELAY).toBe('1m')
    expect(APP_LOCK_DELAY_MS).toEqual({ immediately: 0, '1m': 60_000, '5m': 300_000 })
  })

  it('parses stored values and falls back to the default', () => {
    for (const d of APP_LOCK_DELAYS) expect(parseAppLockDelay(d)).toBe(d)
    for (const bad of [null, undefined, '', '10m', '1', 'IMMEDIATELY']) expect(parseAppLockDelay(bad)).toBe('1m')
  })

  it('relocks on any return when immediate', () => {
    expect(shouldRelock(0, 'immediately')).toBe(true)
    expect(shouldRelock(1, 'immediately')).toBe(true)
  })

  it('relocks only past the delay otherwise', () => {
    expect(shouldRelock(60_000, '1m')).toBe(false)
    expect(shouldRelock(60_001, '1m')).toBe(true)
    expect(shouldRelock(299_999, '5m')).toBe(false)
    expect(shouldRelock(300_001, '5m')).toBe(true)
  })

  it('asks for a biometric check only when the delay gets longer', () => {
    expect(isLongerDelay('immediately', '1m')).toBe(true)
    expect(isLongerDelay('1m', '5m')).toBe(true)
    expect(isLongerDelay('5m', '1m')).toBe(false)
    expect(isLongerDelay('1m', 'immediately')).toBe(false)
    expect(isLongerDelay('1m', '1m')).toBe(false)
  })
})
