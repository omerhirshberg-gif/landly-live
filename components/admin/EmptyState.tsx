interface EmptyStateProps {
  icon: string
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export default function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center rounded-2xl border border-dashed border-[#CBD5E1] bg-white/60 px-6 py-12 text-center ${className}`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0F7FF] text-xl text-[#0038B8]">
        <i className={`fa-solid ${icon}`} aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-[#0B1B3D]">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-[#475569]">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
