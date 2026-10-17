import Link from 'next/link'

// One row of the settings pages: icon tile, title, optional subtitle and a
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
  icon: string
  title: string
  subtitle?: string
  href?: string
  onClick?: () => void
  destructive?: boolean
}) {
  const className = `tap-target flex w-full items-center gap-3 min-h-[56px] px-4 py-3 text-start transition-colors [@media(hover:hover)]:hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:bg-slate-50 ${destructive ? 'text-red-600' : 'text-ink'}`
  const body = (
    <>
      <span
        className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg ${destructive ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}
        aria-hidden="true"
      >
        <i className={`fa-solid ${icon} text-sm`}></i>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{title}</span>
        {subtitle && <span className={`block truncate text-[13px] ${destructive ? 'text-red-500/80' : 'text-slate-500'}`}>{subtitle}</span>}
      </span>
      <i className={`fa-solid fa-chevron-right flex-shrink-0 text-xs rtl:-scale-x-100 ${destructive ? 'text-red-300' : 'text-slate-400'}`} aria-hidden="true"></i>
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
      <h2 id={id} className="px-1 pb-2 text-[13px] font-semibold text-slate-500">{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm divide-y divide-slate-100">{children}</div>
    </section>
  )
}
