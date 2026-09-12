'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setStoredToken } from '@/lib/admin/adminSession'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
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
        body: JSON.stringify({ password }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.token) {
        setError(res.status === 429 ? 'Too many attempts. Try again later.' : 'Incorrect password.')
        setSubmitting(false)
        return
      }
      setStoredToken(data.token)
      router.push('/admin')
    } catch {
      setError('Something went wrong. Try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <img src="/logo-mark.png" alt="Landly" className="h-9 w-auto" />
          <div className="flex items-center gap-2">
            <span className="font-black text-white text-xl leading-none">Landly</span>
            <span className="inline-flex items-center text-[11px] font-bold uppercase tracking-wide text-brand bg-brand/10 border border-brand/30 rounded-full px-2 py-0.5">
              Admin
            </span>
          </div>
        </div>
        <h1 className="text-2xl font-black text-white mb-1">Sign in</h1>
        <p className="text-sm text-slate-400 mb-7">Enter the shared admin password to continue.</p>

        {error && (
          <div className="mb-4 text-sm font-semibold text-red-400 bg-red-950/40 border border-red-900 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block mb-1.5 text-sm font-bold text-slate-300">Password</label>
            <input
              type="password"
              required
              autoFocus
              className="inp inp-dark"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary mt-2 w-full disabled:opacity-70">
            {submitting ? 'Checking…' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  )
}
