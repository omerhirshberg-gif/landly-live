'use client'

import Link from 'next/link'
import { ReactNode } from 'react'

// Shared visual shell for the 4 auth pages: logo top-left linking home,
// a small lang-toggle button top-right, a centered white card for the form.
export default function AuthCard({
  toggleLabel,
  onToggleLang,
  children,
  wrapperClassName = '',
}: {
  toggleLabel: string
  onToggleLang: () => void
  children: ReactNode
  wrapperClassName?: string
}) {
  return (
    <>
      <div className="max-w-7xl mx-auto px-5 py-5 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2">
          <img src="/logo.jpg" alt="Landly" className="h-9 w-auto" />
        </Link>
        <button className="lang-toggle" onClick={onToggleLang}>{toggleLabel}</button>
      </div>

      <div className={`flex items-center justify-center px-5 ${wrapperClassName}`} style={{ minHeight: 'calc(100vh - 100px)' }}>
        <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-8 sm:p-10">
          {children}
        </div>
      </div>
    </>
  )
}
