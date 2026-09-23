import 'server-only'
import { translations, type Lang } from '@/lib/i18n/translations'

// Small helpers shared by the public /api/auth/* email-sending routes.

const KNOWN_LANGS = Object.keys(translations) as Lang[]

export function isValidLang(value: unknown): value is Lang {
  return typeof value === 'string' && (KNOWN_LANGS as string[]).includes(value)
}

export function applicationOrigin(): string {
  const configured = process.env.APP_URL
  if (!configured) throw new Error('APP_URL is not configured')
  const url = new URL(configured)
  const localDevelopment = process.env.NODE_ENV === 'development'
    && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    && url.protocol === 'http:'
  if ((url.protocol !== 'https:' && !localDevelopment)
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('APP_URL must be an HTTPS origin without credentials, path, query, or fragment')
  }
  return url.origin
}
