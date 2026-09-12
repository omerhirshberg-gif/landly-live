'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin/adminSession'

interface Business {
  activePerkCount: number
}

export default function AdminIndexPage() {
  const [businesses, setBusinesses] = useState<Business[] | null>(null)

  useEffect(() => {
    adminFetch('/api/admin/businesses')
      .then((res) => res.json())
      .then((data) => setBusinesses(data.businesses ?? []))
      .catch(() => setBusinesses(null))
  }, [])

  const businessCount = businesses?.length ?? null
  const activeOfferCount = businesses?.reduce((sum, b) => sum + b.activePerkCount, 0) ?? null

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-black text-white mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 mb-10">
        <StatTile label="Total Businesses" value={businessCount} icon="fa-store" />
        <StatTile label="Active Offers" value={activeOfferCount} icon="fa-tags" />
      </div>

      <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-3">Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ActionCard
          icon="fa-plus"
          title="Add New Business"
          description="Create a business login and its first offer in one step."
          href="/admin/businesses/new"
          buttonLabel="Add business"
          primary
        />
        <ActionCard
          icon="fa-store"
          title="Manage Businesses"
          description="Browse existing businesses, add offers, or remove one."
          href="/admin/businesses"
          buttonLabel="View businesses"
        />
      </div>
    </div>
  )
}

function StatTile({ label, value, icon }: { label: string; value: number | null; icon: string }) {
  return (
    <div className="dash-stat-card-dark rounded-2xl p-5 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand shrink-0">
        <i className={`fa-solid ${icon}`} aria-hidden="true" />
      </div>
      <div>
        <div className="text-2xl font-black text-white leading-none">{value ?? '…'}</div>
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-1">{label}</div>
      </div>
    </div>
  )
}

function ActionCard({
  icon,
  title,
  description,
  href,
  buttonLabel,
  primary,
}: {
  icon: string
  title: string
  description: string
  href: string
  buttonLabel: string
  primary?: boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 flex flex-col gap-3 transition-colors hover:border-slate-700">
      <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand text-xl">
        <i className={`fa-solid ${icon}`} aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-white font-bold text-lg mb-1">{title}</h3>
        <p className="text-slate-400 text-sm">{description}</p>
      </div>
      <Link
        href={href}
        className={`${primary ? 'btn-primary' : 'btn-secondary'} !min-h-0 !py-2.5 !px-5 text-sm w-fit mt-1`}
      >
        {buttonLabel}
      </Link>
    </div>
  )
}
