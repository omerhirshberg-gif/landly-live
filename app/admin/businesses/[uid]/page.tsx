'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin/adminSession'
import { useAdminCrumbs } from '@/components/admin/AdminCrumbContext'
import Alert from '@/components/admin/Alert'
import BackLink from '@/components/admin/BackLink'
import BusinessHero from '@/components/admin/BusinessHero'
import { CardSkeletons } from '@/components/admin/Card'
import EmptyState from '@/components/admin/EmptyState'
import OfferShowcaseCard, { type ShowcaseOffer } from '@/components/admin/OfferShowcaseCard'
import BusinessEditForm from '@/components/admin/BusinessEditForm'
import { FormTabs, TabPanel, useFormTabs } from '@/components/admin/FormTabs'
import RowActionsMenu from '@/components/admin/RowActionsMenu'
import { PRIMARY_BUTTON, SECTION_HEADING } from '@/components/admin/formStyles'
import type { GeoAddress } from '@/lib/geo'
import { alternateBusinessName, type BusinessTranslations } from '@/lib/business/businessText'
import { useAdminT, type AdminKey } from '@/lib/admin/translations'

interface Business {
  uid: string
  businessName: string
  businessId: string
  category: string
  location: string
  address: GeoAddress | null
  translations?: BusinessTranslations | null
  /** '' = no logo (GET /api/admin/businesses). */
  logoUrl: string
  /** E.164, or '' for none. */
  phone: string
}

const businessTabs = (t: (key: AdminKey) => string) => [
  { id: 'offers', label: t('bizDetail.tab.offers'), icon: 'fa-tags' },
  { id: 'details', label: t('bizDetail.tab.details'), icon: 'fa-pen' },
] as const

