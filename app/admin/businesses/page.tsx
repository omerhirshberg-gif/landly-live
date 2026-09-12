'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin/adminSession'
import Card from '@/components/admin/Card'

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
    adminFetch('/api/admin/businesses')
      .then((res) => res.json())
      .then((data) => setBusinesses(data.businesses ?? []))
      .catch(() => setError('Failed to load businesses.'))
  }, [])

  return (
    <div>
      <Link
        href="/admin/businesses/new"
        className="btn-primary !min-h-0 !py-2.5 !px-4 text-sm inline-flex items-center gap-2 w-fit mb-6"
      >
        <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
        Add new business
      </Link>

      {error && (
        <div className="mb-4 text-sm font-semibold text-red-400 bg-red-950/40 border border-red-900 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {businesses === null && <p className="text-slate-400">Loading…</p>}
      {businesses?.length === 0 && (
        <p className="text-slate-400">No businesses yet — add your first one above.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {businesses?.map((business) => (
          <Card key={business.uid} href={`/admin/businesses/${business.uid}`} className="p-5 flex flex-col gap-3">
            <div className="min-w-0">
              <div className="text-white font-bold truncate">{business.businessName}</div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="inline-flex items-center text-[11px] font-bold uppercase tracking-wide text-brand bg-brand/10 border border-brand/30 rounded-full px-2 py-0.5">
                  {business.category}
                </span>
              </div>
              <div className="text-slate-500 text-xs mt-2 truncate">{business.email}</div>
            </div>

            <div className="flex items-center gap-4 pt-2 border-t border-white/10">
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
          </Card>
        ))}
      </div>
    </div>
  )
}
