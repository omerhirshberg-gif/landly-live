import { StyleSheet, Text, type TextProps } from 'react-native'
import { useLang } from '../i18n/LangProvider'
import { colors } from '../theme'

// Text that sits at the start of the active language's reading direction.
// Layout (rows, margins) follows the root view's `direction`; so must text
// alignment, and iOS resolves `textAlign: 'right'` under that direction onto the
// LEFT edge (and 'left' onto the right), so Hebrew uses `textAlign: 'auto'` with
// an explicit `writingDirection: 'rtl'`, which lands on the right on both
// platforms. Pass `ltr` for codes, emails and numbers: they keep left-to-right
// character order but still sit at the start edge with the text around them.
// Pass `autoDir` for a name typed by someone else (a store, a brand): its own
// script decides the character order, so an English name inside a Hebrew screen
// is not scrambled; on a Hebrew screen it still sits flush right (the paragraph
// runs right-to-left and the name is isolated by its first strong character).
// A style that sets its own textAlign (centre) still wins.
export default function AppText({ style, ltr, autoDir, children, ...props }: TextProps & { ltr?: boolean; autoDir?: boolean }) {
  const { isRtl } = useLang()
  // Only plain text can be wrapped in isolation marks; anything else keeps its own paragraph direction.
  const plain = typeof children === 'string' || typeof children === 'number'
  // A left-to-right value (a code, a phone number, an email) in a Hebrew screen: the paragraph runs
  // right-to-left so it sits at the start edge with its neighbours, and the value is isolated so its own
  // characters keep their order. (`textAlign: 'right'` is not used: iOS puts it on the left under the root's
  // `direction: rtl`.)
  const isolateLtr = isRtl && !!ltr && plain
  const isolateAuto = isRtl && !!autoDir && plain
  return (
    <Text
      {...props}
      style={[
        styles.base,
        isRtl
          ? { writingDirection: ltr && !plain ? 'ltr' : 'rtl', textAlign: 'auto' }
          : autoDir
            ? { writingDirection: 'auto', textAlign: 'auto' }
            : { textAlign: 'left', writingDirection: 'ltr' },
        style,
      ]}
    >
      {isolateLtr ? `\u2066${children}\u2069` : isolateAuto ? `\u2068${children}\u2069` : children}
    </Text>
  )
}

const styles = StyleSheet.create({
  base: { color: colors.text, fontSize: 15 },
})
