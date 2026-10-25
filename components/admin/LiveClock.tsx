'use client'

import { useEffect, useState } from 'react'

const TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jerusalem',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

const SHORT_TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jerusalem',
  hour: '2-digit',
  minute: '2-digit',
})

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jerusalem',
  weekday: 'short',
  day: '2-digit',
  month: 'short',
})

/** `compact`: just HH:MM, `muted` for a quiet label beside the header's title. */
export default function LiveClock({ compact = false, muted = false }: { compact?: boolean; muted?: boolean }) {
  // Starts null so the server-rendered/first-paint markup has nothing
  // time-dependent to mismatch against -- the real value fills in on mount.
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  if (!now) return null

  if (compact) {
    return (
      <span className={`tabular-nums ${muted ? 'text-xs font-medium text-slate-400' : 'text-sm font-semibold text-[#0B1B3D]'}`} dir="ltr">
        {SHORT_TIME_FORMAT.format(now)}
      </span>
    )
  }

  return (
    <div
      className="inline-flex h-10 items-center gap-2.5 rounded-full border border-[#E2E8F0] bg-white px-4 shadow-sm"
      dir="ltr"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="text-sm font-semibold text-[#0B1B3D] tabular-nums">{TIME_FORMAT.format(now)}</span>
      <span className="text-xs font-medium text-[#94A3B8]">{DATE_FORMAT.format(now)} · Jerusalem</span>
    </div>
  )
}
