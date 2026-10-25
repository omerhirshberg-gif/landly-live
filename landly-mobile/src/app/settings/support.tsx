import { useState } from 'react'
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { router } from 'expo-router'
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY, SUPPORT_WHATSAPP_LINK, SUPPORT_WHATSAPP_NUMBER } from '@shared/config'
import type { TranslationKey } from '@shared/i18n/translations'
import AppText from '../../components/AppText'
import LineIcon, { type LineIconName } from '../../components/LineIcon'
import ScreenHeader from '../../components/ScreenHeader'
import { useLang } from '../../i18n/LangProvider'
import { webOnly } from '../../lib/webStyles'
import { colors, radius } from '../../theme'

// The team inbox gets the same English subject whatever the app language.
const EMAIL_SUBJECT = 'Landly Support'
const WHATSAPP_GREEN = '#25D366'
// WhatsApp's logo, the same path as the website's floating badge
// (components/layout/WhatsAppWidget.tsx), on a 32px grid.
const WHATSAPP_LOGO =
  'M16.04 3C8.86 3 3.02 8.82 3.02 16c0 2.29.6 4.53 1.74 6.5L3 29l6.68-1.74A13 13 0 0 0 16.04 29C23.2 29 29 23.18 29 16S23.2 3 16.04 3Zm0 23.8c-2.03 0-4.02-.55-5.76-1.58l-.41-.25-3.96 1.03 1.06-3.86-.27-.42A10.76 10.76 0 0 1 5.24 16c0-5.96 4.85-10.8 10.8-10.8 5.95 0 10.78 4.84 10.78 10.8 0 5.95-4.84 10.8-10.78 10.8Zm5.92-8.09c-.32-.16-1.92-.95-2.22-1.06-.3-.11-.51-.16-.73.16-.21.32-.84 1.06-1.03 1.27-.19.22-.38.24-.7.08-.32-.16-1.37-.5-2.6-1.6-.96-.86-1.61-1.91-1.8-2.23-.19-.32-.02-.5.14-.66.15-.14.32-.38.48-.56.16-.19.21-.32.32-.54.11-.21.05-.4-.03-.56-.08-.16-.73-1.75-1-2.4-.26-.63-.53-.54-.73-.55h-.62c-.21 0-.56.08-.86.4-.3.32-1.13 1.1-1.13 2.69 0 1.58 1.16 3.12 1.32 3.33.16.22 2.28 3.48 5.52 4.88.77.33 1.37.53 1.84.68.77.25 1.48.21 2.03.13.62-.09 1.92-.78 2.19-1.54.27-.76.27-1.41.19-1.54-.08-.14-.3-.22-.62-.38Z'

// Opens a chat with the concierge in the WhatsApp app, its first message
// typed in the member's language; without the app (or on the Expo web build)
// wa.me opens it in the browser instead, which hands over to WhatsApp Web or
// the store.
async function openWhatsApp(message: string) {
  const text = encodeURIComponent(message)
  const web = `${SUPPORT_WHATSAPP_LINK}?text=${text}`
  if (Platform.OS === 'web') return Linking.openURL(web)
  try {
    await Linking.openURL(`whatsapp://send?phone=${SUPPORT_WHATSAPP_NUMBER}&text=${text}`)
  } catch {
    await Linking.openURL(web).catch(() => {})
  }
}

