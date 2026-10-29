import { useMemo, useState } from 'react'
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View, type TextStyle } from 'react-native'
import { filterCountries, listOriginCountries, type OriginCountry } from '@shared/profile/countryOfOrigin'
import AppText from './AppText'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

type Item = { kind: 'header'; key: string; label: string } | { kind: 'country'; key: string; country: OriginCountry }

// The country-of-origin chooser (web: components/profile/CountryOfOriginPicker.tsx):
// a search field over a list, the common origins first and then every
// country A–Z in the current language. Typing filters by the local name, the
// English name or the ISO code. On the settings screen (`fill`) the list
// takes the rest of the screen and is virtualized; inside the onboarding
// card, which already scrolls, it's a fixed-height nested list instead (a
// FlatList can't sit in a ScrollView of the same direction).
export default function CountryOfOriginList({
  value,
  onChange,
  fill = false,
  error,
}: {
  value: string
  onChange: (code: string) => void
  fill?: boolean
  error?: string | null
}) {
  const { t, lang, isRtl } = useLang()
  const [query, setQuery] = useState('')
  const countries = useMemo(() => listOriginCountries(lang), [lang])

  const items = useMemo<Item[]>(() => {
    const row = (country: OriginCountry): Item => ({ kind: 'country', key: country.code, country })
    if (query.trim()) return filterCountries([...countries.pinned, ...countries.rest], query).map(row)
    return [
      { kind: 'header', key: 'h-common', label: t('origin_common') },
      ...countries.pinned.map(row),
      { kind: 'header', key: 'h-all', label: t('origin_all') },
      ...countries.rest.map(row),
    ]
  }, [countries, query, t])

  const renderItem = (item: Item) => {
    if (item.kind === 'header') {
      return (
        <AppText key={item.key} accessibilityRole="header" style={styles.header}>
          {item.label}
        </AppText>
      )
    }
    const { country } = item
    const selected = country.code === value
    return (
      <Pressable
        key={item.key}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={country.name}
        onPress={() => onChange(country.code)}
        android_ripple={{ color: colors.border }}
        style={({ pressed }) => [styles.item, (pressed || selected) && styles.itemActive]}
      >
        <AppText style={styles.flag}>{country.flag}</AppText>
        <AppText style={[styles.name, selected && styles.nameSelected]} numberOfLines={1}>
          {country.name}
        </AppText>
        {selected && <LineIcon name="check" color={colors.brand} strokeWidth={2.4} />}
      </Pressable>
    )
  }

  const empty = <AppText style={styles.empty}>{t('origin_no_results')}</AppText>

  return (
    <View style={fill && styles.fill}>
      <View style={[styles.searchBox, !!error && styles.searchBoxError]}>
        <LineIcon name="search" size={16} color={colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          accessibilityLabel={t('origin_search_label')}
          placeholder={t('origin_search_placeholder')}
          placeholderTextColor={colors.textFaint}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
          style={[styles.search, { textAlign: isRtl ? 'right' : 'left' }]}
        />
      </View>
      {!!error && <AppText style={styles.error}>{error}</AppText>}
      <View accessibilityRole="radiogroup" style={[styles.list, fill ? styles.fill : styles.inline]}>
        {fill ? (
          <FlatList
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            data={items}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => renderItem(item)}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            initialNumToRender={24}
            ListEmptyComponent={empty}
          />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {items.length ? items.map(renderItem) : empty}
          </ScrollView>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  searchBoxError: { borderColor: colors.danger },
  search: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: colors.textStrong,
    ...webOnly({ outlineWidth: 0, outlineStyle: 'none' as TextStyle['outlineStyle'] }),
  },
  error: { marginTop: -4, marginBottom: 8, fontSize: 12, fontWeight: '600', color: colors.danger },
  list: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, overflow: 'hidden' },
  inline: { height: 300, marginBottom: 20 },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 16, ...webOnly({ cursor: 'pointer' }) },
  itemActive: { backgroundColor: colors.brandLight },
  flag: { width: 28, fontSize: 20, textAlign: 'center' },
  name: { flex: 1, fontSize: 15, color: colors.textStrong },
  nameSelected: { fontWeight: '700', color: colors.brand },
  empty: { paddingHorizontal: 16, paddingVertical: 24, color: colors.textMuted, textAlign: 'center' },
})
