import 'server-only'
import { translations, type Lang } from '@/lib/i18n/translations'

// Small helpers shared by the public /api/auth/* email-sending routes.

const KNOWN_LANGS = Object.keys(translations) as Lang[]

export function isValidLang(value: unknown): value is Lang {
  return typeof value === 'string' && (KNOWN_LANGS as string[]).includes(value)
}

export function requestOrigin(request: Request): string {
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host = request.headers.get('host')
  return `${proto}://${host}`
}
