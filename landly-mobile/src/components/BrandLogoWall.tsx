import { memo, useMemo } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import type { OfferDocument } from '@shared/firebase/offers'
import { RAAYONIT_HUB } from '@shared/offers/offerRoutes'
import { logoWallOffers } from '@shared/home/logoWall'
import { isolateLtr } from '@shared/home/superShowcase'
import { roundedCount } from '@shared/offers/raayonitPreview'
import { localizedBusinessName } from '@shared/business/businessText'
import BrandMedia from './BrandMedia'
import ScalePressable from './ScalePressable'
import SectionHeader from './SectionHeader'
import { useLang } from '../i18n/LangProvider'
import { openOffer } from '../lib/openOffer'
import { brandImageSource } from '../lib/raayonitBrandImages'
import { useLayout } from '../lib/useLayout'
import { colors } from '../theme'

// Home's "Where your card works" (web: components/home/BrandLogoWall.tsx): a strip of real chain logos on white tiles, as a gift-card shop shows
// where its card is accepted. A tile opens that chain's offer screen; the header's link opens the hub. Nothing renders without logos.
export default memo(function BrandLogoWall({ offers }: { offers: OfferDocument[] }) {
  const { t, lang } = useLang()
  const router = useRouter()
  const { paddingLeft, paddingRight } = useLayout()
  const tiles = useMemo(() => logoWallOffers(offers), [offers])
  if (tiles.length < 4) return null
  return (
    <View>
      <SectionHeader
        title={t('home_logo_wall_title')}
        action={t('businesses_see_all').replace('{count}+', isolateLtr(`${roundedCount(offers.length)}+`))}
        onAction={() => router.push(RAAYONIT_HUB)}
      />
      <View style={{ marginLeft: -paddingLeft, marginRight: -paddingRight }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.row, { paddingLeft, paddingRight }]}>
          {tiles.map((o) => {
            const name = localizedBusinessName(o, lang).text
            return (
              <ScalePressable key={o.id} accessibilityRole="button" accessibilityLabel={name} onPress={() => openOffer(o)} style={styles.tile}>
                <BrandMedia source={brandImageSource(o.imageUrl)} cover={o.logoKind === 'photo'} recyclingKey={o.id} inset={8} />
              </ScalePressable>
            )
          })}
        </ScrollView>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  row: { gap: 10, paddingVertical: 4 },
  tile: { width: 104, height: 72, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, backgroundColor: '#EEF2F7', overflow: 'hidden' },
})
