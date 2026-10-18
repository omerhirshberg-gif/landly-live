import type { Metadata, Viewport } from 'next'
import AuthScreen from '@/components/auth/entrance/AuthScreen'

export const metadata: Metadata = { title: 'Sign In' }

// viewport-fit=cover lets the screen run edge to edge on notched phones; it
// pads itself with the safe-area insets, like the native app.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f8fafc',
}

export default function LoginPage() {
  return <AuthScreen initialMode="signIn" />
}
