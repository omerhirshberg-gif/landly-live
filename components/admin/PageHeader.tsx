interface PageHeaderProps {
  /** The page's h1. Unless `visibleTitle` is set, the admin header already shows it (the mobile title, the desktop breadcrumbs), so it is for screen readers only. */
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  /** Show the title as a real heading: the executive layout of the dashboard (title and subtitle at the start, actions at the end, a hairline under). */
  visibleTitle?: boolean
}

export default function PageHeader({ title, subtitle, actions, className = '', visibleTitle = false }: PageHeaderProps) {
  if (visibleTitle) {
    return (
      <div className={`mb-6 flex flex-col gap-4 border-b border-adm-line pb-6 sm:flex-row sm:items-center sm:justify-between ${className}`}>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-adm-text sm:text-3xl">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-adm-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:items-center">{actions}</div>}
      </div>
    )
  }
  return (
    <div className={`mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        <h1 className="sr-only">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-adm-text-2 lg:text-[15px]">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
    </div>
  )
}
