'use client'

import { useEffect, useState } from 'react'
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

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [lang, setLang] = useState<CopyLang>('en')

  useEffect(() => {
    console.error(error)
  }, [error])

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
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" rel="stylesheet" />
      </head>
      <body>
        <ErrorScreen
          withNavbar={false}
          icon="fa-triangle-exclamation"
          title={copy.title}
          body={copy.body}
          primary={{ label: copy.retry, icon: 'fa-rotate-right', onClick: () => retry() }}
          secondary={{ label: copy.home, icon: 'fa-house', href: '/', reload: true }}
          footnote={error.digest ? `Ref: ${error.digest}` : undefined}
        />
      </body>
    </html>
  )
}
