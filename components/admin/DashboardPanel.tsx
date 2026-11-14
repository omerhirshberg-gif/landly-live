import Link from 'next/link'
import { useAdminT } from '@/lib/admin/translations'

interface DashboardPanelProps {
  title: string
  /** The "View all" destination; omitted while there is nothing to view. */
  href?: string | null
  /** Rows run edge to edge with dividers (a populated list); otherwise the body is padded and centred (loading and empty states). */
  bleed?: boolean
  children: React.ReactNode
}

// One shell for both of the dashboard's lists, so they match whatever they
// hold: the title and "View all" in a header row, the content below, and the
// same minimum height whether populated, loading or empty.
export default function DashboardPanel({ title, href, bleed = false, children }: DashboardPanelProps) {
  const { t, dir } = useAdminT()
  return (
    <section className="flex h-full min-h-[300px] flex-col overflow-hidden rounded-2xl border border-adm-line bg-adm-surface">
      <div className="flex min-h-14 items-center justify-between gap-4 border-b border-adm-line px-5 py-3 sm:px-6">
        <h2 className="text-base font-bold text-adm-text">{title}</h2>
        {href && (
          <Link
            href={href}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-adm-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent/50"
          >
            {t('dash.viewAll')}
            <i className={`fa-solid fa-chevron-right text-[10px] ${dir === 'rtl' ? '-scale-x-100' : ''}`} aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className={bleed ? 'flex flex-1 flex-col divide-y divide-adm-line' : 'flex flex-1 flex-col justify-center p-6'}>{children}</div>
    </section>
  )
}
