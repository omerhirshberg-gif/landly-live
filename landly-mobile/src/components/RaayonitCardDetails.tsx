import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { OfferDocument } from '@shared/firebase/offers'
import { chainsByCategory } from '@shared/offers/discoverTab'
import { redemptionSteps } from '@shared/offers/redemption'
import { RAAYONIT_ROW_COUNT } from '@shared/offers/raayonitRows'
import { isolateNumbers } from '@shared/inventory/raayonitRedemption'
import AppText from './AppText'
import RaayonitCategoryRail from './RaayonitCategoryRail'
import RaayonitCategorySheet from './RaayonitCategorySheet'
import { useLang } from '../i18n/LangProvider'
import { colors } from '../theme'

// What sits under the value choice on the details screen (web: components/raayonit/RaayonitCardDetails.tsx): what the voucher is and its
// conditions, how to redeem it, and the businesses that accept it as one row with "Show all" and a link to the whole hub.
export default function RaayonitCardDetails({ offer, chains }: { offer: OfferDocument | null; chains: OfferDocument[] }) {
  const { t, lang } = useLang()
  const [all, setAll] = useState(false)
  const list = useMemo(() => chainsByCategory(chains, lang).flatMap((g) => g.offers), [chains, lang])
  const steps = redemptionSteps(offer?.redemptionMethod ?? 'in_store', '', t, true)
  return (
    <View style={styles.wrap}>
      <AppText accessibilityRole="header" style={styles.heading}>{t('raayonit_about_title')}</AppText>
      <View style={styles.box}>
        <AppText style={styles.body}>{t('raayonit_flagship_desc')}</AppText>
        <AppText style={styles.body}>{t('raayonit_hotel_notice')}</AppText>
      </View>
      <AppText accessibilityRole="header" style={styles.heading}>{t('offer_how_title')}</AppText>
      <View style={styles.box}>
        {steps.map((step, i) => <AppText key={i} style={styles.body}>{isolateNumbers(step)}</AppText>)}
      </View>
      {list.length > 0 && (
        <>
          <RaayonitCategoryRail title={t('raayonit_accepting_title')} offers={list.slice(0, RAAYONIT_ROW_COUNT)} hasMore={list.length > RAAYONIT_ROW_COUNT} onShowAll={() => setAll(true)} />
        </>
      )}
      {all && <RaayonitCategorySheet title={t('raayonit_accepting_title')} offers={list} onClose={() => setAll(false)} />}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: 24 },
  heading: { marginTop: 8, marginBottom: 10, fontSize: 19, fontWeight: '800', letterSpacing: -0.3, color: colors.heading },
  box: { gap: 10, padding: 16, marginBottom: 12, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  body: { fontSize: 14, lineHeight: 22, color: colors.textStrong },
})
