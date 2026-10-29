'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin/adminSession'
import Alert from '@/components/admin/Alert'
import { CardSkeletons } from '@/components/admin/Card'
import DataTable from '@/components/admin/DataTable'
import EmptyState from '@/components/admin/EmptyState'
import { FilterChips, ResultCount, SearchInput } from '@/components/admin/ListToolbar'
import PageHeader from '@/components/admin/PageHeader'
import StatusBadge from '@/components/admin/StatusBadge'
import CategoryBadge from '@/components/admin/CategoryBadge'
import LogoTile from '@/components/admin/LogoTile'
import BidiText from '@/components/admin/BidiText'
import { alternateBusinessName, type BusinessTranslations } from '@/lib/business/businessText'
import TranslateMissingButton from '@/components/admin/TranslateMissingButton'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/admin/formStyles'

interface Business {
  uid: string
  businessName: string
  businessId: string
  category: string
  email: string
  logoUrl: string
  translations?: BusinessTranslations | null
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
          alternateBusinessName(b.businessName, b.translations).toLowerCase().includes(q) ||
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
          <>
            <TranslateMissingButton
              className="w-full sm:w-auto"
              endpoint="/api/admin/businesses/refresh"
              label="Refresh addresses and translate names"
              runningLabel="Refreshing…"
              icon="fa-arrows-rotate"
              noun={['business', 'businesses']}
              doneVerb="updated"
            />
            <Link href="/admin/businesses/new" className={`${PRIMARY_BUTTON} w-full sm:w-auto`}>
              <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
              Add new business
            </Link>
          </>
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
        <div className="space-y-3">
          <CardSkeletons count={5} className="h-20" />
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

      {filtered.length > 0 && (
        <DataTable
          label="Businesses"
          rows={filtered}
          rowKey={(business) => business.uid}
          rowHref={(business) => `/admin/businesses/${business.uid}`}
          initialSort={{ id: 'business', direction: 'asc' }}
          columns={[
            {
              id: 'business',
              header: 'Business',
              sortValue: (business) => business.businessName,
              cell: (business) => <BusinessIdentity business={business} />,
            },
            {
              id: 'category',
              header: 'Category',
              width: 'w-48',
              sortValue: (business) => business.category,
              cell: (business) => <CategoryBadge category={business.category} />,
            },
            {
              id: 'businessId',
              header: 'ח.פ',
              width: 'w-32',
              className: 'hidden xl:table-cell',
              cell: (business) => (
                <bdi dir="ltr" className="tabular-nums text-[#475569]">
                  {business.businessId}
                </bdi>
              ),
            },
            {
              id: 'active',
              header: 'Active offers',
              align: 'end',
              width: 'w-32',
              sortValue: (business) => business.activePerkCount,
              cell: (business) => (
                <StatusBadge tone={business.activePerkCount > 0 ? 'emerald' : 'slate'} icon="fa-tags">
                  {business.activePerkCount} active
                </StatusBadge>
              ),
            },
            {
              id: 'redeemed',
              header: 'Redeemed',
              align: 'end',
              width: 'w-28',
              sortValue: (business) => business.redeemedTotal,
              cell: (business) => <span className="font-semibold tabular-nums text-[#0B1B3D]">{business.redeemedTotal}</span>,
            },
          ]}
          actions={(business) => [
            { label: 'Open business', icon: 'fa-store', href: `/admin/businesses/${business.uid}` },
            { label: 'Add offer', icon: 'fa-plus', href: `/admin/offers/new?businessUid=${business.uid}` },
          ]}
          card={(business) => (
            <>
              <BusinessIdentity business={business} />
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#E2E8F0] pt-3 text-sm">
                <CategoryBadge category={business.category} />
                <StatusBadge tone={business.activePerkCount > 0 ? 'emerald' : 'slate'} icon="fa-tags">
                  {business.activePerkCount} active
                </StatusBadge>
                <span className="ms-auto inline-flex items-center gap-1.5 text-[#475569]">
                  <i className="fa-solid fa-ticket text-xs text-[#94A3B8]" aria-hidden="true" />
                  <bdi dir="ltr" className="font-semibold tabular-nums text-[#0B1B3D]">{business.redeemedTotal}</bdi> redeemed
                </span>
              </div>
            </>
          )}
        />
      )}
    </div>
  )
}

/** Logo, name (and the name in the other language) and login email: a row's first cell, and a phone card's top. */
function BusinessIdentity({ business }: { business: Business }) {
  const altName = alternateBusinessName(business.businessName, business.translations)
  return (
    <span className="flex min-w-0 items-center gap-3">
      <LogoTile logoUrl={business.logoUrl} name={business.businessName} />
      <span className="min-w-0 flex-1">
        <BidiText className="font-semibold text-[#0B1B3D] hover:text-[#0038B8]">{business.businessName}</BidiText>
        {altName && <BidiText className="text-sm text-[#475569]">{altName}</BidiText>}
        <bdi dir="ltr" className="mt-0.5 block truncate text-xs text-[#94A3B8] [text-align:match-parent]">
          {business.email}
        </bdi>
      </span>
    </span>
  )
}
