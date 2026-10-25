'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin/adminSession'
import Alert from './Alert'
import Card, { CardSkeletons } from './Card'
import EmptyState from './EmptyState'
import PageHeader from './PageHeader'
import StatCard from './StatCard'
import StatusBadge from './StatusBadge'
import { PRIMARY_BUTTON, SECONDARY_BUTTON, SECTION_HEADING } from './formStyles'

interface Business {
  uid: string
  businessName: string
  category: string
  activePerkCount: number
  createdAt: string | null
}

export default function AdminDashboard() {
  const [businesses, setBusinesses] = useState<Business[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminFetch('/api/admin/businesses')
      .then((res) => res.json())
      .then((data) => setBusinesses(data.businesses ?? []))
      .catch(() => setError('Failed to load businesses.'))
  }, [])

  const businessCount = businesses?.length ?? null
  const activeOfferCount = businesses?.reduce((sum, b) => sum + b.activePerkCount, 0) ?? null

  const recentBusinesses = businesses
    ?.filter((b) => b.createdAt)
    .slice()
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
    .slice(0, 5)

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="An overview of Landly's partner businesses and their live offers." />

      {error && <Alert className="mb-6">{error}</Alert>}

      <div className="mb-10 grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          label="Total Businesses"
          value={businessCount}
          icon="fa-store"
          accent="blue"
          emptyHint="No businesses yet — add your first one below."
        />
        <StatCard
          label="Active Offers"
          value={activeOfferCount}
          icon="fa-tags"
          accent="amber"
          emptyHint="No active offers yet — add one from a business."
        />
      </div>

      <h2 className={SECTION_HEADING}>Actions</h2>
      <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2">
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

      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className={`${SECTION_HEADING} !mb-0`}>Recent Businesses</h2>
        {recentBusinesses && recentBusinesses.length > 0 && (
          <Link href="/admin/businesses" className="inline-flex min-h-12 items-center gap-1.5 text-sm font-semibold text-[#0038B8] hover:text-[#002A8A]">
            View all
            <i className="fa-solid fa-arrow-right text-xs" aria-hidden="true" />
          </Link>
        )}
      </div>
      {businesses === null && !error && (
        <div className="space-y-2">
          <CardSkeletons count={3} className="h-16" />
        </div>
      )}
      {recentBusinesses && recentBusinesses.length === 0 && (
        <EmptyState
          icon="fa-store"
          title="No businesses yet"
          description="Businesses you add will show up here."
          action={
            <Link href="/admin/businesses/new" className={PRIMARY_BUTTON}>
              <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
              Add business
            </Link>
          }
        />
      )}
      {recentBusinesses && recentBusinesses.length > 0 && (
        <Card className="divide-y divide-[#E2E8F0] overflow-hidden">
          {recentBusinesses.map((business) => (
            <Link
              key={business.uid}
              href={`/admin/businesses/${business.uid}`}
              className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-[#F8FAFC] active:bg-[#F1F5F9] focus-visible:bg-[#F0F7FF] focus-visible:outline-none sm:px-5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F7FF] text-sm text-[#0038B8]">
                  <i className="fa-solid fa-store" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[#0B1B3D]" dir="auto">{business.businessName}</div>
                  <div className="mt-0.5 text-xs text-[#94A3B8]">
                    <span dir="auto">{business.category}</span> · added {new Date(business.createdAt!).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <StatusBadge tone={business.activePerkCount > 0 ? 'emerald' : 'slate'} icon="fa-tags" className="shrink-0">
                {business.activePerkCount} active
              </StatusBadge>
            </Link>
          ))}
        </Card>
      )}
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
    <Card
      hover
      className={`flex flex-col gap-4 p-6 ${primary ? '!border-[#0038B8]/20 bg-gradient-to-br from-[#F0F7FF] to-white' : ''}`}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg ${
          primary ? 'bg-[#0038B8] text-white shadow-sm shadow-[#0038B8]/30' : 'bg-[#F1F5F9] text-[#0B1B3D]'
        }`}
      >
        <i className={`fa-solid ${icon}`} aria-hidden="true" />
      </div>
      <div>
        <h3 className="mb-1 text-lg font-bold text-[#0B1B3D]">{title}</h3>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      <Link href={href} className={`${primary ? PRIMARY_BUTTON : SECONDARY_BUTTON} mt-auto w-full sm:w-fit`}>
        {buttonLabel}
        <i className="fa-solid fa-arrow-right text-xs" aria-hidden="true" />
      </Link>
    </Card>
  )
}
