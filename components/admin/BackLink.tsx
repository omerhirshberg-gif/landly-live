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
      className="-ms-1 mb-2 inline-flex min-h-12 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-[#475569] transition-colors hover:text-[#0038B8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8]"
    >
      <i className="fa-solid fa-arrow-left text-xs rtl:-scale-x-100" aria-hidden="true" />
      {children}
    </Link>
  )
}
