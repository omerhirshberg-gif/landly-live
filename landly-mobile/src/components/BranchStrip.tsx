import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { branchLine, localizedBranch, type OfferBranch } from '@shared/offers/branches'
import { parsePhones } from '@shared/offers/contact'
import { Linking } from 'react-native'
import AppText from './AppText'
import BranchNavigationSheet, { type BranchTarget } from './BranchNavigationSheet'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import useRailStart from '../lib/useRailStart'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// A single brand's branches as a row of cards: the branch's name, its city and street, a kosher tag when it is, its phone with a Call action, and a Directions
// action that opens the Waze / Google Maps chooser. Past 8 branches a city filter narrows the row. Web: components/offers/BranchStrip.tsx.
export default function BranchStrip({ branches, brand }: { branches: readonly OfferBranch[]; brand: string | null }) {
  const { t, lang, isRtl } = useLang()
  const [city, setCity] = useState<string | null>(null)
  const [picked, setPicked] = useState<BranchTarget | null>(null)
  const [pillRef, onPillSize] = useRailStart<ScrollView>()
  const [cardRef, onCardSize] = useRailStart<ScrollView>(city)
  const cities = useMemo(() => {
    const seen = new Map<string, string>()
    for (const b of branches) if (b.city && !seen.has(b.city)) seen.set(b.city, localizedBranch(b, lang).city || b.city)
    return [...seen]
  }, [branches, lang])
  const shown = city ? branches.filter((b) => b.city === city) : branches
  return (
    <View style={styles.wrap}>
      {branches.length > 8 && cities.length > 1 && (
        <ScrollView ref={pillRef} onContentSizeChange={onPillSize} horizontal showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.pills}>
          {[[null, t('branch_all_cities')] as const, ...cities].map(([key, label]) => (
            <Pressable key={key ?? 'all'} accessibilityRole="button" accessibilityState={{ selected: city === key }} onPress={() => setCity(key)} style={[styles.pill, city === key && styles.pillOn]}>
              <AppText style={[styles.pillText, city === key && styles.pillTextOn]}>{label}</AppText>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {shown.length === 0 ? (
        <AppText style={styles.empty}>{t('branch_no_results')}</AppText>
      ) : (
        <ScrollView ref={cardRef} onContentSizeChange={onCardSize} horizontal showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {shown.map((b, i) => {
            const text = localizedBranch(b, lang)
            const phones = parsePhones(b.phone).slice(0, 3)
            const phone = phones[0] ?? null
            return (
              <View key={`${b.name}-${i}`} style={[styles.card, styles.accent]}>
                <AppText autoDir numberOfLines={2} style={styles.name}>{text.name}</AppText>
                <AppText autoDir numberOfLines={2} style={styles.where}>{[text.address, text.city && !text.address.includes(text.city) ? text.city : ''].filter(Boolean).join(', ')}</AppText>
                {b.kosher && <AppText style={styles.kosher}>{t('branch_kosher')}</AppText>}
                {phones.map((p) => <AppText key={p.href} ltr style={styles.phone}>{p.display}</AppText>)}
                <View style={styles.actions}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${t('branch_directions')}: ${text.name}`} onPress={() => setPicked({ label: branchLine(b, lang), name: branchLine(b, 'he'), brand })} style={({ pressed }) => [styles.go, pressed && styles.goPressed]}>
                    <LineIcon name="navigation" size={14} color={colors.brand} strokeWidth={2} />
                    <AppText style={styles.goText}>{t('branch_directions')}</AppText>
                  </Pressable>
                  {phone && (
                    <Pressable accessibilityRole="link" accessibilityLabel={`${t('branch_call')}: ${text.name} ${phone.display}`} onPress={() => Linking.openURL(phone.href).catch(() => {})} style={({ pressed }) => [styles.go, pressed && styles.goPressed]}>
                      <LineIcon name="call" size={14} color={colors.brand} strokeWidth={2} />
                      <AppText style={styles.goText}>{t('branch_call')}</AppText>
                    </Pressable>
                  )}
                </View>
              </View>
            )
          })}
        </ScrollView>
      )}
      <BranchNavigationSheet branch={picked} onClose={() => setPicked(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  pills: { flexDirection: 'row', gap: 8, minWidth: '100%' },
  pill: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  pillOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.textStrong },
  pillTextOn: { color: '#FFFFFF' },
  rail: { flexDirection: 'row', gap: 10, paddingVertical: 2, minWidth: '100%' },
  card: { width: 232, minHeight: 132, gap: 6, padding: 14, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  // The accent stripe sits at the card's start edge: logical, since a physical left/right border is mirrored by the root's `direction: rtl` on iOS.
  accent: { borderStartWidth: 4, borderStartColor: colors.brand },
  name: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: colors.textStrong },
  where: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  kosher: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '700', color: colors.textStrong, backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  phone: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.textStrong },
  actions: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 16 },
  go: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, ...webOnly({ cursor: 'pointer' }) },
  goPressed: { opacity: 0.6 },
  goText: { fontSize: 13, fontWeight: '700', color: colors.brand },
  empty: { fontSize: 14, color: colors.textMuted },
})
