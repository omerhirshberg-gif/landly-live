'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin/adminSession'
import Alert from '@/components/admin/Alert'
import Card, { CardSkeletons } from '@/components/admin/Card'
import EmptyState from '@/components/admin/EmptyState'
import { FilterChips, ResultCount, SearchInput } from '@/components/admin/ListToolbar'
import PageHeader from '@/components/admin/PageHeader'
import StatusBadge from '@/components/admin/StatusBadge'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/admin/formStyles'

interface Business {
  uid: string
  businessName: string
  businessId: string
  category: string
  email: string
  activePerkCount: number
  redeemedTotal: number
}

const ALL = '__all__'

export default function BusinessesListPage() {
  const [businesses, setBusinesses] = useState<Business[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>(ALL)

  useEffect(() => {
    adminFetch('/api/admin/businesses')
      .then((res) => res.json())
      .then((data) => setBusinesses(data.businesses ?? []))
      .catch(() => setError('Failed to load businesses.'))
  }, [])

  const categoryOptions = useMemo(() => {
    const categories = [...new Set((businesses ?? []).map((b) => b.category).filter(Boolean))].sort()
    return [{ value: ALL, label: 'All' }, ...categories.map((c) => ({ value: c, label: c }))]
  }, [businesses])

  const filtered = useMemo(() => {
    if (!businesses) return []
    const q = query.trim().toLowerCase()
    return businesses.filter(
      (b) =>
        (category === ALL || b.category === category) &&
        (!q ||
          b.businessName.toLowerCase().includes(q) ||
          b.businessId.toLowerCase().includes(q) ||
          b.email.toLowerCase().includes(q)),
    )
  }, [businesses, query, category])

  const clearFilters = () => {
    setQuery('')
    setCategory(ALL)
  }

  return (
    <div>
      <PageHeader
        title="Businesses"
        subtitle="Every partner business with a Landly login."
        actions={
          <Link href="/admin/businesses/new" className={`${PRIMARY_BUTTON} w-full sm:w-auto`}>
            <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
            Add new business
          </Link>
        }
      />

      {error && <Alert className="mb-6">{error}</Alert>}

      {businesses !== null && businesses.length > 0 && (
        <div className="mb-6 space-y-3">
          <SearchInput
            label="Search businesses"
            placeholder="Search by name, ח.פ or login email…"
            value={query}
            onChange={setQuery}
            className="max-w-xl"
          />
          {categoryOptions.length > 2 && (
            <FilterChips label="Filter by category" options={categoryOptions} value={category} onChange={setCategory} />
          )}
          <ResultCount shown={filtered.length} total={businesses.length} noun="businesses" />
        </div>
      )}

      {businesses === null && !error && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <CardSkeletons count={6} />
        </div>
      )}

      {businesses?.length === 0 && (
        <EmptyState
          icon="fa-store"
          title="No businesses yet"
          description="Create a business login and its first offer in one step."
          action={
            <Link href="/admin/businesses/new" className={PRIMARY_BUTTON}>
              <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
              Add your first business
            </Link>
          }
        />
      )}

      {businesses !== null && businesses.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon="fa-magnifying-glass"
          title="No matching businesses"
          description="Try a different search or category."
          action={
            <button type="button" onClick={clearFilters} className={SECONDARY_BUTTON}>
              Clear filters
            </button>
          }
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((business) => (
          <Card key={business.uid} href={`/admin/businesses/${business.uid}`} className="flex flex-col gap-4 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F0F7FF] text-[#0038B8]">
                <i className="fa-solid fa-store" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-[#0B1B3D]" dir="auto">{business.businessName}</div>
                <div className="mt-0.5 truncate text-xs text-[#94A3B8]" dir="ltr">{business.email}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="blue">
                <span dir="auto">{business.category}</span>
              </StatusBadge>
              <span className="text-xs text-[#94A3B8]" dir="ltr">ח.פ {business.businessId}</span>
            </div>
            <div className="mt-auto flex items-center gap-4 border-t border-[#E2E8F0] pt-3 text-sm">
              <StatusBadge tone={business.activePerkCount > 0 ? 'emerald' : 'slate'} icon="fa-tags">
                {business.activePerkCount} active
              </StatusBadge>
              <span className="inline-flex items-center gap-1.5 text-[#475569]">
                <i className="fa-solid fa-ticket text-xs text-[#94A3B8]" aria-hidden="true" />
                <span className="font-semibold tabular-nums text-[#0B1B3D]">{business.redeemedTotal}</span> redeemed
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
