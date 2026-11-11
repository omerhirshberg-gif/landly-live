'use client'

import { useAdminT } from '@/lib/admin/translations'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin/adminSession'
import { formatIsraeliDate } from '@/lib/admin/formatDate'
import { useNeedsReplyCount } from '@/lib/admin/needsReply'
import Alert from './Alert'
import Card, { CardSkeletons } from './Card'
import EmptyState from './EmptyState'
import PageHeader from './PageHeader'
import StatCard from './StatCard'
import StatusBadge from './StatusBadge'
import BidiText from './BidiText'
import { categoryEmoji } from './CategoryBadge'
import { PRIMARY_BUTTON, SECONDARY_BUTTON, SECTION_HEADING } from './formStyles'

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

// The admin's front page: four numbers, one row of quick actions, then two
// short lists -- the newest businesses and the live offers about to expire.
// The sidebar already links every section, so nothing here repeats it as a
// big card. Only the existing admin APIs are read (no endpoint of its own).
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

  return (
    <div>
      <PageHeader title={t('route.Dashboard')} subtitle={t('dash.subtitle')} />

      {error && <Alert className="mb-6">{error}</Alert>}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t('dash.stat.businesses')} value={businesses?.length ?? null} icon="fa-store" accent="blue" emptyHint={t('dash.stat.businessesHint')} />
        <StatCard label={t('dash.stat.active')} value={activeOfferCount} icon="fa-tags" accent="emerald" emptyHint={t('dash.stat.activeHint')} />
        <StatCard label={t('dash.stat.expiring')} value={expiring?.length ?? null} icon="fa-hourglass-half" accent="amber" />
        <StatCard label={t('dash.stat.chats')} value={needsReply} icon="fa-comments" accent="violet" />
      </div>

      {/* One row of the everyday actions; the sidebar covers the rest. */}
      <section aria-label={t('dash.quick')} className="mb-10 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link href="/admin/businesses/new" className={PRIMARY_BUTTON}>
          <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
          {t('dash.addBusiness')}
        </Link>
        <Link href="/admin/offers/new" className={SECONDARY_BUTTON}>
          <i className="fa-solid fa-tags text-xs" aria-hidden="true" />
          {t('dash.addOffer')}
        </Link>
        <Link href="/admin/users" className={SECONDARY_BUTTON}>
          <i className="fa-solid fa-users text-xs" aria-hidden="true" />
          {t('dash.viewUsers')}
        </Link>
        <Link href="/admin/support" className={SECONDARY_BUTTON}>
          <i className="fa-solid fa-comments text-xs" aria-hidden="true" />
          {t('dash.openInbox')}
          {needsReply > 0 && <StatusBadge tone="emerald">{needsReply}</StatusBadge>}
        </Link>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section>
          <ListHeading title={t('dash.recent')} href={recentBusinesses && recentBusinesses.length > 0 ? '/admin/businesses' : null} />
          {businesses === null && !error && (
            <div className="space-y-2">
              <CardSkeletons count={3} className="h-16" />
            </div>
          )}
          {recentBusinesses && recentBusinesses.length === 0 && (
            <EmptyState
              icon="fa-store"
              title={t('dash.noBiz')}
              description={t('dash.noBizBody')}
              action={
                <Link href="/admin/businesses/new" className={PRIMARY_BUTTON}>
                  <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
                  {t('dash.addBusiness')}
                </Link>
              }
            />
          )}
          {recentBusinesses && recentBusinesses.length > 0 && (
            <Card className="divide-y divide-[#E2E8F0] overflow-hidden">
              {recentBusinesses.map((business) => (
                <ListRow
                  key={business.uid}
                  href={`/admin/businesses/${business.uid}`}
                  icon="fa-store"
                  title={business.businessName}
                  meta={
                    <>
                      <bdi dir="auto">{`${categoryEmoji(business.category)} ${business.category}`.trim()}</bdi> · {t('dash.added')} <bdi dir="ltr">{formatIsraeliDate(business.createdAt)}</bdi>
                    </>
                  }
                  badge={
                    <StatusBadge tone={business.activePerkCount > 0 ? 'emerald' : 'slate'} icon="fa-tags">
                      {t('dash.activeN', { n: business.activePerkCount })}
                    </StatusBadge>
                  }
                />
              ))}
            </Card>
          )}
        </section>

        <section>
          <ListHeading title={t('dash.expiringIn', { n: EXPIRING_DAYS })} href={expiring && expiring.length > 0 ? '/admin/offers' : null} />
          {offers === null && !error && (
            <div className="space-y-2">
              <CardSkeletons count={3} className="h-16" />
            </div>
          )}
          {expiring && expiring.length === 0 && (
            <p className="rounded-2xl border border-dashed border-[#CBD5E1] px-5 py-6 text-center text-sm text-[#64748B]">{t('dash.noneExpiring', { n: EXPIRING_DAYS })}</p>
          )}
          {expiring && expiring.length > 0 && (
            <Card className="divide-y divide-[#E2E8F0] overflow-hidden">
              {expiring.slice(0, 5).map((offer) => {
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
            </Card>
          )}
        </section>
      </div>
    </div>
  )
}

function ListHeading({ title, href }: { title: string; href: string | null }) {
  const { t } = useAdminT()
  return (
    <div className="mb-3 flex min-h-12 items-center justify-between gap-4">
      <h2 className={`${SECTION_HEADING} !mb-0`}>{title}</h2>
      {href && (
        <Link href={href} className="inline-flex min-h-12 items-center gap-1.5 text-sm font-semibold text-[#0038B8] hover:text-[#002A8A]">
          {t('dash.viewAll')}
          <i className="fa-solid fa-arrow-right text-xs" aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

function ListRow({ href, icon, title, meta, badge }: { href: string; icon: string; title: string; meta: React.ReactNode; badge: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-[#F8FAFC] active:bg-[#F1F5F9] focus-visible:bg-[#F0F7FF] focus-visible:outline-none sm:px-5"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F7FF] text-sm text-[#0038B8]">
          <i className={`fa-solid ${icon}`} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <BidiText className="font-semibold text-[#0B1B3D]">{title}</BidiText>
          <div className="mt-0.5 truncate text-xs text-[#64748B]">{meta}</div>
        </div>
      </div>
      <span className="shrink-0">{badge}</span>
    </Link>
  )
}
