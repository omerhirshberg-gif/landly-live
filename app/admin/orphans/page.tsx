'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { formatIsraeliDate } from '@/lib/admin/formatDate'
import Alert from '@/components/admin/Alert'
import Card, { CardSkeletons } from '@/components/admin/Card'
import EmptyState from '@/components/admin/EmptyState'
import PageHeader from '@/components/admin/PageHeader'
import { ButtonSpinner } from '@/components/admin/FormSection'
import { DANGER_BUTTON } from '@/components/admin/formStyles'

interface Orphan {
  uid: string
  email: string
  createdAt: string
  providerIds: string[]
}

export default function OrphansPage() {
  const [orphans, setOrphans] = useState<Orphan[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deletingUid, setDeletingUid] = useState<string | null>(null)

  const load = () => {
    setError(null)
    adminFetch('/api/admin/orphans')
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
      const res = await adminFetch(`/api/admin/orphans/${orphan.uid}`, { method: 'DELETE' })
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
    <div>
      <PageHeader
        title="Orphaned login accounts"
        subtitle={
          <p className="max-w-3xl">
            Firebase Auth accounts with no matching business or customer record. Deleting one only removes the login
            account and frees its email &mdash; there is no Firestore record left to clean up.
          </p>
        }
      />

      {error && <Alert className="mb-6">{error}</Alert>}

      {orphans === null && !error && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <CardSkeletons count={4} className="h-20" />
        </div>
      )}
      {orphans?.length === 0 && (
        <EmptyState icon="fa-circle-check" title="No orphaned accounts" description="Every login account has a matching business or customer record." />
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {orphans?.map((orphan) => (
          <Card key={orphan.uid} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFFBEB] text-amber-700">
                <i className="fa-solid fa-triangle-exclamation text-sm" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold text-[#0B1B3D]" dir="ltr">{orphan.email}</div>
                <div className="truncate text-xs text-[#94A3B8]">
                  {orphan.providerIds.join(', ') || 'no provider'} · created <bdi dir="ltr">{formatIsraeliDate(orphan.createdAt)}</bdi> ·{' '}
                  <span className="font-mono">{orphan.uid}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className={`${DANGER_BUTTON} w-full sm:w-auto sm:shrink-0`}
              onClick={() => deleteOrphan(orphan)}
              disabled={deletingUid === orphan.uid}
            >
              {deletingUid === orphan.uid ? <ButtonSpinner /> : <i className="fa-solid fa-trash text-xs" aria-hidden="true" />}
              {deletingUid === orphan.uid ? 'Deleting…' : 'Delete'}
            </button>
          </Card>
        ))}
      </div>
    </div>
  )
}
