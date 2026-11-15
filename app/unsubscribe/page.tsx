import { headers } from 'next/headers'
import { verifyUnsubscribeToken } from '@/lib/newsletter/unsubscribeToken'
import { newsletterLang, NEWSLETTER_LANGS, UNSUBSCRIBE_COPY, type NewsletterLang } from '@/lib/newsletter/unsubscribeCopy'
import UnsubscribeCard from './UnsubscribeCard'

// Where the newsletter's unsubscribe link lands. A pure web page (not a deep
// link into the app): it checks the signed token, shows the address, and one
// press on the button opts it out through /api/newsletter/unsubscribe. A
// link scanner that only opens the page changes nothing. Always rendered in
// ?lang=, else the browser's language, else English, with its own dir so it
// reads right whatever language the site is set to.

export const dynamic = 'force-dynamic'

function languageFromHeader(value: string | null): NewsletterLang {
  for (const part of (value ?? '').split(',')) {
    const code = part.split(';')[0]!.trim().slice(0, 2).toLowerCase()
    if ((NEWSLETTER_LANGS as readonly string[]).includes(code)) return code as NewsletterLang
  }
  return 'en'
}

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string; lang?: string }> }) {
  const { token, lang: langParam } = await searchParams
  const lang = (NEWSLETTER_LANGS as readonly string[]).includes(langParam ?? '') ? newsletterLang(langParam) : languageFromHeader((await headers()).get('accept-language'))
  let email: string | null = null
  try {
    email = verifyUnsubscribeToken(token)
  } catch {
    email = null
  }
  return (
    <main
      lang={lang}
      dir={lang === 'he' ? 'rtl' : 'ltr'}
      className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]"
    >
      <UnsubscribeCard copy={UNSUBSCRIBE_COPY[lang]} token={email ? (token ?? '') : null} email={email} />
    </main>
  )
}
