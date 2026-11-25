import type { ComponentProps } from 'react'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'

// A glyph that points the reading direction: a chevron, an arrow, sign out.
// The app keeps I18nManager.allowRTL(false) and flips Hebrew through the root
// view's `direction`, so a vector glyph never mirrors by itself. This is the
// one place that mirrors it: `chevronEnd` / `arrowEnd` / `arrowUpEnd` point
// right in English and left in Hebrew, `chevronStart` / `arrowStart` the
// other way round. Every directional icon goes through here, never through a
// hand-written `flip` or `scaleX`. Web twin: `rtl:-scale-x-100` on lucide icons.
export default function DirectionalIcon(props: Omit<ComponentProps<typeof LineIcon>, 'flip'>) {
  const { isRtl } = useLang()
  return <LineIcon {...props} flip={isRtl} />
}
