// The admin form's expiry date is a calendar day ("2026-10-20", an
// <input type="date">). It's stored as the last moment of that day in
// Israel, so an offer stays live through its whole last day:
// `new Date("2026-10-20")` alone is midnight UTC, which hid it from 02:00 or
// 03:00 Israel time that morning. 23:59:59.999 in Israel is still the same
// day in UTC, so the edit form's toISOString().slice(0, 10) reads it back
// unchanged, as it does offers saved before this.
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

const israelClock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Jerusalem',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** How far Israel's wall clock is ahead of UTC at that instant (2h in winter, 3h in summer). */
function israelOffsetMs(at: number): number {
  const parts = Object.fromEntries(israelClock.formatToParts(new Date(at)).map((part) => [part.type, part.value]))
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  return wall - Math.floor(at / 1000) * 1000
}

/** 23:59:59.999 Israel time on that day; anything but a plain YYYY-MM-DD is parsed as before. */
export function endOfIsraelDay(value: string): Date {
  const match = DATE_ONLY.exec(value)
  if (!match) return new Date(value)
  const wall = Date.UTC(+match[1], +match[2] - 1, +match[3], 23, 59, 59, 999)
  // Israel changes clocks at 02:00, never near midnight, so the offset at a
  // first guess is the offset at the answer.
  return new Date(wall - israelOffsetMs(wall - israelOffsetMs(wall)))
}
