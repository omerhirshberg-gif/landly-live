'use client'

import { useState } from 'react'
import { SUPPORT_EMAIL } from '@/lib/config'
import type { UnsubscribeCopy } from '@/lib/newsletter/unsubscribeCopy'

type Phase = 'ready' | 'working' | 'done' | 'error'

export default function UnsubscribeCard({ copy, token, email }: { copy: UnsubscribeCopy; token: string | null; email: string | null }) {
  const [phase, setPhase] = useState<Phase>('ready')

  async function confirm() {
    setPhase('working')
    try {
      const res = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        signal: AbortSignal.timeout(20_000),
      })
      setPhase(res.ok ? 'done' : 'error')
    } catch {
      setPhase('error')
    }
  }

  const valid = !!token && !!email
  const title = !valid ? copy.invalidTitle : phase === 'done' ? copy.doneTitle : copy.title
  const body = !valid ? copy.invalidBody : phase === 'done' ? copy.doneBody : phase === 'error' ? copy.errorBody : copy.body

  return (
    <section
      aria-live="polite"
      className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/80 p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md sm:p-9"
    >
      <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 ring-1 ring-blue-100" aria-hidden="true">
        {phase === 'done' ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
        )}
      </div>
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-3 text-base leading-relaxed text-slate-600">
        {body}
        {valid && phase !== 'error' && (
          <>
            {' '}
            <bdi dir="ltr" className="break-all font-semibold text-slate-900">{email}</bdi>
          </>
        )}
      </p>
      {valid && phase !== 'done' && (
        <button
          type="button"
          onClick={confirm}
          disabled={phase === 'working'}
          className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-5 text-base font-semibold text-white shadow-sm shadow-blue-600/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {phase === 'working' ? copy.workingButton : copy.confirmButton}
        </button>
      )}
      {(!valid || phase === 'error') && (
        <p className="mt-5 text-sm">
          <a href={`mailto:${SUPPORT_EMAIL}`} dir="ltr" className="font-semibold text-blue-600 underline-offset-2 hover:underline">{SUPPORT_EMAIL}</a>
        </p>
      )}
      <p className="mt-7 border-t border-slate-200/80 pt-5 text-sm">
        <a href="/" className="font-semibold text-blue-600 underline-offset-2 hover:underline">{copy.homeLink}</a>
      </p>
    </section>
  )
}
