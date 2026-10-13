import { StyleSheet, Text, type TextProps } from 'react-native'
import { useLang } from '../i18n/LangProvider'
import { colors } from '../theme'

// Text that aligns to the active language's reading direction. Layout
// (rows, margins) follows the root view's `direction`; text alignment
// doesn't, so it's set here. Pass `ltr` for codes, emails and numbers: they
// keep left-to-right character order but still align with the text around them.
export default function AppText({ style, ltr, ...props }: TextProps & { ltr?: boolean }) {
  const { isRtl } = useLang()
  return (
    <Text
      {...props}
      style={[
        styles.base,
        { textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl && !ltr ? 'rtl' : 'ltr' },
        style,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  base: { color: colors.text, fontSize: 15 },
})
