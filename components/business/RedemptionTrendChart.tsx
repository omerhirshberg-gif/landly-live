'use client'

import { useMemo, useState } from 'react'
import DashboardSectionCard from '@/components/business/DashboardSectionCard'
import { useBusinessLang } from '@/lib/business/BusinessLangProvider'

interface RedeemedVoucher {
  id: string
  offerTitle: string
  redeemedAt: string | null
}

interface DayBucket {
  key: string
  label: string
  count: number
}

const LOCALES: Record<'he' | 'en', string> = { he: 'he-IL', en: 'en-US' }

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// Local calendar-day key (not UTC) -- Israel is UTC+3, so a naive
// `date.toISOString().slice(0, 10)` on a local midnight Date rolls back to
// the previous day for anyone in that timezone (local 00:00 is the previous
// day 21:00 UTC), which silently shifted the whole chart back a day.
function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Month-to-date: the 1st of the current month through today, inclusive --
// not a rolling 30-day window, so the chart resets at the start of each
// month alongside "Redeemed This Month" above. Bucketed by the redemption's
// local calendar day, matching the local "today" the range is built from.
function buildBuckets(vouchers: RedeemedVoucher[], locale: string): DayBucket[] {
  const buckets = new Map<string, number>()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daysElapsed = today.getDate() // day-of-month == days from the 1st through today
  for (let i = daysElapsed - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    buckets.set(localDayKey(d), 0)
  }
  for (const v of vouchers) {
    if (!v.redeemedAt) continue
    const key = localDayKey(new Date(v.redeemedAt))
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  return Array.from(buckets.entries()).map(([key, count]) => ({
    key,
    // No trailing "Z"/offset -- parsed as local time, so this renders the
    // same calendar day the key represents, in any timezone.
    label: new Date(`${key}T00:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
    count,
  }))
}

// Daily redemption counts for the current month, from the same
// /api/business/vouchers?status=redeemed data as the Redemption History
// page -- this just buckets it by day instead of listing every row. The
// chart itself (bars + axis) always renders, even with zero redemptions --
// every bar then sits at its minimum height, reading as a flat zero line
// with real axis labels, rather than disappearing behind a text placeholder.
export default function RedemptionTrendChart({
  vouchers,
  error,
}: {
  vouchers: RedeemedVoucher[] | null
  error: string | null
}) {
  const { t, lang } = useBusinessLang()
  const [hovered, setHovered] = useState<number | null>(null)
  const locale = LOCALES[lang]
  const buckets = useMemo(() => (vouchers ? buildBuckets(vouchers, locale) : []), [vouchers, locale])
  const total = buckets.reduce((sum, b) => sum + b.count, 0)
  const max = Math.max(1, ...buckets.map((b) => b.count))
  const midIndex = Math.floor((buckets.length - 1) / 2)

  return (
    <DashboardSectionCard
      title={t('bizdash_section_trend')}
      meta={<span className="text-xs text-slate-500 font-semibold">{t('bizdash_trend_subtitle')}</span>}
    >
      {error && <p className="text-sm font-semibold text-red-400">{error}</p>}
      {!error && vouchers === null && <p className="text-slate-400 text-sm">{t('bizdash_loading')}</p>}

      {!error && vouchers !== null && (
        <div>
          {total === 0 && <p className="text-xs text-slate-500 mb-2">{t('bizdash_trend_empty')}</p>}

          <div className="flex items-end gap-[3px] h-24" onMouseLeave={() => setHovered(null)}>
            {buckets.map((b, i) => (
              <div
                key={b.key}
                title={`${b.label}: ${b.count}`}
                className={`flex-1 min-w-0 rounded-t-[3px] transition-colors cursor-default ${
                  hovered === i ? 'bg-blue-400' : 'bg-blue-400/70'
                }`}
                style={{ height: `${Math.max(4, (b.count / max) * 100)}%` }}
                onMouseEnter={() => setHovered(i)}
              />
            ))}
          </div>

          <div className="border-t border-white/10 mt-1 pt-1.5 flex items-center justify-between text-[10px] font-semibold text-slate-600">
            <span>{buckets[0]?.label}</span>
            <span>{buckets[midIndex]?.label}</span>
            <span>{buckets[buckets.length - 1]?.label}</span>
          </div>

          <div className="h-4 text-xs font-semibold text-slate-300 mt-1">
            {hovered !== null ? `${buckets[hovered].label} · ${buckets[hovered].count}` : ''}
          </div>
        </div>
      )}
    </DashboardSectionCard>
  )
}
