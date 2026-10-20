import type { TextProps } from 'react-native'
import { directionOf } from '@shared/i18n/contentTranslation'
import AppText from './AppText'

// Admin-written content (an offer's title, description, terms) whose
// language can differ from the app's: Hebrew source text on an English
// screen, or a translation. Its own direction decides how it reads and
// aligns, as `dir="auto"` + `lang` do on the website; with no known
// language it behaves like AppText (the app's direction).
export default function ContentText({ contentLang, style, ...props }: TextProps & { contentLang: string | null }) {
  const dir = directionOf(contentLang)
  return (
    <AppText
      {...props}
      style={[style, dir && { writingDirection: dir, textAlign: dir === 'rtl' ? 'right' : 'left' }]}
    />
  )
}
