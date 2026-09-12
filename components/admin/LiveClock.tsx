'use client'

import { useEffect, useState } from 'react'

const TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jerusalem',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jerusalem',
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export default function LiveClock({ compact = false }: { compact?: boolean }) {
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
      <div className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
        <span className="text-sm font-bold text-slate-200 tabular-nums">{TIME_FORMAT.format(now)}</span>
      </div>
    )
  }

  return (
    <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-5 py-2.5">
      <div className="text-right leading-none">
        <div className="text-xl font-black text-white tabular-nums">{TIME_FORMAT.format(now)}</div>
        <div className="flex items-center justify-end gap-1.5 text-xs font-semibold text-slate-500 mt-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          {DATE_FORMAT.format(now)} · Jerusalem
        </div>
      </div>
    </div>
  )
}
