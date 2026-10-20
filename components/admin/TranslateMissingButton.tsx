'use client'

import { useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { ButtonSpinner } from './FormSection'
import { SECONDARY_BUTTON } from './formStyles'

// Fills in translations for offers saved before translation existed (or
// whose translation failed): POST /api/admin/offers/translate, repeated
// while it reports offers left (each call stays inside the function time
// limit). Offers already translated cost nothing; manual wording is kept.
// /admin/businesses points it at /api/admin/businesses/refresh (names and
// addresses), which follows the same contract.
export default function TranslateMissingButton({
  className = '',
  endpoint = '/api/admin/offers/translate',
  label = 'Translate missing',
  runningLabel = 'Translating…',
  icon = 'fa-language',
  noun = ['offer', 'offers'],
  doneVerb = 'translated',
}: {
  className?: string
  endpoint?: string
  label?: string
  runningLabel?: string
  icon?: string
  noun?: [singular: string, plural: string]
  doneVerb?: string
}) {
  const [state, setState] = useState<{ kind: 'idle' | 'running' | 'done' | 'error'; message?: string }>({ kind: 'idle' })

  const run = async () => {
    setState({ kind: 'running' })
    let updated = 0
    let failed = 0
    try {
      for (let round = 0; round < 20; round++) {
        const res = await adminFetch(endpoint, { method: 'POST' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setState({ kind: 'error', message: data.error ?? 'Translating failed.' })
          return
        }
        updated += data.updated ?? 0
        failed += data.failed ?? 0
        if (!data.remaining) break
      }
      setState({
        kind: failed > 0 ? 'error' : 'done',
        message: `${updated} ${updated === 1 ? noun[0] : noun[1]} ${doneVerb}${failed > 0 ? `, ${failed} with errors (run again to retry)` : ''}.`,
      })
    } catch {
      setState({ kind: 'error', message: 'Translating failed. Try again.' })
    }
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <button type="button" className={`${SECONDARY_BUTTON} w-full sm:w-auto`} onClick={run} disabled={state.kind === 'running'} aria-busy={state.kind === 'running'}>
        {state.kind === 'running' ? <ButtonSpinner /> : <i className={`fa-solid ${icon} text-xs`} aria-hidden="true" />}
        {state.kind === 'running' ? runningLabel : label}
      </button>
      {state.message && (
        <p role="status" className={`text-xs ${state.kind === 'error' ? 'text-[#B91C1C]' : 'text-emerald-700'}`}>
          {state.message}
        </p>
      )}
    </div>
  )
}
