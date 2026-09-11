'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ADMIN_SESSION_KEY } from '@/components/admin/AdminGate'
import BackLink from '@/components/admin/BackLink'

interface Business {
  uid: string
  businessName: string
  businessId: string
  category: string
  email: string
  activePerkCount: number
  redeemedTotal: number
}

export default function BusinessesListPage() {
  const [businesses, setBusinesses] = useState<Business[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const password = sessionStorage.getItem(ADMIN_SESSION_KEY) ?? ''
    fetch('/api/admin/businesses', { headers: { Authorization: `Bearer ${password}` } })
      .then((res) => res.json())
      .then((data) => setBusinesses(data.businesses ?? []))
      .catch(() => setError('Failed to load businesses.'))
  }, [])

  return (
    <div className="max-w-3xl">
      <BackLink href="/admin">Dashboard</BackLink>
      <h1 className="text-2xl font-black text-white mb-6">Businesses</h1>

      {error && (
        <div className="mb-4 text-sm font-semibold text-red-400 bg-red-950/40 border border-red-900 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {businesses === null && <p className="text-slate-400">Loading…</p>}
      {businesses?.length === 0 && <p className="text-slate-400">No businesses yet.</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {businesses?.map((business) => (
          <Link
            key={business.uid}
            href={`/admin/businesses/${business.uid}`}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-slate-700 transition-colors flex flex-col gap-3"
          >
            <div className="min-w-0">
              <div className="text-white font-bold truncate">{business.businessName}</div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="inline-flex items-center text-[11px] font-bold uppercase tracking-wide text-brand bg-brand/10 border border-brand/30 rounded-full px-2 py-0.5">
                  {business.category}
                </span>
              </div>
              <div className="text-slate-500 text-xs mt-2 truncate">{business.email}</div>
            </div>

            <div className="flex items-center gap-4 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-1.5 text-emerald-400 text-sm font-bold">
                <i className="fa-solid fa-tags text-xs" aria-hidden="true" />
                {business.activePerkCount}
                <span className="text-slate-500 font-semibold text-xs">active</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300 text-sm font-bold">
                <i className="fa-solid fa-ticket text-xs text-slate-500" aria-hidden="true" />
                {business.redeemedTotal}
                <span className="text-slate-500 font-semibold text-xs">redeemed</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
