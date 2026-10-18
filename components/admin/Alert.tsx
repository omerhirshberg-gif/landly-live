// Error callout for failed loads and rejected submissions. role="alert" so a
// screen reader announces it the moment it appears.
export default function Alert({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-sm font-medium text-[#B91C1C] ${className}`}
    >
      <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
