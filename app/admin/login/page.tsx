'use client'

import { AdminBrand } from '@/components/admin/AdminBrand'
import Switch from '@/components/admin/Switch'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { markSignedIn } from '@/lib/admin/adminSession'
import Alert from '@/components/admin/Alert'
import PasswordField from '@/components/admin/PasswordField'
import { ButtonSpinner } from '@/components/admin/FormSection'
import { ADMIN_LABEL, PRIMARY_BUTTON } from '@/components/admin/formStyles'
import { useAdminT } from '@/lib/admin/translations'

const ERROR_ID = 'admin-login-error'
const REMEMBER_HINT_ID = 'admin-remember-hint'

export default function AdminLoginPage() {
  const { t } = useAdminT()
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
        setError(res.status === 429 ? t('login.tooMany') : res.status === 503 ? t('login.unavailable') : t('login.incorrect'))
        setSubmitting(false)
        return
      }
      // The session is the httpOnly cookie the response just set.
      markSignedIn()
      router.push('/admin')
    } catch {
      setError(t('login.error'))
      setSubmitting(false)
    }
  }

  return (
    <div className="relative isolate flex min-h-[var(--app-dvh)] items-center justify-center overflow-hidden px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6">
      {/* Decorative: a soft brand wash over a faint grid that fades out toward the edges. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgb(var(--adm-line))_1px,transparent_1px),linear-gradient(to_bottom,rgb(var(--adm-line))_1px,transparent_1px)] bg-[size:40px_40px] opacity-60 [mask-image:radial-gradient(ellipse_at_center,#000_20%,transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(ellipse_at_top,rgb(var(--adm-accent)/0.12),transparent_65%)]"
      />

      <main className="w-full max-w-md">
        <div className="rounded-2xl border border-adm-line bg-adm-surface p-6 shadow-xl shadow-black/20 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-3">
              <img src="/logo-mark.png" alt="" className="h-12 w-auto" />
              <AdminBrand className="text-2xl" />
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-adm-text">{t('login.title')}</h1>
            <p className="mt-1.5 text-sm text-adm-text-2">{t('login.subtitle')}</p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {error && (
              <Alert>
                <span id={ERROR_ID}>{error}</span>
              </Alert>
            )}

            <div>
              <label htmlFor="admin-password" className={ADMIN_LABEL}>
                {t('login.password')}
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
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-adm-text select-none [-webkit-tap-highlight-color:transparent]">
                <Switch name="remember" checked={remember} onChange={setRemember} aria-describedby={REMEMBER_HINT_ID} />
                <span>
                  {t('login.stay')}
                  <span className="text-adm-muted"> · </span>
                  <bdi lang="he" dir="rtl">
                    זכור אותי
                  </bdi>
                </span>
              </label>
              <p id={REMEMBER_HINT_ID} className="ms-8 text-xs text-adm-muted">
                {t('login.stayHint')}
              </p>
            </div>

            <button type="submit" disabled={submitting} aria-busy={submitting} className={`${PRIMARY_BUTTON} w-full`}>
              {submitting ? (
                <>
                  <ButtonSpinner />
                  {t('login.verifying')}
                </>
              ) : (
                <>
                  {t('login.title')}
                  <i className="fa-solid fa-arrow-right text-sm" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 border-t border-adm-line pt-5 text-xs font-medium text-adm-muted">
            <i className="fa-solid fa-lock text-[10px]" aria-hidden="true" />
            {t('login.restricted')}
          </div>
        </div>
      </main>
    </div>
  )
}
