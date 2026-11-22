import { StyleSheet, View } from 'react-native'
import type { OfferDocument } from '@shared/firebase/offers'
import AppText from './AppText'
import RaayonitHero from './RaayonitHero'
import { useLang } from '../i18n/LangProvider'
import { colors } from '../theme'

// "Our Products" (web: components/raayonit/ProductsSection.tsx): the landing of Home and Perks. The Raayonit Card is the flagship
// product.
export default function ProductsSection({ flagship }: { flagship: OfferDocument | null }) {
  const { t } = useLang()
  return (
    <View style={styles.wrap}>
      <AppText accessibilityRole="header" style={styles.title}>{t('products_title')}</AppText>
      <AppText style={styles.sub}>{t('products_sub')}</AppText>
      <View style={styles.body}>
        <RaayonitHero offer={flagship} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, color: colors.heading },
  sub: { marginTop: 4, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  body: { marginTop: 18, gap: 16 },
})
