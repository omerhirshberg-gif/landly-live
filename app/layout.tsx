import type { Metadata } from 'next'
import './globals.css'
import { LangProvider } from '@/lib/i18n/LangProvider'
import { AuthProvider } from '@/lib/firebase/AuthProvider'
import { PerkCollectionsProvider } from '@/lib/firebase/PerkCollectionsProvider'

export const metadata: Metadata = {
  title: 'Landly — Live Israel Like a Local',
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
        <AuthProvider>
          <PerkCollectionsProvider>
            <LangProvider>{children}</LangProvider>
          </PerkCollectionsProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
