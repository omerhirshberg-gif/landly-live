import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import 'react-phone-number-input/style.css'
import './globals.css'
import { LangProvider } from '@/lib/i18n/LangProvider'
import PreferredLanguageSync from '@/lib/i18n/PreferredLanguageSync'
import { AuthProvider } from '@/lib/firebase/AuthProvider'
import { WishlistProvider } from '@/lib/firebase/WishlistProvider'
import CookieNotice from '@/components/layout/CookieNotice'
import WhatsAppWidget from '@/components/layout/WhatsAppWidget'
import AccessibilityWidget from '@/components/layout/AccessibilityWidget'
import RouteTracker from '@/components/layout/RouteTracker'
import DevEnvironmentBadge from '@/components/layout/DevEnvironmentBadge'
import JsonLd from '@/components/seo/JsonLd'
import { SITE_URL } from '@/lib/config'
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo/jsonLd'
import { HOME_DESCRIPTION, HOME_TITLE } from '@/lib/seo/site'

// The site-wide defaults (lib/seo/site.ts has the search copy). No canonical
// here: every page would inherit it and claim to be the home page, so the
// public pages set their own (pageMetadata). The share image comes from
// app/opengraph-image.tsx; X falls back to it.
// The heading font (h1, h2, .font-display; globals.css), self-hosted by
// next/font so there's no request to Google and no layout shift. Latin and
// Cyrillic; Hebrew headings stay in Heebo. Exposed as --font-display.
const manrope = Manrope({ subsets: ['latin', 'cyrillic'], weight: ['700', '800'], variable: '--font-display', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: HOME_TITLE, template: '%s | Landly' },
  description: HOME_DESCRIPTION,
  applicationName: 'Landly',
  openGraph: {
    type: 'website',
    siteName: 'Landly',
    locale: 'en_US',
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" dir="ltr" className={manrope.variable}>
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
        {/* Who Landly is and its perk search, for search engines, on every page. */}
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        <AccessibilityWidget />
        <RouteTracker />
        <DevEnvironmentBadge />
        <AuthProvider>
          <WishlistProvider>
            <LangProvider>
              <PreferredLanguageSync />
              {children}
              <WhatsAppWidget />
              <CookieNotice />
            </LangProvider>
          </WishlistProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
