// Callout for failed loads and rejected submissions (error), or for a save
// that went through with something to know (warning: e.g. a translation that
// failed). role="alert" so a screen reader announces it the moment it appears.
const TONES = {
  error: { box: 'border-adm-danger-line bg-adm-danger-soft text-adm-danger', icon: 'fa-circle-exclamation' },
  success: { box: 'border-adm-ok-line bg-adm-ok-soft text-adm-ok', icon: 'fa-circle-check' },
  warning: { box: 'border-adm-warn-line bg-adm-warn-soft text-adm-warn', icon: 'fa-triangle-exclamation' },
}

export default function Alert({
  children,
  className = '',
  tone = 'error',
}: {
  children: React.ReactNode
  className?: string
  tone?: keyof typeof TONES
}) {
  return (
    <div role="alert" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${TONES[tone].box} ${className}`}>
      <i className={`fa-solid ${TONES[tone].icon} mt-0.5 shrink-0`} aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
