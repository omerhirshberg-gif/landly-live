import { describe, expect, it } from 'vitest'
import { addYearsEndOfIsraelDayMs } from '@/lib/payments/voucherTerms'

// Five calendar years from purchase, ending at 23:59:59 Israel time, whatever the server's timezone.
const israel = (ms: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(ms))

describe('addYearsEndOfIsraelDayMs', () => {
  it('lands on the same date five years on, at the end of the day', () => {
    expect(israel(addYearsEndOfIsraelDayMs(Date.parse('2026-11-17T09:30:00Z'), 5))).toBe('2031-11-17, 23:59:59')
  })

  it('is a calendar add, not 1825 days: a span with a leap year is a day longer', () => {
    // 2026-03-01 to 2031-03-01 contains 29 Feb 2028, so it is 1826 days.
    expect(israel(addYearsEndOfIsraelDayMs(Date.parse('2026-03-01T10:00:00Z'), 5))).toBe('2031-03-01, 23:59:59')
  })

  it('moves 29 February to 28 February when the target year has none', () => {
    expect(israel(addYearsEndOfIsraelDayMs(Date.parse('2028-02-29T10:00:00Z'), 5))).toBe('2033-02-28, 23:59:59')
    // Four years on is a leap year again: the day is kept.
    expect(israel(addYearsEndOfIsraelDayMs(Date.parse('2024-02-29T10:00:00Z'), 4))).toBe('2028-02-29, 23:59:59')
  })

  it('uses the Israeli date of a late-evening UTC purchase', () => {
    // 22:30 UTC on 31 Dec is already 1 Jan in Israel.
    expect(israel(addYearsEndOfIsraelDayMs(Date.parse('2026-12-31T22:30:00Z'), 5))).toBe('2032-01-01, 23:59:59')
  })

  it('gets summer and winter time right at either end', () => {
    expect(israel(addYearsEndOfIsraelDayMs(Date.parse('2026-07-10T10:00:00Z'), 5))).toBe('2031-07-10, 23:59:59')
    expect(israel(addYearsEndOfIsraelDayMs(Date.parse('2026-01-10T10:00:00Z'), 5))).toBe('2031-01-10, 23:59:59')
  })
})
