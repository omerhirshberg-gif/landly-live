'use client'

import { useLang } from '@/lib/i18n/useLang'
import PrivacyPolicy from './PrivacyPolicy'

// /privacy in the member's language and reading direction. The server HTML is
// the English default (LangProvider starts in English), so the full governing
// text is in the first response; the saved language takes over on the client.
export default function LocalizedPrivacyPolicy() {
  const { lang } = useLang()
  return <PrivacyPolicy lang={lang} />
}
