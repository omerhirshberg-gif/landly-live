import { useMemo, useRef } from 'react'
import { Linking, Platform, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SUPPORT_EMAIL } from '@shared/config'
import { isolate } from '@shared/legal/bidi'
import { isLtrToken, privacyPolicy, type PolicyBlock, type PolicyInline } from '@shared/legal/privacyPolicyContent'
import Notice from '../../components/Notice'
import ScreenHeader from '../../components/ScreenHeader'
import { useLang } from '../../i18n/LangProvider'
import { colors, radius } from '../../theme'

// Privacy Policy (web: /privacy), in the settings stack, rendered from the
// shared policy text (lib/legal/privacyPolicyContent.ts, checked word for
// word against the website's) in the member's language and reading
// direction. English is the governing version, so other languages get a note
// above the card saying so. In Hebrew, addresses, numbers, URLs and code are
// wrapped in Unicode isolates so they keep their left-to-right order. The
// contents list and the in-text section links scroll to that section; web
// links and the email address open outside the app. Back (the button or the
// swipe) returns to Settings.
export default function PrivacyScreen() {
  const { t, lang, isRtl } = useLang()
  const policy = useMemo(() => privacyPolicy(lang), [lang])
  const dir: TextStyle = { textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl ? 'rtl' : 'ltr' }
  const ltr = (token: string) => (isRtl ? isolate(token) : token)
  const scrollRef = useRef<ScrollView>(null)
  const offsets = useRef<Record<string, number>>({})
  // Where the card starts in the scroll content (below the language note, when shown).
  const cardY = useRef(0)

  const open = (href: string) => {
    if (href.startsWith('#')) {
      const y = offsets.current[href.slice(1)]
      if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, cardY.current + CARD_INSET + y - 12), animated: true })
    } else Linking.openURL(href).catch(() => {})
  }

  const runs = (parts: PolicyInline[]) =>
    parts.map((part, i) => {
      if (typeof part === 'string') return part
      if ('bold' in part) return <Text key={i} style={styles.bold}>{part.bold}</Text>
      if ('code' in part) return <Text key={i} style={styles.code}>{ltr(part.code)}</Text>
      const href = 'link' in part ? part.href : `mailto:${SUPPORT_EMAIL}`
      const label = 'link' in part ? part.link : SUPPORT_EMAIL
      return (
        <Text key={i} accessibilityRole="link" onPress={() => open(href)} style={styles.link}>
          {isLtrToken(part) ? ltr(label) : label}
        </Text>
      )
    })

  const block = (b: PolicyBlock, key: number) => {
    switch (b.kind) {
      case 'h3':
        return <Text key={key} accessibilityRole="header" style={[styles.text, dir, styles.h3]}>{b.text}</Text>
      case 'p':
        return <Text key={key} style={[styles.text, dir, styles.p]}>{runs(b.text)}</Text>
      case 'callout':
        return (
          <View key={key} style={styles.callout}>
            <Text style={[styles.text, dir, styles.calloutText]}>{runs(b.text)}</Text>
          </View>
        )
      case 'ul':
      case 'ol':
        return (
          <View key={key} style={styles.list}>
            {b.items.map((item, i) => (
              <View key={i} style={styles.item}>
                <Text style={[styles.text, dir, styles.marker]}>{b.kind === 'ol' ? `${i + 1}.` : '•'}</Text>
                <Text style={[styles.text, dir, styles.itemText]}>{runs(item)}</Text>
              </View>
            ))}
          </View>
        )
      case 'address':
        return (
          <View key={key} style={styles.address}>
            {b.lines.map((line, i) => (
              <Text key={i} style={[styles.text, dir]}>{runs(line)}</Text>
            ))}
          </View>
        )
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t('nav_privacy_link')} />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        {lang !== 'en' && (
          <View style={styles.notice}>
            <Notice message={t('legal_translation_notice')} tone="info" />
          </View>
        )}

        <View style={styles.card} onLayout={(e) => (cardY.current = e.nativeEvent.layout.y)}>
          <View>
            <Text accessibilityRole="header" style={[styles.text, dir, styles.title]}>{policy.title}</Text>
            <Text style={[styles.text, dir, styles.updated]}>{policy.updatedLabel} {policy.updatedDate}</Text>
            <Text style={[styles.text, dir, styles.p]}>{runs(policy.intro)}</Text>

            <View style={styles.contents}>
              <Text accessibilityRole="header" style={[styles.text, dir, styles.contentsTitle]}>{policy.contents}</Text>
              {policy.sections.map((s, i) => (
                <Text key={s.id} accessibilityRole="link" onPress={() => open(`#${s.id}`)} style={[styles.text, dir, styles.contentsLink]}>
                  {i + 1}. {s.title}
                </Text>
              ))}
            </View>

            {policy.sections.map((section, i) => (
              <View
                key={section.id}
                style={[styles.section, i > 0 && styles.sectionDivider]}
                // The section's position inside the card, for the jump links.
                onLayout={(e) => {
                  offsets.current[section.id] = e.nativeEvent.layout.y
                }}
              >
                <Text accessibilityRole="header" style={[styles.text, dir, styles.h2]}>
                  {i + 1}. {section.title}
                </Text>
                {section.blocks.map(block)}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const CARD_INSET = 1 + 20 // the card's border and padding
const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  notice: { marginBottom: 12 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 20 },
  text: { color: colors.text, fontSize: 15, lineHeight: 24 },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '800', color: colors.textStrong },
  updated: { marginTop: 2, fontSize: 13, color: colors.textMuted },
  p: { marginTop: 12 },
  contents: { marginTop: 20, padding: 16, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  contentsTitle: { fontSize: 13, fontWeight: '700', color: colors.textStrong, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  contentsLink: { paddingVertical: 4, color: colors.brand },
  section: { paddingTop: 24 },
  sectionDivider: { marginTop: 24, borderTopWidth: 1, borderTopColor: colors.border },
  h2: { fontSize: 19, lineHeight: 26, fontWeight: '800', color: colors.textStrong },
  h3: { marginTop: 16, fontSize: 16, fontWeight: '700', color: colors.textStrong },
  list: { marginTop: 10, gap: 8 },
  item: { flexDirection: 'row', gap: 8 },
  marker: { width: 18, color: colors.textFaint },
  itemText: { flex: 1 },
  bold: { fontWeight: '700', color: colors.textStrong },
  code: { fontFamily: mono, fontSize: 14, backgroundColor: colors.borderLight },
  link: { color: colors.brand, fontWeight: '600', textDecorationLine: 'underline' },
  callout: { marginTop: 12, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brandLight, backgroundColor: colors.brandTint },
  calloutText: { color: colors.textStrong },
  address: { marginTop: 12, padding: 16, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, gap: 2 },
})
