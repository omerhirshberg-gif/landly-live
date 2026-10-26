import Link from 'next/link'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import IconFrame from '@/components/ui/IconFrame'

// One row of the settings pages: icon frame (IconFrame), title, optional subtitle and a
// chevron that points along the reading direction. A link (to another
// settings page) when given href, otherwise a button for an in-page action.
// destructive turns it red for the Danger zone. Logical spacing only, so
// Hebrew mirrors it.
export default function SettingsRow({
  icon,
  title,
  subtitle,
  href,
  onClick,
  destructive = false,
}: {
  icon: LucideIcon
  title: string
  subtitle?: string
  href?: string
  onClick?: () => void
  destructive?: boolean
}) {
  const className = `tap-target flex w-full items-center gap-3 min-h-[56px] px-4 py-3 text-start transition-colors [@media(hover:hover)]:hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:bg-slate-50 ${destructive ? 'text-red-600' : 'text-ink'}`
  const body = (
    <>
      <IconFrame icon={icon} size="sm" tone={destructive ? 'danger' : 'ink'} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-copy font-semibold">{title}</span>
        {subtitle && <span className={`block truncate text-meta ${destructive ? 'text-red-500/80' : 'text-slate-500'}`}>{subtitle}</span>}
      </span>
      <ChevronRight aria-hidden="true" className={`h-4 w-4 flex-shrink-0 rtl:-scale-x-100 ${destructive ? 'text-red-300' : 'text-slate-400'}`} strokeWidth={1.75} />
    </>
  )
  return href ? (
    <Link href={href} className={className}>{body}</Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>{body}</button>
  )
}

// A titled white card holding rows, with hairlines between them.
export function SettingsGroup({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mb-6">
      <h2 id={id} className="px-1 pb-2 text-meta font-semibold text-slate-500">{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card divide-y divide-slate-100">{children}</div>
    </section>
  )
}
