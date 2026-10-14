import type { Viewport } from 'next'
import AuthScreen from '@/components/auth/entrance/AuthScreen'

// Same screen as /login, opened on the Sign Up tab.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f8fafc',
}

export default function SignupPage() {
  return <AuthScreen initialMode="signUp" />
}
