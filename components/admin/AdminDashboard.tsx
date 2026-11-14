'use client'

import { useAdminT } from '@/lib/admin/translations'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin/adminSession'
import { formatIsraeliDate } from '@/lib/admin/formatDate'
import { useNeedsReplyCount } from '@/lib/admin/needsReply'
import Alert from './Alert'
import { CardSkeletons } from './Card'
import EmptyState from './EmptyState'
import DashboardPanel from './DashboardPanel'
import PageHeader from './PageHeader'
import StatCard from './StatCard'
import StatusBadge from './StatusBadge'
import BidiText from './BidiText'

interface Business {
  uid: string
  businessName: string
  category: string
  activePerkCount: number
  createdAt: string | null
}

interface Offer {
  id: string
  title: string
  businessName: string
  expiryDate: string | null
  active: boolean
}

/** Live offers ending within this many days are listed as expiring soon. */
const EXPIRING_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

// The two header actions: rectangular, 44px, equal width of purpose.
const CTA_BASE =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold whitespace-nowrap transition-colors sm:w-auto ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent/50 [-webkit-tap-highlight-color:transparent]'
// The single text link an empty panel offers.
const PANEL_LINK = 'inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-adm-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent/50'

// The admin's front page: a header with the two everyday actions, four linked
// numbers, then two short lists in matching panels -- the newest businesses and
// the live offers about to expire. The sidebar already links every section, so
// nothing here repeats it as a big card. Only the existing admin APIs are read (no endpoint of its own).
export default function AdminDashboard() {
  const { t, tn } = useAdminT()
  const [businesses, setBusinesses] = useState<Business[] | null>(null)
  const [offers, setOffers] = useState<Offer[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const needsReply = useNeedsReplyCount(true)
  // Read once, on opening, so the list doesn't shift while it's open.
  const [now] = useState(() => Date.now())

  useEffect(() => {
    adminFetch('/api/admin/businesses')
      .then((res) => res.json())
      .then((data) => setBusinesses(data.businesses ?? []))
      .catch(() => setError(t('dash.loadBiz')))
    adminFetch('/api/admin/offers')
      .then((res) => res.json())
      .then((data) => setOffers(data.offers ?? []))
      .catch(() => setError(t('dash.loadOffers')))
  }, [])

  const activeOfferCount = businesses?.reduce((sum, b) => sum + b.activePerkCount, 0) ?? null

  const recentBusinesses = businesses
    ?.filter((b) => b.createdAt)
    .slice()
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
    .slice(0, 5)

  const expiring = offers
    ?.filter((o) => o.active && o.expiryDate && new Date(o.expiryDate).getTime() - now <= EXPIRING_DAYS * DAY_MS)
    .sort((a, b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime())

  const addBusinessBtn = `${CTA_BASE} bg-adm-accent text-adm-on-accent hover:bg-adm-accent-hover active:bg-adm-accent-press`
  const addOfferBtn = `${CTA_BASE} border border-adm-line-strong bg-transparent text-adm-text hover:bg-adm-raised active:bg-adm-raised`
  const loadingRows = (
    <div className="space-y-2" aria-hidden="true">
      <CardSkeletons count={3} className="h-16" />
    </div>
  )

  return (
    <div>
      <PageHeader
        visibleTitle
        title={t('route.Dashboard')}
        subtitle={t('dash.subtitle')}
        actions={
          <>
            <Link href="/admin/businesses/new" className={addBusinessBtn}>
              <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
              {t('dash.addBusiness')}
            </Link>
            <Link href="/admin/offers/new" className={addOfferBtn}>
              <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
              {t('dash.addOffer')}
            </Link>
          </>
        }
      />

      {error && <Alert className="mb-6">{error}</Alert>}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard variant="compact" href="/admin/businesses" label={t('dash.stat.businesses')} value={businesses?.length ?? null} icon="fa-store" accent="blue" />
        <StatCard variant="compact" href="/admin/offers" label={t('dash.stat.active')} value={activeOfferCount} icon="fa-tags" accent="emerald" />
        <StatCard variant="compact" href="/admin/offers" label={t('dash.stat.expiring')} value={expiring?.length ?? null} icon="fa-hourglass-half" accent="amber" />
        <StatCard variant="compact" href="/admin/support" label={t('dash.stat.chats')} value={needsReply} icon="fa-comments" accent="violet" />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <DashboardPanel title={t('dash.recent')} href={recentBusinesses && recentBusinesses.length > 0 ? '/admin/businesses' : null} bleed={!!recentBusinesses && recentBusinesses.length > 0}>
          {businesses === null && !error && loadingRows}
          {recentBusinesses && recentBusinesses.length === 0 && (
            <EmptyState
              compact
              icon="fa-store"
              title={t('dash.noBiz')}
              description={t('dash.noBizBody')}
              action={
                <Link href="/admin/businesses/new" className={PANEL_LINK}>
                  {t('dash.addBusiness')}
                </Link>
              }
            />
          )}
          {recentBusinesses &&
            recentBusinesses.length > 0 &&
            recentBusinesses.map((business) => (
              <ListRow
                key={business.uid}
                href={`/admin/businesses/${business.uid}`}
                icon="fa-store"
                title={business.businessName}
                meta={
                  <>
                    <bdi dir="auto">{business.category}</bdi> · {t('dash.added')} <bdi dir="ltr">{formatIsraeliDate(business.createdAt)}</bdi>
                  </>
                }
                badge={
                  <StatusBadge tone={business.activePerkCount > 0 ? 'emerald' : 'slate'} icon="fa-tags">
                    {t('dash.activeN', { n: business.activePerkCount })}
                  </StatusBadge>
                }
              />
            ))}
        </DashboardPanel>

        <DashboardPanel title={t('dash.expiringIn', { n: EXPIRING_DAYS })} href={expiring && expiring.length > 0 ? '/admin/offers' : null} bleed={!!expiring && expiring.length > 0}>
          {offers === null && !error && loadingRows}
          {expiring && expiring.length === 0 && (
            <EmptyState
              compact
              icon="fa-hourglass-half"
              title={t('dash.noneExpiringTitle')}
              description={t('dash.noneExpiring', { n: EXPIRING_DAYS })}
              action={
                <Link href="/admin/offers" className={PANEL_LINK}>
                  {t('dash.viewOffers')}
                </Link>
              }
            />
          )}
          {expiring &&
            expiring.length > 0 &&
            expiring.slice(0, 5).map((offer) => {
              const days = Math.max(0, Math.ceil((new Date(offer.expiryDate!).getTime() - now) / DAY_MS))
              return (
                <ListRow
                  key={offer.id}
                  href={`/admin/offers/${offer.id}/edit`}
                  icon="fa-hourglass-half"
                  title={offer.title}
                  meta={<bdi dir="auto">{offer.businessName}</bdi>}
                  badge={<StatusBadge tone={days <= 3 ? 'amber' : 'slate'}>{days === 0 ? t('dash.today') : tn('dash.days', days)}</StatusBadge>}
                />
              )
            })}
        </DashboardPanel>
      </div>
    </div>
  )
}

function ListRow({ href, icon, title, meta, badge }: { href: string; icon: string; title: string; meta: React.ReactNode; badge: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-adm-raised active:bg-adm-raised focus-visible:bg-adm-raised focus-visible:outline-none sm:px-6"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-adm-accent-soft text-sm text-adm-accent">
          <i className={`fa-solid ${icon}`} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <BidiText className="font-semibold text-adm-text">{title}</BidiText>
          <div className="mt-0.5 truncate text-xs text-adm-muted">{meta}</div>
        </div>
      </div>
      <span className="shrink-0">{badge}</span>
    </Link>
  )
}
