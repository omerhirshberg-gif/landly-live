import { useMemo, useRef, useState } from 'react'
import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native'
import { useChainNetwork } from '@shared/offers/useChainBrands'
import { withChainCount } from '@shared/offers/multiChainNote'
import AppText from './AppText'
import BrandStrip from './BrandStrip'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { useRaayonitDisplay } from '@shared/flags/raayonitDisplayStore'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require('../../assets/images/raayonit-logo.png') as ImageSourcePropType
const LOGO_RATIO = 248 / 442

/** The live size of the Raayonit network (distinct brands on sale), from the offers already loaded. */
export function useNetworkSize() {
  const brands = useChainNetwork()
  return { brands, count: brands.length }
}

/** A Raayonit voucher's credit card, under its code: the Raayonit logo and "issued as a Multi-Chain Super Tav ... valid here and at N more chains". The chosen store stays at the top of the screen. Web: components/member/MultiChainCredit.tsx. */
export function MultiChainCreditBox() {
  const { t } = useLang()
  const { count } = useNetworkSize()
  const display = useRaayonitDisplay()
  const text = withChainCount(t('voucher_multi_chain_credit'), count)
  return (
    <View style={styles.box} accessible accessibilityLabel={text}>
      {display && (
        <View style={styles.tile}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" accessible={false} />
        </View>
      )}
      <AppText style={styles.text}>{text}</AppText>
    </View>
  )
}

/** "Where else can I redeem this voucher? (240+ chains)": folds open to a search over every participating chain. */
export function ChainsAccordion({ defaultOpen = false, onToggle }: { defaultOpen?: boolean; onToggle?: (open: boolean) => void }) {
  const { t } = useLang()
  const { brands, count } = useNetworkSize()
  const display = useRaayonitDisplay()
  const [open, setOpen] = useState(defaultOpen)
  const title = useMemo(() => withChainCount(t('voucher_chains_where_else'), count).replace(/\s*\(\s*\)/, ''), [t, count])
  const ref = useRef(null)
  if (!display || brands.length === 0) return null
  return (
    <View ref={ref} style={styles.fold}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => { setOpen(!open); onToggle?.(!open) }}
        style={styles.foldHeader}
      >
        <AppText accessibilityRole="header" style={styles.foldTitle}>{title}</AppText>
        <LineIcon name="chevronDown" size={20} color={colors.brand} strokeWidth={2} style={open ? styles.open : undefined} />
      </Pressable>
      {open && <View style={styles.foldPanel}><BrandStrip entries={brands} /></View>}
    </View>
  )
}

/** Before purchase, under the denomination selector: the bonus line with a link that opens the chains list. */
export function MultiChainBonus({ onSeeChains }: { onSeeChains: () => void }) {
  const { t } = useLang()
  const { count } = useNetworkSize()
  return (
    <View style={styles.bonus}>
      <LineIcon name="ticket" size={16} color={colors.brand} strokeWidth={1.75} />
      <AppText style={styles.bonusText}>
        {withChainCount(t('offer_multi_chain_bonus'), count)}{' '}
        <AppText accessibilityRole="link" onPress={onSeeChains} style={styles.bonusLink}>{t('offer_chains_link')}</AppText>
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 14, alignSelf: 'stretch', marginTop: 16, padding: 14, borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  tile: { width: 52, height: 52, borderRadius: 12, borderCurve: 'continuous', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  logo: { height: 38, width: 38 * LOGO_RATIO },
  text: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600', color: colors.textStrong },
  fold: { alignSelf: 'stretch', marginTop: 16, borderTopWidth: 1, borderTopColor: colors.borderLight },
  foldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 52, ...webOnly({ cursor: 'pointer' }) },
  foldTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.heading },
  foldPanel: { paddingBottom: 12 },
  open: { transform: [{ rotate: '180deg' }] },
  bonus: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14 },
  bonusText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.body },
  bonusLink: { fontWeight: '700', color: colors.brand, textDecorationLine: 'underline' },
})
