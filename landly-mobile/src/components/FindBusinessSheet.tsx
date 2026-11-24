import { useMemo, useState } from 'react'
import { type ImageSourcePropType, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { OfferDocument } from '@shared/firebase/offers'
import { localizedBusinessName } from '@shared/business/businessText'
import { useLocalizedContent } from '@shared/i18n/useLocalizedContent'
import { chainsByCategory, isChain } from '@shared/offers/discoverTab'
import { offerTextSources } from '@shared/offers/offerText'
import { raayonitCategoryName, raayonitCategoryOf } from '@shared/offers/raayonitCategories'
import { chainMatchesSearch } from '@shared/offers/raayonitRegions'
import { redemptionSteps, instructionSteps } from '@shared/offers/redemption'
import { normalizeQuery } from '@shared/perks/perksFilter'
import AppText from './AppText'
import BrandMedia from './BrandMedia'
import { brandImageSource } from '../lib/raayonitBrandImages'
import ContentText from './ContentText'
import LineIcon from './LineIcon'
import ScalePressable from './ScalePressable'
import SheetSlot, { SCRIM_COLOR, useSheetBounds } from './SheetSlot'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

const MARK = require('../../assets/images/raayonit-logo.png') as ImageSourcePropType

// "Find your business" on a pass (web: components/member/FindBusinessDialog.tsx): a bottom sheet with a search over the businesses that honour
// the pass; picking one shows that business's own redemption steps and conditions in the sheet, so the buyer needn't leave the pass.
// `only` opens straight on one business (a single-business pass), with no list.
export default function FindBusinessSheet({ chains, only, onClose }: { chains: OfferDocument[]; only?: OfferDocument; onClose: () => void }) {
  const { t, lang, isRtl } = useLang()
  const [picked, setPicked] = useState<OfferDocument | null>(only ?? null)
  const [query, setQuery] = useState('')
  const list = useMemo(() => chainsByCategory(chains, lang).flatMap((g) => g.offers), [chains, lang])
  const q = normalizeQuery(query)
  const shown = useMemo(() => list.filter((o) => chainMatchesSearch(o, q, t, lang)), [list, q, t, lang])
  const insets = useSafeAreaInsets()
  const bounds = useSheetBounds()
  const canGoBack = !!picked && !only
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => (canGoBack ? setPicked(null) : onClose())}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('avatar_cancel')} />
      <SheetSlot>
        <View style={[styles.sheet, bounds, { paddingBottom: insets.bottom + 8, direction: isRtl ? 'rtl' : 'ltr' }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.head}>
            {canGoBack ? (
              <ScalePressable accessibilityRole="button" onPress={() => setPicked(null)} style={styles.back}>
                <LineIcon name="chevronStart" size={16} color={colors.brand} strokeWidth={2} />
                <AppText style={styles.backText}>{t('voucher_biz_find_back')}</AppText>
              </ScalePressable>
            ) : (
              <AppText accessibilityRole="header" style={styles.title}>{t('voucher_biz_find_title')}</AppText>
            )}
            <Pressable accessibilityRole="button" accessibilityLabel={t('avatar_cancel')} onPress={onClose} hitSlop={8} style={styles.close}>
              <LineIcon name="close" size={20} color={colors.textMuted} strokeWidth={2} />
            </Pressable>
          </View>
          {picked ? (
            <BusinessDetail offer={picked} />
          ) : (
            <>
              <View style={styles.search}>
                <LineIcon name="search" size={16} color={colors.textFaint} strokeWidth={2} />
                <TextInput value={query} onChangeText={setQuery} placeholder={t('voucher_biz_find_search')} placeholderTextColor={colors.textFaint} style={[styles.input, { textAlign: isRtl ? 'right' : 'left' }]} />
              </View>
              {shown.length === 0 && <AppText accessibilityLiveRegion="polite" style={styles.empty}>{t('raayonit_no_results')}</AppText>}
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
                {shown.map((o) => (
                  <ScalePressable key={o.id} accessibilityRole="button" accessibilityLabel={localizedBusinessName(o, lang).text} onPress={() => setPicked(o)} style={styles.row}>
                    <View style={styles.thumb}>
                      <BrandMedia source={brandImageSource(o.imageUrl) ?? MARK} cover={!!o.imageUrl && o.logoKind === 'photo'} recyclingKey={o.id} inset={8} />
                    </View>
                    <View style={styles.rowCopy}>
                      <AppText autoDir numberOfLines={1} style={styles.rowName}>{localizedBusinessName(o, lang).text}</AppText>
                      <AppText numberOfLines={1} style={styles.rowCat}>{raayonitCategoryName(raayonitCategoryOf(o), lang)}</AppText>
                    </View>
                    <LineIcon name="chevronEnd" size={16} color={colors.textFaint} strokeWidth={2} />
                  </ScalePressable>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      </SheetSlot>
    </Modal>
  )
}

// One business: its name, its own redemption steps and conditions, and a link to its full screen.
function BusinessDetail({ offer }: { offer: OfferDocument }) {
  const { t, lang } = useLang()
  const router = useRouter()
  const content = useLocalizedContent(offerTextSources(offer), offer.translations, lang)
  const instructions = content.text('redemptionInstructions')
  const terms = content.text('redemptionTerms')
  const steps = redemptionSteps(offer.redemptionMethod, instructions.text, t, isChain(offer))
  const hasOwn = instructionSteps(instructions.text).length > 0 || terms.text.trim() !== ''
  return (
    <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detail}>
      <View style={styles.rowPlain}>
        <View style={styles.thumb}>
          <BrandMedia source={brandImageSource(offer.imageUrl) ?? MARK} cover={!!offer.imageUrl && offer.logoKind === 'photo'} recyclingKey={offer.id} inset={8} />
        </View>
        <View style={styles.rowCopy}>
          <AppText autoDir numberOfLines={2} style={styles.detailName}>{localizedBusinessName(offer, lang).text}</AppText>
          <AppText numberOfLines={1} style={styles.rowCat}>{raayonitCategoryName(raayonitCategoryOf(offer), lang)}</AppText>
        </View>
      </View>
      <View style={styles.panel}>
        <AppText style={styles.howTitle} accessibilityRole="header">{t('redeem_how_title')}</AppText>
        {steps.map((step, i) => (
          <ContentText key={i} contentLang={instructions.text.trim() ? instructions.lang : null} style={styles.stepText}>{step}</ContentText>
        ))}
        {!!terms.text && (
          <>
            <AppText style={styles.termsLabel} accessibilityRole="header">{t('voucher_redemption_terms_label')}</AppText>
            <ContentText contentLang={terms.lang} style={styles.terms}>{terms.text}</ContentText>
          </>
        )}
      </View>
      {!hasOwn && <AppText style={styles.generic}>{t('voucher_biz_find_generic')}</AppText>}
      {raayonitCategoryOf(offer) === 'hotels' && <AppText style={styles.hotel}>{t('raayonit_hotel_notice')}</AppText>}
      <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/offer/[offerId]', params: { offerId: offer.id } })} style={styles.link}>
        <AppText style={styles.linkText}>{t('voucher_biz_find_open')}</AppText>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: SCRIM_COLOR },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, maxHeight: '92%', ...webOnly({ width: '100%', maxWidth: 720, alignSelf: 'center' }) },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: colors.textFaint, marginBottom: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingBottom: 10 },
  title: { flex: 1, fontSize: 18, fontWeight: '800', letterSpacing: -0.3, color: colors.heading },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  backText: { fontSize: 14, fontWeight: '600', color: colors.brand },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 14, borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#F1F5F9' },
  input: { flex: 1, minWidth: 0, fontSize: 15, color: colors.heading, paddingVertical: 0, ...webOnly({ outlineStyle: 'none' }) },
  empty: { paddingVertical: 24, textAlign: 'center', fontSize: 14, color: colors.textMuted },
  list: { gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: colors.white },
  rowPlain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 80, height: 56, borderRadius: 12, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: '#EEF2F7' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.heading },
  rowCat: { fontSize: 13, color: colors.textMuted },
  detail: { paddingHorizontal: 16, paddingBottom: 12, gap: 14 },
  detailName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, color: colors.heading },
  panel: { padding: 16, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderLight, gap: 10 },
  howTitle: { fontSize: 15, fontWeight: '700', color: colors.heading },
  stepText: { fontSize: 13, lineHeight: 22, color: colors.body },
  termsLabel: { fontSize: 12, fontWeight: '700', color: colors.textStrong, marginTop: 6 },
  terms: { fontSize: 13, lineHeight: 22, color: colors.textMuted },
  generic: { fontSize: 13, lineHeight: 20, color: colors.textMuted },
  hotel: { padding: 12, borderRadius: 16, backgroundColor: '#FFFBEB', fontSize: 13, lineHeight: 20, color: '#78350F' },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 14, fontWeight: '600', color: colors.brand },
})
