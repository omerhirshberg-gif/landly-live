'use client'

import { Gift, PiggyBank, Ticket, type LucideIcon } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { formatSavings } from '@/lib/format'

// The /member snapshot row: Active Perks, Perks Redeemed, Total Saved. The
// three cards stretch to one height; each label sits in the same 36px band
// (room for two lines, centred, so a one-line label lines up with a wrapped
// one), and mt-auto pins every number to the card's bottom, so the numbers
// share a baseline in every language. A label that needs a third line grows
// its card, and grid stretch carries the other two along. null shows "–"
// while a live value loads (app/member/page.tsx). From 1024px the row
// stacks into the page's side rail, one card per row.
export default function DashboardStats({
  activePerks = 0,
  redeemed = 0,
  saved = 0,
}: {
  activePerks?: number | null
  redeemed?: number | null
  saved?: number | null
}) {
  const { t, lang } = useLang()
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mb-5 lg:grid-cols-1 lg:gap-3 lg:mb-0">
      <StatCard icon={Ticket} label={t('dash_active_perks_label')} value={activePerks === null ? '–' : String(activePerks)} />
      <StatCard icon={Gift} label={t('dash_perks_redeemed_label')} value={redeemed === null ? '–' : String(redeemed)} />
      <StatCard icon={PiggyBank} label={t('dash_total_saved')} value={saved === null ? '–' : formatSavings(saved, lang)} />
    </div>
  )
}

// Tighter side padding on phones than .dash-stat-card's 20px, so "₪0" and
// two-word labels fit a third of a 320px screen. Each icon sits in a quiet
// 36px slate frame with a hairline, one dark ink line glyph at a 1.5 stroke:
// no tinted discs, no green or cyan.
function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex h-full min-h-[96px] min-w-0 flex-col items-center rounded-2xl border border-slate-100 bg-white px-2 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] text-center sm:min-h-[112px] sm:px-4 sm:py-[18px]">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-ink">
        <Icon aria-hidden="true" focusable="false" className="h-[18px] w-[18px]" strokeWidth={1.5} />
      </span>
      <div className="mt-1.5 sm:mt-2 flex min-h-[36px] w-full items-center justify-center text-micro sm:text-xs font-semibold leading-tight text-slate-500 break-words">
        {label}
      </div>
      <div className="mt-auto pt-1 text-base md:text-lg font-bold leading-none text-ink whitespace-nowrap tabular-nums">{value}</div>
    </div>
  )
}
