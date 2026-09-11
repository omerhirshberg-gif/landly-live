'use client'

import { useEffect, useState } from 'react'
import { ADMIN_SESSION_KEY } from '@/components/admin/AdminGate'
import BackLink from '@/components/admin/BackLink'

interface Orphan {
  uid: string
  email: string
  createdAt: string
  providerIds: string[]
}

function authHeader() {
  const password = sessionStorage.getItem(ADMIN_SESSION_KEY) ?? ''
  return { Authorization: `Bearer ${password}` }
}

export default function OrphansPage() {
  const [orphans, setOrphans] = useState<Orphan[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deletingUid, setDeletingUid] = useState<string | null>(null)

  const load = () => {
    setError(null)
    fetch('/api/admin/orphans', { headers: authHeader() })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setOrphans(data.orphans ?? [])
      })
      .catch(() => setError('Failed to load orphaned accounts.'))
  }

  useEffect(load, [])

  const deleteOrphan = async (orphan: Orphan) => {
    if (!window.confirm(`Permanently delete the login account for "${orphan.email}"? This cannot be undone.`)) return
    setDeletingUid(orphan.uid)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orphans/${orphan.uid}`, { method: 'DELETE', headers: authHeader() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete.')
      setOrphans((prev) => prev?.filter((o) => o.uid !== orphan.uid) ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete.')
    } finally {
      setDeletingUid(null)
    }
  }

  return (
    <div className="max-w-3xl">
      <BackLink href="/admin">Dashboard</BackLink>
      <h1 className="text-2xl font-black text-white mb-1">Orphaned login accounts</h1>
      <p className="text-slate-500 text-sm mb-6">
        Firebase Auth accounts with no matching business or customer record. Deleting one only removes the
        login account and frees its email -- there is no Firestore record left to clean up.
      </p>

      {error && (
        <div className="mb-4 text-sm font-semibold text-red-400 bg-red-950/40 border border-red-900 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {orphans === null && <p className="text-slate-400">Loading…</p>}
      {orphans?.length === 0 && <p className="text-slate-400">No orphaned accounts found.</p>}

      <div className="space-y-2">
        {orphans?.map((orphan) => (
          <div
            key={orphan.uid}
            className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4"
          >
            <div className="min-w-0 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <i className="fa-solid fa-triangle-exclamation text-sm" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-white font-semibold truncate">{orphan.email}</div>
                <div className="text-slate-500 text-xs truncate">
                  {orphan.providerIds.join(', ') || 'no provider'} · created{' '}
                  {new Date(orphan.createdAt).toLocaleDateString()} · {orphan.uid}
                </div>
              </div>
            </div>
            <button
              className="inline-flex items-center gap-2 text-sm font-bold text-red-400 border-2 border-red-900/60 rounded-full px-4 py-2 transition-colors hover:bg-red-950/50 hover:border-red-800 shrink-0 disabled:opacity-50"
              onClick={() => deleteOrphan(orphan)}
              disabled={deletingUid === orphan.uid}
            >
              <i className="fa-solid fa-trash text-xs" aria-hidden="true" />
              {deletingUid === orphan.uid ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
