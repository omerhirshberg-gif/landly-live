import type { Metadata } from 'next'
import 'react-phone-number-input/style.css'
import './globals.css'
import { LangProvider } from '@/lib/i18n/LangProvider'
import PreferredLanguageSync from '@/lib/i18n/PreferredLanguageSync'
import { AuthProvider } from '@/lib/firebase/AuthProvider'
import { WishlistProvider } from '@/lib/firebase/WishlistProvider'
import CookieNotice from '@/components/layout/CookieNotice'
import AccessibilityWidget from '@/components/layout/AccessibilityWidget'
import RouteTracker from '@/components/layout/RouteTracker'
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '@/lib/config'

// The share image comes from app/opengraph-image.tsx; X falls back to it.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: '%s · Landly' },
  description: SITE_DESCRIPTION,
  applicationName: 'Landly',
  openGraph: {
    type: 'website',
    siteName: 'Landly',
    locale: 'en_US',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          rel="stylesheet"
        />
      </head>
      <body>
        <AccessibilityWidget />
        <RouteTracker />
        <AuthProvider>
          <WishlistProvider>
            <LangProvider>
              <PreferredLanguageSync />
              {children}
              <CookieNotice />
            </LangProvider>
          </WishlistProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
