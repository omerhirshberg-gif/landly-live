import { Pressable, StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { formatPrice } from '@shared/format'
import { variantDiscountPercent, type OfferVariant } from '@shared/offers/variants'
import { useLang } from '../i18n/LangProvider'
import { colors } from '../theme'
import AppText from './AppText'

// Web: components/offers/VariantSelector.tsx. A radio group above the price and the Buy bar: each segment states what the
// voucher is worth, what it costs and the saving, and picking one re-prices the page and the checkout.
export default function VariantSelector({ variants, value, onChange, claimed = [] }: {
  variants: OfferVariant[]
  value: string
  onChange: (poolId: string) => void
  /** Pools the member already holds a voucher for: shown, but not selectable. */
  claimed?: readonly string[]
}) {
  const { t } = useLang()
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('offer_variant_group')} style={styles.group}>
      <AppText style={styles.legend}>{t('offer_variant_group')}</AppText>
      <View style={styles.row}>
        {variants.map((v) => {
          const selected = v.poolId === value
          const taken = claimed.includes(v.poolId)
          const off = variantDiscountPercent(v)
          return (
            <Pressable
              key={v.poolId}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: taken }}
              disabled={taken}
              onPress={() => {
                if (!selected) Haptics.selectionAsync().catch(() => {})
                onChange(v.poolId)
              }}
              style={({ pressed }) => [styles.segment, selected && styles.segmentOn, taken && styles.segmentTaken, pressed && !selected && styles.segmentPressed]}
            >
              <AppText ltr style={[styles.worth, selected && styles.worthOn]}>{t('offer_variant_worth').replace('{face}', formatPrice(v.faceValueAgorot / 100))}</AppText>
              <View style={styles.payRow}>
                <AppText ltr style={[styles.pay, selected && styles.payOn]}>{t('offer_variant_pay').replace('{price}', formatPrice(v.priceAgorot / 100))}</AppText>
                {off > 0 && <AppText ltr style={styles.off}>{t('offer_variant_off').replace('{n}', String(off))}</AppText>}
              </View>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  group: { marginTop: 16 },
  legend: { fontSize: 13, fontWeight: '700', color: colors.heading, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10 },
  segment: {
    flex: 1, minHeight: 64, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center', gap: 2,
  },
  segmentOn: { borderColor: colors.brand, borderWidth: 1.5, backgroundColor: colors.brandTint },
  segmentPressed: { backgroundColor: colors.borderLight },
  segmentTaken: { opacity: 0.45 },
  worth: { fontSize: 15, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  worthOn: { color: colors.brand },
  payRow: { flexDirection: 'row', alignItems: 'baseline', columnGap: 8 },
  pay: { fontSize: 13, color: colors.body, fontVariant: ['tabular-nums'] },
  payOn: { color: colors.heading },
  off: { fontSize: 12, fontWeight: '700', color: colors.discount, fontVariant: ['tabular-nums'] },
})
