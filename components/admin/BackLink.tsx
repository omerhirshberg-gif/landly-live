import Link from 'next/link'

// Deliberately NOT router.back()/browser history -- that leaks whatever tab
// the user happened to be on before jumping to this section via the
// sidebar. Each caller passes its own section's fixed parent route instead,
// so "Back" always stays within the current section regardless of how the
// user actually arrived here.
export default function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 bg-white/5 border border-white/10 rounded-full pl-3 pr-4 py-1.5 mb-5 transition-colors hover:text-white hover:bg-white/10 hover:border-white/20"
    >
      <i className="fa-solid fa-arrow-left text-xs" aria-hidden="true" />
      {children}
    </Link>
  )
}
