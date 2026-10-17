import { useState } from 'react'
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY, SUPPORT_WHATSAPP_LINK } from '@shared/config'
import type { TranslationKey } from '@shared/i18n/translations'
import AppText from '../../components/AppText'
import LineIcon, { type LineIconName } from '../../components/LineIcon'
import ScreenHeader from '../../components/ScreenHeader'
import { useLang } from '../../i18n/LangProvider'
import { webOnly } from '../../lib/webStyles'
import { colors, radius } from '../../theme'

// The team inbox gets the same English subject whatever the app language.
const EMAIL_SUBJECT = 'Landly Support'
const WHATSAPP_NUMBER = SUPPORT_WHATSAPP_LINK.replace(/\D/g, '')

// Opens a chat with the concierge in the WhatsApp app, its first message
// typed in the member's language; without the app (or on the Expo web build)
// wa.me opens it in the browser instead, which hands over to WhatsApp Web or
// the store.
async function openWhatsApp(message: string) {
  const text = encodeURIComponent(message)
  const web = `${SUPPORT_WHATSAPP_LINK}?text=${text}`
  if (Platform.OS === 'web') return Linking.openURL(web)
  try {
    await Linking.openURL(`whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${text}`)
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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t('nav_support_title')} />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <AppText accessibilityRole="header" style={styles.groupTitle}>{t('support_title')}</AppText>
        <ContactCard
          icon="chat"
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
  whatsapp: { bg: colors.successBg, border: colors.successBorder, icon: colors.success },
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
  icon: LineIconName
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
        <LineIcon name={icon} size={22} color={palette.icon} />
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
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
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
