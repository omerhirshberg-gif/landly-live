import 'server-only'
import { getAdminAccessToken, getAdminProjectId } from '@/lib/firebase/admin'
import { recordUsageBatch } from '@/lib/usage/recordUsage'
import type { Translator } from './offerTranslations'

// Cloud Translation v3 over REST, authorized by the Firebase Admin service
// account (no API key to leak or rotate). Called only from the admin routes,
// once per offer save and only for fields whose text changed, so the cost is
// bounded by how often admins edit offers -- never by traffic.
//
// Env (docs/google-cloud-configuration.md):
//   LANDLY_TRANSLATION_ENABLED=true     anything else: offers save untranslated
//   GOOGLE_TRANSLATE_LOCATION=global    or the glossary's region
//   GOOGLE_TRANSLATE_GLOSSARY=projects/…/locations/…/glossaries/…   optional
//
// Every successful call adds its characters to the month's usage counters
// (lib/usage/recordUsage.ts) for /admin/system/costs.

const API = 'https://translation.googleapis.com/v3'
const TIMEOUT_MS = 8000

export function isTranslationEnabled(): boolean {
  return process.env.LANDLY_TRANSLATION_ENABLED === 'true'
}

function parent(): string {
  const location = process.env.GOOGLE_TRANSLATE_LOCATION?.trim() || 'global'
  return `projects/${getAdminProjectId()}/locations/${location}`
}

// Google bills per character (a code point), whatever its size in bytes.
const characters = (texts: string[]) => texts.reduce((sum, text) => sum + [...text].length, 0)

async function call<T>(method: 'translateText' | 'detectLanguage', body: Record<string, unknown>, billed: string[]): Promise<T> {
  const res = await fetch(`${API}/${parent()}:${method}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await getAdminAccessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Cloud Translation ${method} failed (${res.status}): ${detail.slice(0, 300)}`)
  }
  const counter = method === 'translateText' ? 'google.translation.chars' : 'google.translation.detectChars'
  recordUsageBatch({ [counter]: characters(billed), 'google.translation.requests': 1 })
  return (await res.json()) as T
}

export const cloudTranslator: Translator = {
  async detect(text) {
    const data = await call<{ languages?: { languageCode?: string }[] }>('detectLanguage', { content: text, mimeType: 'text/plain' }, [text])
    return data.languages?.[0]?.languageCode ?? null
  },
  async translate(texts, targetLang, sourceLang) {
    const glossary = process.env.GOOGLE_TRANSLATE_GLOSSARY?.trim()
    const data = await call<{ translations?: { translatedText?: string }[]; glossaryTranslations?: { translatedText?: string }[] }>(
      'translateText',
      {
        contents: texts,
        mimeType: 'text/plain',
        sourceLanguageCode: sourceLang,
        targetLanguageCode: targetLang,
        ...(glossary ? { glossaryConfig: { glossary } } : {}),
      },
      texts
    )
    const results = glossary && data.glossaryTranslations?.length ? data.glossaryTranslations : data.translations
    if (!results || results.length !== texts.length) throw new Error('Cloud Translation returned an unexpected number of results.')
    return results.map((result) => result.translatedText ?? '')
  },
}

/** The translator to use for this request, or null while translation is switched off. */
export function activeTranslator(): Translator | null {
  return isTranslationEnabled() ? cloudTranslator : null
}
