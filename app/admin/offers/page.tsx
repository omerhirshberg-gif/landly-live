'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin/adminSession'
import { formatIsraeliDate } from '@/lib/admin/formatDate'
import { useAdminT } from '@/lib/admin/translations'
import Alert from '@/components/admin/Alert'
import { CardSkeletons } from '@/components/admin/Card'
import DataTable from '@/components/admin/DataTable'
import EmptyState from '@/components/admin/EmptyState'
import { FilterChips, ResultCount, SearchInput } from '@/components/admin/ListToolbar'
import PageHeader from '@/components/admin/PageHeader'
import OfferPrice from '@/components/admin/OfferPrice'
import StatusBadge from '@/components/admin/StatusBadge'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/admin/formStyles'
import BidiText from '@/components/admin/BidiText'
import OfferThumb from '@/components/admin/OfferThumb'
import BatchOffersUploadModal from '@/components/admin/offers/BatchOffersUploadModal'

interface Offer {
  id: string
  title: string
  businessId: string
  businessName: string
  imageUrl: string
  businessLogoUrl: string
  fulfillmentType: 'direct_merchant' | 'multipass_pool'
  originalPrice: number
  offerPrice: number
  expiryDate: string | null
  totalQuantity: number | null
  claimedCount: number
  active: boolean
}

type StatusFilter = 'all' | 'active' | 'inactive'
type ChannelFilter = 'all' | 'direct_merchant' | 'multipass_pool'

const isExpired = (offer: Offer) => !!offer.expiryDate && new Date(offer.expiryDate).getTime() <= Date.now()

