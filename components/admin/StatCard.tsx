import Link from 'next/link'
import Card from './Card'
import { useAdminT } from '@/lib/admin/translations'

const ACCENT_CLASSES = {
  blue: 'bg-adm-accent-soft text-adm-accent',
  amber: 'bg-adm-warn-soft text-adm-warn',
  emerald: 'bg-adm-ok-soft text-adm-ok',
  violet: 'bg-adm-violet-soft text-adm-violet',
} as const

interface StatCardProps {
  label: string
  value: number | null
  icon: string
  accent?: keyof typeof ACCENT_CLASSES
  emptyHint?: string
  /** The dashboard's compact tile: label and a small icon on top, the figure and a chevron below. */
  variant?: 'default' | 'compact'
  /** Makes the whole tile a link to the list it counts. */
  href?: string
}

export default function StatCard({ label, value, icon, accent = 'blue', emptyHint, variant = 'default', href }: StatCardProps) {
  const { t, dir } = useAdminT()

  if (variant === 'compact') {
    const body = (
      <>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 text-sm font-medium text-adm-text-2">{label}</div>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm ${ACCENT_CLASSES[accent]}`}>
            <i className={`fa-solid ${icon}`} aria-hidden="true" />
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between gap-2">
          {value === null ? (
            <div aria-label={t('stat.loading')} className="h-9 w-14 rounded-lg bg-adm-raised motion-safe:animate-pulse" />
          ) : (
            <div className="text-3xl font-extrabold leading-none tracking-tight text-adm-text tabular-nums">
              <bdi dir="ltr">{value}</bdi>
            </div>
          )}
          {href && <i className={`fa-solid fa-chevron-right ${dir === 'rtl' ? '-scale-x-100' : ''} pb-1 text-xs text-adm-hint transition-colors group-hover:text-adm-accent`} aria-hidden="true" />}
        </div>
      </>
    )
    const frame = 'flex min-h-[116px] flex-col justify-between p-4 sm:p-5'
    if (href) {
      return (
        <Link
          href={href}
          className={`group ${frame} rounded-2xl border border-adm-line bg-adm-surface transition-colors hover:border-adm-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent/50 [-webkit-tap-highlight-color:transparent]`}
        >
          {body}
        </Link>
      )
    }
    return <Card className={frame}>{body}</Card>
  }

  return (
    // Two to a row even on a phone, so the padding, number and icon shrink below sm.
    <Card className="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-adm-text-2">{label}</div>
          {value === null ? (
            <div aria-label={t('stat.loading')} className="mt-3 h-8 w-14 rounded-lg bg-adm-raised motion-safe:animate-pulse sm:h-9 sm:w-16" />
          ) : (
            <div className="mt-2 text-3xl font-extrabold tracking-tight text-adm-text tabular-nums sm:text-4xl">
              <bdi dir="ltr">{value}</bdi>
            </div>
          )}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base sm:h-12 sm:w-12 sm:text-lg ${ACCENT_CLASSES[accent]}`}>
          <i className={`fa-solid ${icon}`} aria-hidden="true" />
        </div>
      </div>
      {value === 0 && emptyHint && <div className="mt-3 text-xs text-adm-muted">{emptyHint}</div>}
    </Card>
  )
}
