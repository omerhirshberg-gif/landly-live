import { useMemo, useState } from 'react'
import { FlatList, Modal, Platform, Pressable, StyleSheet, TextInput, View, type TextStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import type { CountryCode } from 'libphonenumber-js'
import { countryName, listCountries, toCountry, type Country } from '@shared/auth/onboarding'
import AppText from '../../components/AppText'
import { useModalSidePadding } from '../../components/SheetSlot'
import { useLang } from '../../i18n/LangProvider'
import { webOnly } from '../../lib/webStyles'
import { colors } from '../../theme'

// The phone field's country code: a compact "🇮🇱 +972 ▾" button inside the
// field that opens a searchable sheet of every country. The sheet's list
// scrolls on its own; the sign-up step behind it never does.
export default function CountryCodePicker({ value, onChange }: { value: CountryCode; onChange: (code: CountryCode) => void }) {
  const { t, lang, isRtl } = useLang()
  // Full screen on a phone; from 600pt its content sits in a centred, dialog-wide column.
  const sidePadding = useModalSidePadding()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const current = toCountry(value)

  const countries = useMemo(() => {
    const named = (c: Country) => ({ ...c, name: countryName(c.code, lang) })
    const { pinned, rest } = listCountries()
    return [...pinned.map(named), ...rest.map(named).sort((a, b) => a.name.localeCompare(b.name))]
  }, [lang])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, '')
    if (!q) return countries
    return countries.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q || c.callingCode.startsWith(q))
  }, [countries, query])

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('onb_countryCode')}: +${current.callingCode}`}
        onPress={() => setOpen(true)}
        hitSlop={{ top: 8, bottom: 8 }}
        style={styles.trigger}
      >
        <AppText style={styles.flag}>{current.flag}</AppText>
        <AppText ltr style={styles.code}>
          +{current.callingCode}
        </AppText>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.textFaint} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <Path d="m6 9 6 6 6-6" />
        </Svg>
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined} onRequestClose={close}>
        <SafeAreaView style={[styles.sheet, { direction: isRtl ? 'rtl' : 'ltr', paddingHorizontal: sidePadding }]} edges={['top', 'bottom', 'left', 'right']}>
          <View style={styles.sheetHeader}>
            <AppText accessibilityRole="header" style={styles.sheetTitle}>
              {t('onb_countryCode')}
            </AppText>
            <Pressable accessibilityRole="button" onPress={close} hitSlop={12} style={styles.pointer}>
              <AppText style={styles.close}>{t('onb_close')}</AppText>
            </Pressable>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('onb_countrySearch')}
            placeholderTextColor={colors.textFaint}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            style={[styles.search, { textAlign: isRtl ? 'right' : 'left' }]}
          />
          <FlatList
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            data={matches}
            keyExtractor={(c) => c.code}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            ListEmptyComponent={<AppText style={styles.empty}>{t('onb_countryNoResults')}</AppText>}
            renderItem={({ item }) => {
              const selected = item.code === value
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onChange(item.code)
                    close()
                  }}
                  style={({ pressed }) => [styles.item, (pressed || selected) && styles.itemActive]}
                >
                  <AppText style={styles.flag}>{item.flag}</AppText>
                  <AppText style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </AppText>
                  <AppText ltr style={styles.itemCode}>
                    +{item.callingCode}
                  </AppText>
                </Pressable>
              )
            }}
          />
        </SafeAreaView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    marginStart: -4,
    marginEnd: 12,
    paddingEnd: 12,
    borderEndWidth: 1,
    borderColor: colors.border,
    ...webOnly({ cursor: 'pointer' }),
  },
  flag: { fontSize: 18 },
  code: { fontSize: 16, fontWeight: '600', color: colors.textStrong },
  sheet: { flex: 1, backgroundColor: colors.white },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: colors.textStrong },
  close: { fontSize: 15, fontWeight: '700', color: colors.brand },
  pointer: webOnly({ cursor: 'pointer' }),
  search: {
    marginHorizontal: 20,
    marginBottom: 8,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    fontSize: 16,
    color: colors.textStrong,
    ...webOnly({ outlineWidth: 0, outlineStyle: 'none' as TextStyle['outlineStyle'] }),
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 20, ...webOnly({ cursor: 'pointer' }) },
  itemActive: { backgroundColor: colors.brandLight },
  itemName: { flex: 1, fontSize: 15, color: colors.textStrong },
  itemCode: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  empty: { paddingHorizontal: 20, paddingVertical: 24, color: colors.textMuted, textAlign: 'center' },
})
