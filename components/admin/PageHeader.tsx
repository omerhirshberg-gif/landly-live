interface PageHeaderProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export default function PageHeader({ title, subtitle, actions, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex items-center justify-between gap-4 mb-6 flex-wrap ${className}`}>
      <div className="min-w-0">
        <h1 className="text-2xl font-black text-white">{title}</h1>
        {subtitle && <div className="mt-2">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
