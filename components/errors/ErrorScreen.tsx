'use client'

import Link from 'next/link'
import { Compass, Gift, House, type LucideIcon } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'

// Shared fallback card for app/not-found.tsx, app/error.tsx and
// app/global-error.tsx. Display only: callers pass already-translated text.
// Everything has a fixed size (64px icon tile, 52px buttons) so nothing shifts
// when Heebo finishes loading, and spacing is logical (gap, text-center) so
// Hebrew mirrors without extra rules. Icons are Lucide components, drawn
// inline, so even global-error (no app shell) needs no icon font.

type Action =
  | { label: string; icon?: LucideIcon; href: string; reload?: boolean }
  | { label: string; icon?: LucideIcon; onClick: () => void }

interface ErrorScreenProps {
  icon: LucideIcon
  code?: string
  title: string
  body: string
  primary: Action
  secondary?: Action
  footnote?: string
  // Clears the fixed Navbar; global-error renders without one.
  withNavbar?: boolean
}

function ActionButton({ action, variant }: { action: Action; variant: 'primary' | 'secondary' }) {
  const className = `ds-btn ds-btn-${variant} w-full sm:w-auto sm:min-w-[180px]`
  const content = (
    <>
      {action.icon && <action.icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />}
      {action.label}
    </>
  )
  if ('onClick' in action) {
    return <button type="button" onClick={action.onClick} className={className}>{content}</button>
  }
  // A full page load when the app shell itself may be broken (global-error).
  if (action.reload) return <a href={action.href} className={className}>{content}</a>
  return <Link href={action.href} className={className}>{content}</Link>
}

export default function ErrorScreen({ icon: Icon, code, title, body, primary, secondary, footnote, withNavbar = true }: ErrorScreenProps) {
  return (
    <main
      className={`flex min-h-screen min-h-dvh items-center justify-center bg-canvas overflow-x-hidden ${withNavbar ? 'below-header' : ''}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div
        className="w-full max-w-[560px] py-10 sm:py-16"
        style={{ paddingLeft: 'max(16px, env(safe-area-inset-left))', paddingRight: 'max(16px, env(safe-area-inset-right))' }}
      >
        <div className="flex flex-col items-center text-center rounded-2xl border border-slate-200 bg-white px-6 py-10 sm:px-12 sm:py-12 shadow-card">
          <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl border border-sky-200/60 bg-brandTint text-brand" aria-hidden="true">
            <Icon aria-hidden="true" className="h-7 w-7" strokeWidth={1.5} />
          </span>
          {code && <p className="mt-5 text-sm font-bold tracking-[0.2em] text-brand" dir="ltr">{code}</p>}
          <h1 className={`${code ? 'mt-1' : 'mt-5'} text-2xl sm:text-page-lg font-extrabold leading-tight text-ink`}>{title}</h1>
          <p className="mt-3 max-w-[400px] text-copy sm:text-base leading-relaxed text-body">{body}</p>
          <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
            <ActionButton action={primary} variant="primary" />
            {secondary && <ActionButton action={secondary} variant="secondary" />}
          </div>
          {footnote && <p className="mt-6 text-xs text-muted break-all">{footnote}</p>}
        </div>
      </div>
    </main>
  )
}

// The translated 404 body for app/not-found.tsx, which stays a server
// component so the Navbar and metadata render on the server.
export function NotFoundContent() {
  const { t } = useLang()
  return (
    <ErrorScreen
      icon={Compass}
      code="404"
      title={t('err_404_title')}
      body={t('err_404_body')}
      primary={{ label: t('err_home'), icon: House, href: '/' }}
      secondary={{ label: t('nav_cta'), icon: Gift, href: '/categories' }}
    />
  )
}
