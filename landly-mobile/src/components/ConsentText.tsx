import { Fragment } from 'react'
import type { GestureResponderEvent } from 'react-native'
import { StyleSheet, Text } from 'react-native'
import { CONSENT_PATHS, consentParts, type ConsentLink } from '@shared/legal/consentText'
import type { TranslationKey } from '@shared/i18n/translations'
import { colors } from '../theme'

// Native counterpart of components/auth/entrance/ConsentText.tsx: a consent
// sentence whose {terms} / {privacy} placeholders are tappable links. Render
// it inside an AppText (it supplies only nested Text runs).
export default function ConsentText({
  template,
  t,
  onOpen,
}: {
  template: string
  t: (key: TranslationKey) => string
  /** Opens the website page, e.g. in the in-app browser sheet. */
  onOpen: (path: string) => void
}) {
  const open = (link: ConsentLink) => (e: GestureResponderEvent) => {
    // On web the press would otherwise bubble to a surrounding Checkbox.
    e.stopPropagation?.()
    onOpen(CONSENT_PATHS[link])
  }
  return (
    <>
      {consentParts(template).map((part, i) =>
        'link' in part ? (
          <Text key={i} accessibilityRole="link" onPress={open(part.link)} style={styles.link}>
            {t(part.link === 'terms' ? 'legal_terms_link' : 'legal_privacy_link')}
          </Text>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        )
      )}
    </>
  )
}

const styles = StyleSheet.create({
  link: { color: colors.brand, fontWeight: '700' },
})
