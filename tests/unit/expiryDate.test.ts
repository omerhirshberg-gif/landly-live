import { describe, expect, it } from 'vitest'
import { endOfIsraelDay } from '@/lib/admin/expiryDate'

describe('endOfIsraelDay', () => {
  it('ends a summer day at 23:59:59.999 Israel time (UTC+3)', () => {
    expect(endOfIsraelDay('2026-07-15').toISOString()).toBe('2026-07-15T20:59:59.999Z')
  })

  it('ends a winter day at 23:59:59.999 Israel time (UTC+2)', () => {
    expect(endOfIsraelDay('2026-12-01').toISOString()).toBe('2026-12-01T21:59:59.999Z')
  })

  it('follows the clock change on the days it happens', () => {
    // Summer time starts the Friday before the last Sunday of March and ends the last Sunday of October.
    expect(endOfIsraelDay('2026-03-27').toISOString()).toBe('2026-03-27T20:59:59.999Z')
    expect(endOfIsraelDay('2026-10-25').toISOString()).toBe('2026-10-25T21:59:59.999Z')
  })

  it('keeps the offer live through its last day, and the edit form reads back the same date', () => {
    const expiry = endOfIsraelDay('2026-10-20')
    expect(expiry.getTime()).toBeGreaterThan(new Date('2026-10-20T23:30:00+03:00').getTime())
    expect(expiry.getTime()).toBeLessThan(new Date('2026-10-21T00:00:00+03:00').getTime())
    expect(expiry.toISOString().slice(0, 10)).toBe('2026-10-20')
  })

  it('parses anything else as before', () => {
    expect(endOfIsraelDay('2026-10-20T12:00:00Z').toISOString()).toBe('2026-10-20T12:00:00.000Z')
    expect(Number.isNaN(endOfIsraelDay('not a date').getTime())).toBe(true)
  })
})
