interface EmptyStateProps {
  icon: string
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
  /** Sits inside a panel that already has its own frame (the dashboard's DashboardPanel): no dashed box, smaller icon and spacing. */
  compact?: boolean
}

export default function EmptyState({ icon, title, description, action, className = '', compact = false }: EmptyStateProps) {
  if (compact) {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-adm-raised text-lg text-adm-accent">
          <i className={`fa-solid ${icon}`} aria-hidden="true" />
        </div>
        <h3 className="mt-3 text-base font-semibold text-adm-text">{title}</h3>
        {description && <p className="mt-1 max-w-xs text-sm text-adm-muted">{description}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    )
  }
  return (
    <div
      className={`flex flex-col items-center rounded-2xl border border-adm-line bg-adm-surface px-6 py-12 text-center ${className}`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-adm-accent-soft text-xl text-adm-accent">
        <i className={`fa-solid ${icon}`} aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-adm-text">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-adm-text-2">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
