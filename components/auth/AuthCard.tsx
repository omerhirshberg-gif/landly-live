'use client'

import Link from 'next/link'
import { ReactNode } from 'react'
import BackToHomeLink from './BackToHomeLink'

// Shared visual shell for the 4 auth pages: a large centered logo welcoming
// the user (no language switcher here by design — auth pages silently follow
// the language already chosen on the main site) and a centered white card
// for the form.
export default function AuthCard({
  children,
  backLabel,
}: {
  children: ReactNode
  backLabel: string
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10 sm:py-12">
      <div className="w-full max-w-md">
        <BackToHomeLink label={backLabel} />
        <Link href="/" className="flex justify-center mb-8">
          <img src="/logo.jpg" alt="Landly" className="h-24 sm:h-28 w-auto" />
        </Link>

        <div className="bg-white rounded-3xl shadow-lg p-8 sm:p-10">
          {children}
        </div>
      </div>
    </div>
  )
}
