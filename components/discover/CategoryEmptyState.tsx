'use client'

import { useMemo } from 'react'
import RaayonitPromoStrip from '@/components/raayonit/RaayonitPromoStrip'
import SectionDivider from '@/components/ui/SectionDivider'
import { useRaayonitDisplay } from '@/lib/flags/raayonitDisplayStore'
import { isolateLtr } from '@/lib/home/superShowcase'
import { useLang } from '@/lib/i18n/useLang'
import { isChain, isFlagship, isRaayonitOffer } from '@/lib/offers/discoverTab'
import { raayonitScopeHref, raayonitTargetFor } from '@/lib/offers/landlyRaayonitCategories'
import { RAAYONIT_HUB } from '@/lib/offers/offerRoutes'
import { useOffers } from '@/lib/offers/useOffers'

// A category with no direct GoLandly deal yet (native: landly-mobile/src/components/CategoryEmptyState.tsx): under a hairline, the Raayonit Card entry
// row worded for this category ("{Category} on Raayonit Card · Browse N businesses available now", straight to its businesses), or, where Raayonit has
// no match, "Available on Raayonit Card · Browse all N businesses"; then one line saying direct deals are on their way.
export default function CategoryEmptyState({ category, label }: { category: string; label: string }) {
  const { t, lang } = useLang()
  const showRaayonit = useRaayonitDisplay()
  const { offers } = useOffers()
  const raayonit = useMemo(() => (offers ?? []).filter(isRaayonitOffer), [offers])
  const target = useMemo(() => raayonitTargetFor(raayonit.filter(isChain), category, lang), [raayonit, category, lang])
  const flagship = useMemo(() => raayonit.find(isFlagship) ?? null, [raayonit])
  const note = <p aria-live="polite" className="mt-4 text-sm leading-5 text-muted">{t('category_soon_title').replace('{category}', label)}</p>
  // Without the Raayonit name (display flag off) or without chains there is nothing to point at: the note stands alone.
  if (!showRaayonit || target.count === 0) return <div className="mt-2"><SectionDivider className="!px-0" />{note}</div>
  const count = isolateLtr(String(target.count))
  return (
    <div className="mt-2">
      <SectionDivider className="!px-0" />
      <div className="mt-5">
        <RaayonitPromoStrip
          offer={flagship}
          count={target.count}
          title={target.matched ? t('category_strip_title').replace('{category}', label) : t('category_strip_title_all')}
          sub={(target.matched ? t('category_strip_sub') : t('category_soon_cta_all')).replace('{count}', count)}
          href={target.matched ? raayonitScopeHref(target.ids) : RAAYONIT_HUB}
        />
      </div>
      {note}
    </div>
  )
}
