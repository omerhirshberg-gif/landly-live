// Every date the admin shows, in the Israeli format and on Israel's clock
// whatever the browser's locale or time zone: "23.10.2026" and
// "23.10.2026 17:36" (24-hour). Pure, so the unit tests can pin it.

const ISRAEL = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jerusalem',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function israelParts(value: Date | string | null | undefined) {
  if (!value) return null
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return null
  const parts = Object.fromEntries(ISRAEL.formatToParts(date).map((part) => [part.type, part.value]))
  return { date: `${parts.day}.${parts.month}.${parts.year}`, time: `${parts.hour}:${parts.minute}` }
}

/** "23.10.2026", or '—' for a missing or invalid date. */
export function formatIsraeliDate(value: Date | string | null | undefined): string {
  return israelParts(value)?.date ?? '—'
}

/** "23.10.2026 17:36", or '—' for a missing or invalid date. */
export function formatIsraeliDateTime(value: Date | string | null | undefined): string {
  const parts = israelParts(value)
  return parts ? `${parts.date} ${parts.time}` : '—'
}
