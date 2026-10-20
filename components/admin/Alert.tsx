// Callout for failed loads and rejected submissions (error), or for a save
// that went through with something to know (warning: e.g. a translation that
// failed). role="alert" so a screen reader announces it the moment it appears.
const TONES = {
  error: { box: 'border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]', icon: 'fa-circle-exclamation' },
  warning: { box: 'border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]', icon: 'fa-triangle-exclamation' },
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
