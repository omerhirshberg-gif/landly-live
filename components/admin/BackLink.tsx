import Link from 'next/link'

export default function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-white mb-5">
      <span aria-hidden>←</span>
      {children}
    </Link>
  )
}
