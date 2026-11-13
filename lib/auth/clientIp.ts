import 'server-only'
import { isIP } from 'node:net'

/** Validates one address (no lists, ports, brackets or zones) and canonicalizes it; anything else is 'unknown'. */
function parseIp(raw: string | null): string {
  const value = raw?.trim() ?? ''
  if (value.includes('%')) return 'unknown'
  const version = isIP(value)
  if (version === 4) return value
  if (version !== 6) return 'unknown'
  // URL canonicalizes equivalent IPv6 spellings. Collapse IPv4-mapped IPv6 too.
  const normalized = new URL(`http://[${value}]/`).hostname.slice(1, -1)
  if (normalized.startsWith('::ffff:')) {
    const words = normalized.slice(7).split(':').map((word) => parseInt(word, 16))
    if (words.length === 2) return [words[0] >> 8, words[0] & 255, words[1] >> 8, words[1] & 255].join('.')
  }
  return normalized
}

/** The header an operator has declared as set by their own trusted ingress; only ever read off Vercel. */
function trustedIpHeader(): string | null {
  const name = process.env.TRUSTED_IP_HEADER?.trim().toLowerCase() ?? ''
  return /^[a-z0-9-]+$/.test(name) ? name : null
}

let warned = false
function warnPerIpIsolationOff() {
  if (warned || process.env.NODE_ENV !== 'production') return
  warned = true
  console.warn('clientIp: VERCEL is not "1" and TRUSTED_IP_HEADER is not set; per-IP rate limits share a single bucket. Set TRUSTED_IP_HEADER to the header your own proxy overwrites with the client address (e.g. x-real-ip).')
}

/** Trust only Vercel's ingress header on Vercel, or, elsewhere, the one header
 * named by TRUSTED_IP_HEADER (the operator vouches their proxy overwrites it;
 * never point it at a client-settable header). With neither, every caller
 * shares the 'unknown' bucket. Unknown/malformed addresses share a bucket;
 * arbitrary headers cannot mint keys.
 */
export function clientIp(request: Request): string {
  if (process.env.VERCEL === '1') return parseIp(request.headers.get('x-vercel-forwarded-for'))
  const header = trustedIpHeader()
  if (header) return parseIp(request.headers.get(header))
  warnPerIpIsolationOff()
  return 'unknown'
}
