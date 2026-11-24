import JsTabsLayout from '../../components/tabs/JsTabsLayout'
import { tick } from '../../lib/haptics'

// Android: the shared JS tab bar, so each label is a <Text> that shrinks to fit (single line, never "...") on
// 320-360dp screens and with large system font scales. Same five tabs and physical order as iOS and web.
export { default as ErrorBoundary } from '../../components/RouteErrorBoundary'

export default function TabsLayout() {
  return <JsTabsLayout onTabPress={tick} />
}
