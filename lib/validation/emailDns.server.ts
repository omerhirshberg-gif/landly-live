import 'server-only'
import { promises as dns } from 'node:dns'
import { emailDomain } from './email'

// Can this address's domain receive mail at all? Catches "name@icloiud.com"
// before a welcome email or a code bounces. It rejects only when DNS says the
// domain definitely cannot take mail (does not exist, no MX and no A/AAAA to
// fall back on, or a null MX); every other outcome, including timeouts and
// resolver errors, lets the address through, so a DNS blip never turns away a
// real person. Answers are cached per domain for ten minutes.

export type MailDomainStatus = 'ok' | 'invalid'

const LOOKUP_TIMEOUT_MS = 2500
const CACHE_TTL_MS = 10 * 60 * 1000
const CACHE_MAX = 2000

/** DNS codes meaning "this name has no such records", as opposed to a failed lookup. */
const DEFINITIVE = new Set(['ENOTFOUND', 'ENODATA', 'NXDOMAIN'])

const cache = new Map<string, { status: MailDomainStatus; at: number }>()

class LookupTimeout extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new LookupTimeout('dns timeout')), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

type Resolvers = Pick<typeof dns, 'resolveMx' | 'resolve4' | 'resolve6'>

const isDefinitive = (err: unknown): boolean => {
  const code = (err as { code?: string } | null)?.code
  return !!code && DEFINITIVE.has(code)
}

/** Resolves the status without the cache; `resolvers` is injectable for tests. */
export async function lookupMailDomain(domain: string, resolvers: Resolvers = dns): Promise<MailDomainStatus> {
  try {
    const mx = await withTimeout(resolvers.resolveMx(domain), LOOKUP_TIMEOUT_MS)
    if (mx.length > 0) {
      // A single null MX ("0 .") is an explicit "this domain takes no mail".
      const onlyNull = mx.every((record) => record.exchange === '' || record.exchange === '.')
      return onlyNull ? 'invalid' : 'ok'
    }
    // Empty answer: fall through to the implicit-MX rule.
  } catch (err) {
    if (!isDefinitive(err)) return 'ok'
    // ENODATA / ENOTFOUND on MX: the domain may still exist with only an A record.
  }

  // RFC 5321 section 5.1: with no MX, the domain's own address is the mail host.
  const probes = await Promise.allSettled([
    withTimeout(resolvers.resolve4(domain), LOOKUP_TIMEOUT_MS),
    withTimeout(resolvers.resolve6(domain), LOOKUP_TIMEOUT_MS),
  ])
  for (const probe of probes) {
    if (probe.status === 'fulfilled' && probe.value.length > 0) return 'ok'
    // A failed (not "no such record") probe could hide a real address: fail open.
    if (probe.status === 'rejected' && !isDefinitive(probe.reason)) return 'ok'
  }
  return 'invalid'
}

/** 'invalid' only when the address's domain definitely cannot receive mail. */
export async function checkMailDomain(email: string, resolvers?: Resolvers): Promise<MailDomainStatus> {
  const domain = emailDomain(email)
  if (!domain) return 'invalid'
  const now = Date.now()
  const hit = cache.get(domain)
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.status
  const status = await lookupMailDomain(domain, resolvers)
  if (cache.size >= CACHE_MAX) cache.clear()
  cache.set(domain, { status, at: now })
  return status
}

/** For tests. */
export function clearMailDomainCache(): void {
  cache.clear()
}