function openEmail() {
  return Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(EMAIL_SUBJECT)}`).catch(() => {})
}

// The questions members ask most, from the website's FAQ (same translations).
// "How do I contact support?" is left out: the two cards above answer it.
const FAQ: { q: TranslationKey; a: TranslationKey; seeTerms?: boolean }[] = [
  { q: 'faq1_q', a: 'faq1_a' },
  { q: 'faq4_q', a: 'faq4_a' },
  { q: 'faq5_q', a: 'faq5_a', seeTerms: true },
]

// Support & Help (web: /support), in the settings stack: one tap to the
// WhatsApp concierge or an email to the team, then the common questions as
// an accordion. Back (the button or the swipe) returns to Settings.
export default function SupportScreen() {
  const { t } = useLang()
  const [open, setOpen] = useState<number | null>(null)

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title={t('nav_support_title')} />
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <AppText accessibilityRole="header" style={styles.groupTitle}>{t('support_title')}</AppText>
        <ContactCard
          icon="whatsapp"
          tone="whatsapp"
          title={t('support_whatsapp')}
          value={SUPPORT_WHATSAPP_DISPLAY}
          note={t('support_whatsapp_note')}
          onPress={() => openWhatsApp(t('support_whatsapp_message'))}
        />
        <ContactCard icon="mail" tone="email" title={t('support_email_us')} value={SUPPORT_EMAIL} note={t('support_email_note')} onPress={openEmail} />

        <AppText accessibilityRole="header" style={[styles.groupTitle, styles.faqTitle]}>{t('faq_label')}</AppText>
        <View style={styles.faq}>
          {FAQ.map((item, i) => (
            <FaqItem
              key={item.q}
              question={t(item.q)}
              answer={t(item.a)}
              seeTerms={item.seeTerms}
              open={open === i}
              onToggle={() => setOpen(open === i ? null : i)}
              last={i === FAQ.length - 1}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const TONES = {
  whatsapp: { bg: colors.successBg, border: colors.successBorder, icon: WHATSAPP_GREEN },
  email: { bg: colors.brandLight, border: '#c7dcfb', icon: colors.brand },
} as const

function ContactCard({
  icon,
  tone,
  title,
  value,
  note,
  onPress,
}: {
  /** A line glyph, or WhatsApp's own (filled) logo. */
  icon: LineIconName | 'whatsapp'
  tone: keyof typeof TONES
  title: string
  value: string
  note: string
  onPress: () => void
}) {
  const { isRtl } = useLang()
  const palette = TONES[tone]
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${title}, ${value}`}
      accessibilityHint={note}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: palette.bg, borderColor: palette.border }, pressed && styles.cardPressed]}
    >
      <View style={styles.cardIcon}>
        {icon === 'whatsapp' ? (
          <Svg width={26} height={26} viewBox="0 0 32 32" accessible={false}>
            <Path d={WHATSAPP_LOGO} fill={palette.icon} />
          </Svg>
        ) : (
          <LineIcon name={icon} size={22} color={palette.icon} />
        )}
      </View>
      <View style={styles.cardText}>
        <AppText style={styles.cardTitle}>{title}</AppText>
        <AppText ltr style={styles.cardValue}>{value}</AppText>
        <AppText style={styles.cardNote}>{note}</AppText>
      </View>
      <LineIcon name="chevronEnd" color={colors.textFaint} strokeWidth={2.2} flip={isRtl} />
    </Pressable>
  )
}

function FaqItem({
  question,
  answer,
  seeTerms,
  open,
  onToggle,
  last,
}: {
  question: string
  answer: string
  seeTerms?: boolean
  open: boolean
  onToggle: () => void
  last: boolean
}) {
  const { t } = useLang()
  return (
    <View style={!last && styles.faqBorder}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle} style={styles.faqQuestion}>
        <AppText style={styles.faqQuestionText}>{question}</AppText>
        <LineIcon name="chevronDown" color={colors.textMuted} strokeWidth={2.2} style={open && styles.chevronOpen} />
      </Pressable>
      {open && (
        <AppText style={styles.faqAnswer}>
          {answer}
          {seeTerms && (
            <>
              {' '}
              {t('faq_see_full')}{' '}
              <AppText accessibilityRole="link" onPress={() => router.push('/settings/terms')} style={styles.link}>
                {t('terms_link')}
              </AppText>
              .
            </>
          )}
        </AppText>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  // A centred column no wider than 640pt, so an unfolded foldable or a tablet
  // shows a settings page rather than rows stretched edge to edge.
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  groupTitle: { fontSize: 14, fontWeight: '600', color: colors.textFaint, marginBottom: 8, paddingHorizontal: 4 },
  faqTitle: { marginTop: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    marginBottom: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    ...webOnly({ cursor: 'pointer' }),
  },
  cardPressed: { opacity: 0.85 },
  cardIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.heading },
  cardValue: { marginTop: 2, fontSize: 15, fontWeight: '600', color: colors.brand },
  cardNote: { marginTop: 4, fontSize: 13, lineHeight: 18, color: colors.body },
  faq: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, overflow: 'hidden' },
  faqBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  faqQuestion: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 14, ...webOnly({ cursor: 'pointer' }) },
  faqQuestionText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.heading },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  faqAnswer: { paddingHorizontal: 16, paddingBottom: 16, fontSize: 15, lineHeight: 23, color: colors.body },
  link: { color: colors.brand, fontWeight: '600', textDecorationLine: 'underline' },
})
