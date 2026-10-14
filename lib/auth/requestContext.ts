import 'server-only'
import { translations, type Lang } from '@/lib/i18n/translations'

// Small helpers shared by the public /api/auth/* email-sending routes.

const KNOWN_LANGS = Object.keys(translations) as Lang[]

export function isValidLang(value: unknown): value is Lang {
  return typeof value === 'string' && (KNOWN_LANGS as string[]).includes(value)
}

// Private LAN IPv4 ranges (RFC 1918), so in development APP_URL can be this
// machine's network address and email links open on a phone on the same Wi-Fi.
const PRIVATE_LAN_IPV4 = [
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
]

function isLocalDevelopmentHost(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname) || PRIVATE_LAN_IPV4.some((re) => re.test(hostname))
}

export function applicationOrigin(): string {
  const configured = process.env.APP_URL
  if (!configured) throw new Error('APP_URL is not configured')
  const url = new URL(configured)
  const localDevelopment = process.env.NODE_ENV === 'development'
    && isLocalDevelopmentHost(url.hostname)
    && url.protocol === 'http:'
  if ((url.protocol !== 'https:' && !localDevelopment)
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('APP_URL must be an HTTPS origin without credentials, path, query, or fragment')
  }
  return url.origin
}