// One business: a hero header (logo, names, category, ח.פ, address with map
// links, phone), then its offers as the cards members see (the default tab)
// and its details, edited in place on the Details tab. Its name is its crumb
// in the breadcrumbs; deleting it is the ⋯ menu's only action, away from
// the everyday ones.
export default function BusinessDetailPage() {
  const { t } = useAdminT()
  const { uid } = useParams<{ uid: string }>()
  const router = useRouter()

  const [business, setBusiness] = useState<Business | null | undefined>(undefined)
  const [offers, setOffers] = useState<ShowcaseOffer[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  // Bumped on every save, so the Details form starts again from what was saved.
  const [savedVersion, setSavedVersion] = useState(0)
  const tabs = useFormTabs(businessTabs(t))
  useAdminCrumbs(useMemo(() => (business ? { labels: { [`/admin/businesses/${uid}`]: business.businessName } } : null), [business, uid]))

  useEffect(() => {
    adminFetch('/api/admin/businesses')
      .then((res) => res.json())
      .then((data) => setBusiness((data.businesses ?? []).find((b: Business) => b.uid === uid) ?? null))
      .catch(() => setError(t('bizDetail.loadFailed')))

    adminFetch(`/api/admin/offers?businessUid=${uid}`)
      .then((res) => res.json())
      .then((data) => setOffers(data.offers ?? []))
      .catch(() => setError(t('bizDetail.offersFailed')))
  }, [uid])

  const deleteOffer = async (offer: ShowcaseOffer) => {
    const warning =
      offer.claimedCount > 0
        ? t('bizDetail.confirmClaimed', { n: offer.claimedCount, title: offer.title })
        : t('bizDetail.confirmDeleteOffer', { title: offer.title })
    if (!window.confirm(warning)) return

    const res = await adminFetch(`/api/admin/offers/${offer.id}`, { method: 'DELETE' })
    if (!res.ok) {
      setError((await res.json()).error ?? t('bizDetail.deleteOfferFailed'))
      return
    }
    setOffers((prev) => prev?.filter((o) => o.id !== offer.id) ?? null)
  }

  const deleteBusiness = async () => {
    if (!business) return
    const offerCount = offers?.length ?? 0
    const offerText = offerCount > 0 ? t('bizDetail.andOffers', { n: offerCount }) : ''
    if (!window.confirm(t('bizDetail.confirmDeleteBiz', { name: business.businessName, offers: offerText }))) return

    const res = await adminFetch(`/api/admin/businesses/${uid}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? t('bizDetail.deleteBizFailed'))
      return
    }
    router.push('/admin/businesses')
  }

  if (business === undefined) {
    return error ? (
      <Alert>{error}</Alert>
    ) : (
      <div className="space-y-4">
        <CardSkeletons count={1} className="h-44" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <CardSkeletons count={3} className="h-64" />
        </div>
      </div>
    )
  }
  if (business === null) {
    return (
      <div>
        <BackLink />
        <EmptyState icon="fa-store-slash" title={t('bizDetail.notFound')} description={t('bizDetail.mayBeDeleted')} />
      </div>
    )
  }

  const activeOffers = offers?.filter((o) => o.active) ?? []
  const inactiveOffers = offers?.filter((o) => !o.active) ?? []
  // Edits open the offer under this business (Back and Save return here).
  const editHref = (offer: ShowcaseOffer) => `/admin/offers/${offer.id}/edit?from=business&businessUid=${uid}`
  const addHref = `/admin/offers/new?businessUid=${uid}`

  return (
    <div>
      <BackLink />

      {error && <Alert className="mb-6">{error}</Alert>}
      {warning && (
        <Alert tone="warning" className="mb-6">
          {warning}
        </Alert>
      )}

      <BusinessHero
        business={{ ...business, altName: alternateBusinessName(business.businessName, business.translations) }}
        actions={
          <>
            <Link href={addHref} className={`${PRIMARY_BUTTON} flex-1 sm:flex-none`}>
              <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
              {t('bizDetail.addOffer')}
            </Link>
            <RowActionsMenu
              label={t('bizDetail.moreActions')}
              // Editing is the Details tab; the menu keeps only what's dangerous.
              actions={[{ label: t('bizDetail.deleteBusiness'), icon: 'fa-trash', danger: true, onSelect: () => void deleteBusiness() }]}
            />
          </>
        }
      />

      <FormTabs state={tabs} label={t('bizDetail.sections')} />

      <TabPanel state={tabs} tab="details">
        <BusinessEditForm
          key={savedVersion}
          uid={uid}
          business={business}
          onSaved={(next, translationWarning) => {
            setBusiness({ ...business, ...next })
            setWarning(translationWarning)
            setSavedVersion((n) => n + 1)
          }}
        />
      </TabPanel>

      <TabPanel state={tabs} tab="offers">
        {offers === null && !error && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <CardSkeletons count={3} className="h-64" />
          </div>
        )}

        {offers !== null && offers.length === 0 && (
          <EmptyState
            icon="fa-tags"
            title={t('bizDetail.noOffersTitle')}
            description={t('bizDetail.noOffersDesc')}
            action={
              <Link href={addHref} className={PRIMARY_BUTTON}>
                <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
                {t('bizDetail.addOfferShort')}
              </Link>
            }
          />
        )}

        {offers !== null && offers.length > 0 && (
          <div className="space-y-10">
            <OfferSection title={t('bizDetail.active', { n: activeOffers.length })} offers={activeOffers} editHref={editHref} onDelete={deleteOffer} />
            {inactiveOffers.length > 0 && (
              <OfferSection title={t('bizDetail.inactive', { n: inactiveOffers.length })} offers={inactiveOffers} editHref={editHref} onDelete={deleteOffer} />
            )}
          </div>
        )}
      </TabPanel>
    </div>
  )
}

function OfferSection({
  title,
  offers,
  editHref,
  onDelete,
}: {
  title: string
  offers: ShowcaseOffer[]
  editHref: (offer: ShowcaseOffer) => string
  onDelete: (offer: ShowcaseOffer) => void
}) {
  const { t } = useAdminT()
  return (
    <section>
      <h2 className={SECTION_HEADING}>{title}</h2>
      {offers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#CBD5E1] px-5 py-6 text-center text-sm text-[#64748B]">{t('bizDetail.none')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {offers.map((offer) => (
            <OfferShowcaseCard
              key={offer.id}
              offer={offer}
              editHref={editHref(offer)}
              actions={[
                { label: t('bizDetail.editOffer'), icon: 'fa-pen', href: editHref(offer) },
                { label: t('bizDetail.deleteOffer'), icon: 'fa-trash', danger: true, onSelect: () => onDelete(offer) },
              ]}
            />
          ))}
        </div>
      )}
    </section>
  )
}
