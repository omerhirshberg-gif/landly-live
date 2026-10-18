'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'

// Shared fallback card for app/not-found.tsx, app/error.tsx and
// app/global-error.tsx. Display only: callers pass already-translated text.
// Everything has a fixed size (64px icon tile, 52px buttons) so nothing shifts
// when Font Awesome or Heebo finish loading, and spacing is logical (gap,
// text-center) so Hebrew mirrors without extra rules.

type Action =
  | { label: string; icon?: string; href: string; reload?: boolean }
  | { label: string; icon?: string; onClick: () => void }

interface ErrorScreenProps {
  icon: string
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
      {action.icon && <i className={`fa-solid ${action.icon}`} aria-hidden="true"></i>}
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

export default function ErrorScreen({ icon, code, title, body, primary, secondary, footnote, withNavbar = true }: ErrorScreenProps) {
  return (
    <main
      className={`flex min-h-screen min-h-dvh items-center justify-center bg-canvas overflow-x-hidden ${withNavbar ? 'pt-16' : ''}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div
        className="w-full max-w-[560px] py-10 sm:py-16"
        style={{ paddingLeft: 'max(16px, env(safe-area-inset-left))', paddingRight: 'max(16px, env(safe-area-inset-right))' }}
      >
        <div className="flex flex-col items-center text-center rounded-2xl border border-slate-200 bg-white px-6 py-10 sm:px-12 sm:py-12 shadow-sm">
          <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-brandLight text-brand text-[26px]" aria-hidden="true">
            <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
          </span>
          {code && <p className="mt-5 text-sm font-bold tracking-[0.2em] text-brand" dir="ltr">{code}</p>}
          <h1 className={`${code ? 'mt-1' : 'mt-5'} text-2xl sm:text-[28px] font-extrabold leading-tight text-ink`}>{title}</h1>
          <p className="mt-3 max-w-[400px] text-[15px] sm:text-base leading-relaxed text-body">{body}</p>
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
      icon="fa-compass"
      code="404"
      title={t('err_404_title')}
      body={t('err_404_body')}
      primary={{ label: t('err_home'), icon: 'fa-house', href: '/' }}
      secondary={{ label: t('nav_cta'), icon: 'fa-gift', href: '/categories' }}
    />
  )
}
