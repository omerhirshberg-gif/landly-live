'use client'

import Link from 'next/link'
import { useAdminT } from '@/lib/admin/translations'

// The admin's one back control: a 44px chevron-and-label button, as a link
// to a fixed parent (BackLink) or a button with its own action (the support
// inbox's "All chats"). Back points toward the start edge: left in English,
// and mirrored to point right in Hebrew, following the admin's own language
// (never the public site's on <html>).

const BACK_BUTTON =
  'inline-flex min-h-11 min-w-11 items-center gap-2 rounded-xl px-3 py-2 text-[15px] font-semibold text-slate-700 transition-colors ' +
  'hover:text-slate-900 active:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8] [-webkit-tap-highlight-color:transparent]'

function Chevron() {
  const { dir } = useAdminT()
  return <i className={`fa-solid fa-chevron-left text-sm ${dir === 'rtl' ? '-scale-x-100' : ''}`} aria-hidden="true" />
}

type BackButtonProps = { children: React.ReactNode; className?: string } & ({ href: string; onClick?: never } | { onClick: () => void; href?: never })

export default function BackButton({ children, className = '', ...target }: BackButtonProps) {
  if (target.href !== undefined) {
    return (
      <Link href={target.href} className={`${BACK_BUTTON} ${className}`}>
        <Chevron />
        {children}
      </Link>
    )
  }
  return (
    <button type="button" onClick={target.onClick} className={`${BACK_BUTTON} ${className}`}>
      <Chevron />
      {children}
    </button>
  )
}
