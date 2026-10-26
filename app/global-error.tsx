'use client'

import { useEffect, useState } from 'react'
import { House, RotateCw, TriangleAlert } from 'lucide-react'
import './globals.css'
import ErrorScreen from '@/components/errors/ErrorScreen'

// Replaces the root layout when it crashes, so there are no providers here:
// no LangProvider, no auth, no Navbar. It brings its own <html>, fonts and
// a three-string copy table, and reads the saved language straight from
// localStorage (same key as LangProvider). The first paint is English.
const COPY = {
  en: { title: 'Something went wrong', body: 'We hit an unexpected error. Please try again in a moment.', retry: 'Try again', home: 'Back to Home' },
  ru: { title: 'Что-то пошло не так', body: 'Произошла непредвиденная ошибка. Попробуйте ещё раз чуть позже.', retry: 'Попробовать снова', home: 'На главную' },
  es: { title: 'Algo salió mal', body: 'Ocurrió un error inesperado. Inténtalo de nuevo en un momento.', retry: 'Reintentar', home: 'Volver al inicio' },
  fr: { title: "Une erreur s'est produite", body: 'Une erreur inattendue est survenue. Veuillez réessayer dans un instant.', retry: 'Réessayer', home: "Retour à l'accueil" },
  he: { title: 'משהו השתבש', body: 'אירעה שגיאה לא צפויה. נסו שוב בעוד רגע.', retry: 'נסו שוב', home: 'חזרה לדף הבית' },
} as const

type CopyLang = keyof typeof COPY

type ErrorReporter = (type: string, message: unknown, source: unknown) => void

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [lang, setLang] = useState<CopyLang>('en')
  // With ?debug=1 the footnote carries the error itself, for a phone with no inspector attached.
  const [debug, setDebug] = useState(false)

  useEffect(() => {
    console.error('[global-error]', error.name, error.message, error.digest ?? '', error.stack ?? '')
    // Into the log the root layout's <head> script keeps (lib/debug/clientErrorScript.ts), if it ran.
    try {
      const report = (window as Window & { __landlyReportError?: ErrorReporter }).__landlyReportError
      report?.('global-error', `${error.name}: ${error.message}`, error.digest ?? '')
    } catch {
      // Diagnostics never get in the way of the error screen.
    }
  }, [error])

  useEffect(() => {
    try {
      setDebug(new URLSearchParams(window.location.search).get('debug') === '1')
    } catch {
      // No URL to read — no details.
    }
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('landly_lang')
      if (saved && saved in COPY) setLang(saved as CopyLang)
    } catch {
      // localStorage unavailable — stay in English
    }
  }, [])

  const copy = COPY[lang]
  const isRtl = lang === 'he'

  return (
    <html lang={lang} dir={isRtl ? 'rtl' : 'ltr'} className={isRtl ? 'is-rtl' : undefined}>
      <head>
        <title>{`${copy.title} · Landly`}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ErrorScreen
          withNavbar={false}
          icon={TriangleAlert}
          title={copy.title}
          body={copy.body}
          primary={{ label: copy.retry, icon: RotateCw, onClick: () => retry() }}
          secondary={{ label: copy.home, icon: House, href: '/', reload: true }}
          footnote={
            [error.digest ? `Ref: ${error.digest}` : '', debug ? `${error.name}: ${error.message}` : ''].filter(Boolean).join(' · ') || undefined
          }
        />
      </body>
    </html>
  )
}
