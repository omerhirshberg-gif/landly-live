import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { isChain } from '@shared/offers/discoverTab'
import { useOffers } from '@shared/offers/useOffers'
import AppText from './AppText'
import FindBusinessSheet from './FindBusinessSheet'
import LineIcon from './LineIcon'
import ScalePressable from './ScalePressable'
import { useLang } from '../i18n/LangProvider'
import { colors, radius } from '../theme'

// Under a pass's general "How to redeem" steps: those are the app's general terms, and each business has its own exact details on its
// page, so the buyer is sent there before going. A single-business pass opens its own offer; the button opens a sheet on the pass itself: a multi-chain pass searches the businesses that honour it and shows the picked one's own steps and terms; a single-business pass opens on its business.
// Web: components/member/BusinessPageNotice.tsx.
export default function BusinessPageNotice({ offerId, multiChain }: { offerId: string; multiChain: boolean }) {
  const { t } = useLang()
  const router = useRouter()
  const { offers } = useOffers()
  const [visible, setVisible] = useState(false)
  const chains = useMemo(() => (offers ?? []).filter(isChain), [offers])
  const own = useMemo(() => (offers ?? []).find((o) => o.id === offerId), [offers, offerId])
  // A single-business pass whose live offer can't be read falls back to its screen.
  const open = () => (multiChain || own ? setVisible(true) : router.push({ pathname: '/offer/[offerId]', params: { offerId } }))
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <View style={styles.badge}>
          <LineIcon name="store" size={20} color={colors.brand} strokeWidth={1.75} />
        </View>
        <View style={styles.copy}>
          <AppText style={styles.title}>{t('voucher_biz_notice_title')}</AppText>
          <AppText style={styles.body}>{t('voucher_biz_notice_body')}</AppText>
        </View>
      </View>
      <ScalePressable accessibilityRole="link" accessibilityLabel={t(multiChain ? 'voucher_biz_notice_cta_hub' : 'voucher_biz_notice_cta')} onPress={open} style={styles.button}>
        <AppText style={styles.buttonText}>{t(multiChain ? 'voucher_biz_notice_cta_hub' : 'voucher_biz_notice_cta')}</AppText>
      </ScalePressable>
      {visible && <FindBusinessSheet chains={chains} only={multiChain ? undefined : own} onClose={() => setVisible(false)} />}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { marginTop: 16, padding: 14, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: 'rgba(0,56,184,0.2)', backgroundColor: colors.brandTint },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,56,184,0.1)' },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: colors.textStrong },
  body: { fontSize: 13, lineHeight: 20, color: colors.body },
  button: { marginTop: 12, minHeight: 44, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, backgroundColor: colors.brand },
  buttonText: { fontSize: 14, fontWeight: '700', color: colors.white },
})
