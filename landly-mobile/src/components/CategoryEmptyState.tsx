import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRaayonitDisplay } from '@shared/flags/raayonitDisplayStore'
import { isolateLtr } from '@shared/home/superShowcase'
import { isChain, isFlagship, isRaayonitOffer } from '@shared/offers/discoverTab'
import { RAAYONIT_HUB } from '@shared/offers/offerRoutes'
import { raayonitScopeHref, raayonitTargetFor } from '@shared/offers/landlyRaayonitCategories'
import { useOffers } from '@shared/offers/useOffers'
import AppText from './AppText'
import RaayonitPromoStrip from './RaayonitPromoStrip'
import SectionDivider from './SectionDivider'
import { useLang } from '../i18n/LangProvider'
import { colors } from '../theme'

// A category with no direct GoLandly deal yet (web: components/discover/CategoryEmptyState.tsx): under the category's header and a hairline, the
// Raayonit Card entry row worded for this category ("{Category} on Raayonit Card · Browse N businesses available now", straight to its businesses),
// or, where Raayonit has no match, "Available on Raayonit Card · Browse all N businesses"; then one line saying direct deals are on their way.
export default function CategoryEmptyState({ category, label }: { category: string; label: string }) {
  const { t, lang } = useLang()
  const showRaayonit = useRaayonitDisplay()
  const { offers } = useOffers()
  const raayonit = useMemo(() => (offers ?? []).filter(isRaayonitOffer), [offers])
  const target = useMemo(() => raayonitTargetFor(raayonit.filter(isChain), category, lang), [raayonit, category, lang])
  const flagship = useMemo(() => raayonit.find(isFlagship) ?? null, [raayonit])
  const note = <AppText accessibilityLiveRegion="polite" style={styles.note}>{t('category_soon_title').replace('{category}', label)}</AppText>
  // Without the Raayonit name (display flag off) or without chains there is nothing to point at: the note stands alone.
  if (!showRaayonit || target.count === 0) return <View style={styles.wrap}><SectionDivider />{note}</View>
  const count = isolateLtr(String(target.count))
  return (
    <View style={styles.wrap}>
      <SectionDivider />
      <View style={styles.strip}>
        <RaayonitPromoStrip
          offer={flagship}
          count={target.count}
          title={target.matched ? t('category_strip_title').replace('{category}', label) : t('category_strip_title_all')}
          sub={(target.matched ? t('category_strip_sub') : t('category_soon_cta_all')).replace('{count}', count)}
          href={target.matched ? raayonitScopeHref(target.ids) : RAAYONIT_HUB}
        />
      </View>
      {note}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  strip: { marginTop: 20 },
  note: { marginTop: 16, fontSize: 14, lineHeight: 20, color: colors.textMuted },
})