// One workspace for every perk: status tabs (Draft is "not active", with no
// schema field of its own), the fulfillment channel, search, and the wizard
// behind "Add new offer". Both channels live here; the Inventory page holds
// the stock side (pools and their codes).
export default function OffersListPage() {
  const { t } = useAdminT()
  const [offers, setOffers] = useState<Offer[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [channel, setChannel] = useState<ChannelFilter>('all')
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(() => {
    adminFetch('/api/admin/offers')
      .then((res) => res.json())
      .then((data) => setOffers(data.offers ?? []))
      .catch(() => setError(t('offers.loadFailed')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const statusOptions = [
    { value: 'all', label: t('offers.status.all') },
    { value: 'active', label: t('offers.status.active') },
    { value: 'inactive', label: t('offers.status.inactive') },
  ] as const
  const channelOptions = [
    { value: 'all', label: t('offers.fulfillment.all') },
    { value: 'direct_merchant', label: t('offers.fulfillment.direct') },
    { value: 'multipass_pool', label: t('offers.fulfillment.multipass') },
  ] as const

  const filtered = useMemo(() => {
    if (!offers) return []
    const q = query.trim().toLowerCase()
    return offers.filter(
      (o) =>
        (status === 'all' || (status === 'active' && o.active) || (status === 'inactive' && !o.active)) &&
        (channel === 'all' || o.fulfillmentType === channel) &&
        (!q || o.title.toLowerCase().includes(q) || o.businessName.toLowerCase().includes(q)),
    )
  }, [offers, query, status, channel])

  const clearFilters = () => {
    setQuery('')
    setStatus('all')
    setChannel('all')
  }

  const deleteOffer = async (offer: Offer) => {
    const warning =
      offer.claimedCount > 0
        ? t('offers.confirmDeleteClaimed', { n: offer.claimedCount, title: offer.title })
        : t('offers.confirmDelete', { title: offer.title })
    if (!window.confirm(warning)) return
    const res = await adminFetch(`/api/admin/offers/${offer.id}`, { method: 'DELETE' })
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? t('offers.deleteFailed'))
      return
    }
    setOffers((prev) => prev?.filter((o) => o.id !== offer.id) ?? null)
  }

  return (
    <div>
      <PageHeader
        title={t('route.Offers')}
        actions={
          <>
            <Link href="/admin/offers/new" className={`${PRIMARY_BUTTON} w-full sm:w-auto`}>
              <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
              {t('offers.add')}
            </Link>
            <button type="button" className={`${SECONDARY_BUTTON} w-full sm:w-auto`} onClick={() => setCatalogOpen(true)}>
              <ExcelIcon />
              {t('smart.openCatalog')}
            </button>
          </>
        }
      />

      {error && <Alert className="mb-6">{error}</Alert>}
      {notice && <Alert tone="success" className="mb-6">{notice}</Alert>}

      {offers !== null && offers.length > 0 && (
        <div className="mb-6 space-y-3">
          <SearchInput label={t('offers.search')} placeholder={t('offers.searchPlaceholder')} value={query} onChange={setQuery} className="max-w-xl" />
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-[#64748B]">{t('offers.statusCaption')}</p>
              <FilterChips label={t('offers.filterStatus')} options={statusOptions} value={status} onChange={setStatus} />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-[#64748B]">{t('offers.channelCaption')}</p>
              <FilterChips label={t('offers.filterFulfillment')} options={channelOptions} value={channel} onChange={setChannel} />
            </div>
          </div>
          <ResultCount shown={filtered.length} total={offers.length} noun={t('offers.nounOffers')} />
        </div>
      )}

      {offers === null && !error && (
        <div className="space-y-3">
          <CardSkeletons count={4} className="h-20" />
        </div>
      )}

      {offers?.length === 0 && (
        <EmptyState
          icon="fa-tags"
          title={t('offers.emptyTitle')}
          description={t('offers.emptyBody')}
          action={
            <Link href="/admin/offers/new" className={PRIMARY_BUTTON}>
              <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
              {t('offers.addShort')}
            </Link>
          }
        />
      )}

      {offers !== null && offers.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon="fa-magnifying-glass"
          title={t('offers.noMatchTitle')}
          description={t('offers.noMatchBody')}
          action={
            <button type="button" onClick={clearFilters} className={SECONDARY_BUTTON}>
              {t('list.clearFilters')}
            </button>
          }
        />
      )}

      {filtered.length > 0 && (
        <DataTable
          label={t('route.Offers')}
          rows={filtered}
          rowKey={(offer) => offer.id}
          rowHref={(offer) => `/admin/offers/${offer.id}/edit`}
          columns={[
            {
              id: 'offer',
              header: t('offers.col.offer'),
              sortValue: (offer) => offer.title,
              cell: (offer) => <OfferIdentity offer={offer} />,
            },
            { id: 'channel', header: t('offers.col.channel'), width: 'min-w-[130px]', sortValue: (offer) => offer.fulfillmentType, cell: (offer) => <ChannelBadge type={offer.fulfillmentType} /> },
            { id: 'status', header: t('offers.col.status'), width: 'w-[120px] min-w-[120px]', sortValue: (offer) => (offer.active ? 0 : 1), cell: (offer) => <OfferStatus offer={offer} /> },
            {
              id: 'price',
              header: t('offers.col.price'),
              align: 'end',
              width: 'w-[120px] min-w-[120px]',
              sortValue: (offer) => offer.offerPrice,
              cell: (offer) => <OfferPrice offerPrice={offer.offerPrice} originalPrice={offer.originalPrice} align="end" />,
            },
            {
              id: 'claimed',
              header: t('offers.col.claimed'),
              align: 'end',
              width: 'w-[110px] min-w-[110px]',
              sortValue: (offer) => offer.claimedCount,
              cell: (offer) => <Claimed offer={offer} />,
            },
            {
              id: 'expires',
              header: t('offers.col.expires'),
              align: 'end',
              width: 'w-[120px] min-w-[120px]',
              sortValue: (offer) => (offer.expiryDate ? new Date(offer.expiryDate).getTime() : Number.MAX_SAFE_INTEGER),
              cell: (offer) => (
                <bdi dir="ltr" className="tabular-nums text-[#475569]">
                  {formatIsraeliDate(offer.expiryDate)}
                </bdi>
              ),
            },
          ]}
          actions={(offer) => [
            { label: t('offers.action.edit'), icon: 'fa-pen', href: `/admin/offers/${offer.id}/edit` },
            ...(offer.fulfillmentType === 'multipass_pool' ? [{ label: t('offers.action.codes'), icon: 'fa-boxes-stacked', href: '/admin/inventory' }] : []),
            { label: t('offers.action.business'), icon: 'fa-store', href: `/admin/businesses/${offer.businessId}` },
            { label: t('offers.action.delete'), icon: 'fa-trash', danger: true, onSelect: () => void deleteOffer(offer) },
          ]}
          card={(offer) => (
            <>
              <div className="flex items-start justify-between gap-3">
                <OfferIdentity offer={offer} />
                <OfferStatus offer={offer} />
              </div>
              <div className="mt-3 flex items-end justify-between gap-3 border-t border-[#E2E8F0] pt-3">
                <span className="flex flex-col items-start gap-2">
                  <OfferPrice offerPrice={offer.offerPrice} originalPrice={offer.originalPrice} />
                  <ChannelBadge type={offer.fulfillmentType} />
                </span>
                <span className="text-end text-xs text-[#64748B]">
                  <Claimed offer={offer} /> {t('offers.claimedSuffix')}
                  {offer.expiryDate && (
                    <span className="block">
                      {t('offers.expiresPrefix')} <bdi dir="ltr" className="tabular-nums">{formatIsraeliDate(offer.expiryDate)}</bdi>
                    </span>
                  )}
                </span>
              </div>
            </>
          )}
        />
      )}
      {catalogOpen && (
        <BatchOffersUploadModal
          onClose={() => setCatalogOpen(false)}
          onDone={(message) => {
            setCatalogOpen(false)
            setNotice(message)
            setOffers(null)
            load()
          }}
        />
      )}
    </div>
  )
}

/** Thumbnail, then the title over its business: a row's first cell, and a phone card's top. Two lines, never cut mid-word. */
function OfferIdentity({ offer }: { offer: Offer }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <OfferThumb imageUrl={offer.imageUrl} logoUrl={offer.businessLogoUrl} />
      <span className="min-w-0 flex-1">
        <BidiText lines={2} className="font-semibold text-[#0B1B3D] hover:text-[#0038B8]">{offer.title}</BidiText>
        <BidiText lines={2} className="mt-0.5 text-xs text-[#64748B]">{offer.businessName}</BidiText>
      </span>
    </span>
  )
}

function ChannelBadge({ type }: { type: Offer['fulfillmentType'] }) {
  const { t } = useAdminT()
  return type === 'multipass_pool'
    ? <StatusBadge tone="blue" icon="fa-boxes-stacked">{t('channel.multipass')}</StatusBadge>
    : <StatusBadge tone="slate" icon="fa-store">{t('channel.direct')}</StatusBadge>
}

/** Why an offer isn't live, same rules as OfferStatusBadge, in the admin's language. */
function OfferStatus({ offer }: { offer: Offer }) {
  const { t } = useAdminT()
  if (offer.active) return <StatusBadge tone="emerald" icon="fa-circle-check">{t('status.active')}</StatusBadge>
  if (offer.totalQuantity !== null && offer.claimedCount >= offer.totalQuantity) return <StatusBadge tone="amber" icon="fa-box-open">{t('status.soldOut')}</StatusBadge>
  if (isExpired(offer)) return <StatusBadge tone="amber" icon="fa-clock">{t('status.expired')}</StatusBadge>
  return <StatusBadge tone="slate">{t('status.notActive')}</StatusBadge>
}

/** "12/50" claimed ("∞" when unlimited), as one LTR run. */
function Claimed({ offer }: { offer: Offer }) {
  return (
    <bdi dir="ltr" className="font-semibold tabular-nums text-[#475569]">
      {offer.claimedCount}/{offer.totalQuantity ?? '∞'}
    </bdi>
  )
}

function ExcelIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <path d="M4 9h16M4 15h16M10 9v12" />
    </svg>
  )
}
