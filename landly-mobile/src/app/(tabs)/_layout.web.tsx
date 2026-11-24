import JsTabsLayout from '../../components/tabs/JsTabsLayout'

// Web (Expo export): the shared JS tab bar inside the app's centred phone-width column (see JsTabsLayout).
// A render error here shows the retry card; the rest of the app stays up.
export { default as ErrorBoundary } from '../../components/RouteErrorBoundary'

export default function TabsLayout() {
  return <JsTabsLayout />
}
