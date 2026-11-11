'use client'

import { useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { useAdminT, type AdminKey } from '@/lib/admin/translations'
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
  label,
  runningLabel,
  icon = 'fa-language',
  doneKey = 'bulk.translated',
}: {
  className?: string
  endpoint?: string
  /** Shown on the button, in the admin's language (the caller passes t(...)). */
  label: string
  runningLabel: string
  icon?: string
  /** The result line: "{n} updated" or "{n} translated". */
  doneKey?: Extract<AdminKey, 'bulk.updated' | 'bulk.translated'>
}) {
  const { t } = useAdminT()
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
          setState({ kind: 'error', message: data.error ?? t('bulk.failed') })
          return
        }
        updated += data.updated ?? 0
        failed += data.failed ?? 0
        if (!data.remaining) break
      }
      setState({
        kind: failed > 0 ? 'error' : 'done',
        message: `${t(doneKey, { n: updated })}${failed > 0 ? `, ${t('bulk.withErrors', { failed })}` : ''}.`,
      })
    } catch {
      setState({ kind: 'error', message: t('bulk.failed') })
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
