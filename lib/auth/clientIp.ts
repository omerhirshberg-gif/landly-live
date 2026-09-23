import 'server-only'
import { isIP } from 'node:net'

/** Trust only Vercel's ingress header, and only when running on Vercel.
 * Other deployments need an explicitly trusted ingress before enabling IP keys.
 * Unknown/malformed addresses share a bucket; arbitrary headers cannot mint keys.
 */
export function clientIp(request: Request): string {
  if (process.env.VERCEL !== '1') return 'unknown'
  const value = request.headers.get('x-vercel-forwarded-for')?.trim() ?? ''
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
