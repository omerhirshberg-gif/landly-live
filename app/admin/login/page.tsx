'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { markSignedIn } from '@/lib/admin/adminSession'
import Alert from '@/components/admin/Alert'
import PasswordField from '@/components/admin/PasswordField'
import { ButtonSpinner } from '@/components/admin/FormSection'
import { ADMIN_LABEL, PRIMARY_BUTTON } from '@/components/admin/formStyles'

const ERROR_ID = 'admin-login-error'
const REMEMBER_HINT_ID = 'admin-remember-hint'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, remember }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(res.status === 429 ? 'Too many attempts. Try again later.' : res.status === 503 ? 'Sign-in is unavailable right now. Try again later.' : 'Incorrect password.')
        setSubmitting(false)
        return
      }
      // The session is the httpOnly cookie the response just set.
      markSignedIn()
      router.push('/admin')
    } catch {
      setError('Something went wrong. Try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="relative isolate flex min-h-[var(--app-dvh)] items-center justify-center overflow-hidden px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6">
      {/* Decorative: a soft brand wash over a faint grid that fades out toward the edges. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#E2E8F0_1px,transparent_1px),linear-gradient(to_bottom,#E2E8F0_1px,transparent_1px)] bg-[size:40px_40px] opacity-60 [mask-image:radial-gradient(ellipse_at_center,#000_20%,transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(ellipse_at_top,rgba(0,56,184,0.10),transparent_65%)]"
      />

      <main className="w-full max-w-md">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <img src="/logo-mark.png" alt="Landly" className="h-12 w-auto" />
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#F0F7FF] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#0038B8]">
              <i className="fa-solid fa-shield-halved text-[10px]" aria-hidden="true" />
              Admin Portal
            </span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#0B1B3D]">Sign In</h1>
            <p className="mt-1.5 text-sm text-[#475569]">Enter the shared admin password to manage businesses and offers.</p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {error && (
              <Alert>
                <span id={ERROR_ID}>{error}</span>
              </Alert>
            )}

            <div>
              <label htmlFor="admin-password" className={ADMIN_LABEL}>
                Password
              </label>
              <PasswordField
                id="admin-password"
                required
                autoFocus
                autoComplete="current-password"
                icon="fa-lock"
                errorId={error ? ERROR_ID : undefined}
                value={password}
                onChange={setPassword}
              />
            </div>

            <div>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-[#0B1B3D] select-none [-webkit-tap-highlight-color:transparent]">
                <input
                  type="checkbox"
                  name="remember"
                  className="h-5 w-5 shrink-0 cursor-pointer accent-[#0038B8]"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  aria-describedby={REMEMBER_HINT_ID}
                />
                <span>
                  Stay logged in
                  <span className="text-[#94A3B8]"> · </span>
                  <bdi lang="he" dir="rtl">
                    זכור אותי
                  </bdi>
                </span>
              </label>
              <p id={REMEMBER_HINT_ID} className="ms-8 text-xs text-[#94A3B8]">
                Keeps you signed in on this device for 30 days. Otherwise you&apos;re signed out after 12 hours.
              </p>
            </div>

            <button type="submit" disabled={submitting} aria-busy={submitting} className={`${PRIMARY_BUTTON} w-full`}>
              {submitting ? (
                <>
                  <ButtonSpinner />
                  Verifying…
                </>
              ) : (
                <>
                  Sign In
                  <i className="fa-solid fa-arrow-right text-sm" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 border-t border-[#E2E8F0] pt-5 text-xs font-medium text-[#94A3B8]">
            <i className="fa-solid fa-lock text-[10px]" aria-hidden="true" />
            Restricted area · Authorized administrators only
          </div>
        </div>
      </main>
    </div>
  )
}
