import type { TextProps } from 'react-native'
import { directionOf } from '@shared/i18n/contentTranslation'
import AppText from './AppText'
import { useLang } from '../i18n/LangProvider'

// Admin-written content (an offer's title, description, terms) whose
// language can differ from the app's: Hebrew source text on an English
// screen, or a translation. Its own direction decides how it reads (and, on
// an English screen, where it aligns); a Hebrew screen keeps it flush right. As `dir="auto"` + `lang` do on the website; with no known
// language it behaves like AppText (the app's direction).
export default function ContentText({ contentLang, style, ...props }: TextProps & { contentLang: string | null }) {
  const { isRtl } = useLang()
  const dir = directionOf(contentLang)
  return (
    <AppText
      {...props}
      // On an English screen the text's own direction decides. On a Hebrew screen every paragraph runs right-to-left and
      // sits flush right (`textAlign: 'auto'`; iOS puts a physical 'right' on the left under the root's direction).
      style={[style, dir && (isRtl ? { writingDirection: 'rtl', textAlign: 'auto' } : { writingDirection: dir, textAlign: dir === 'rtl' ? 'right' : 'left' })]}
    />
  )
}
