import 'server-only'

// The relying party every passkey is bound to. WEBAUTHN_RP_ID is the
// registrable domain (golandly.com in production, so a passkey works on
// www.golandly.com, golandly.com and later the app's associated domain);
// WEBAUTHN_ORIGINS lists the exact origins a ceremony may come from. Left
// unset, both fall back to APP_URL (one origin, its own host as the RP ID),
// which is what local development and staging need. Without either the
// passkey routes answer 503 and the website hides its passkey controls.
export interface WebAuthnConfig {
  rpID: string
  rpName: string
  origins: string[]
}

export function parseWebAuthnConfig(env: {
  WEBAUTHN_RP_ID?: string
  WEBAUTHN_RP_NAME?: string
  WEBAUTHN_ORIGINS?: string
  APP_URL?: string
}): WebAuthnConfig | null {
  const rpName = env.WEBAUTHN_RP_NAME?.trim() || 'Landly'
  let appOrigin: URL | null = null
  try {
    if (env.APP_URL) appOrigin = new URL(env.APP_URL)
  } catch {
    appOrigin = null
  }
  const rpID = env.WEBAUTHN_RP_ID?.trim().toLowerCase() || appOrigin?.hostname || ''
  const listed = (env.WEBAUTHN_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)
  const origins = listed.length ? listed : appOrigin ? [appOrigin.origin] : []
  if (!rpID || !origins.length) return null
  // Every origin must be the RP ID itself or one of its subdomains, or no
  // browser would ever produce a response this server accepts.
  for (const origin of origins) {
    let host: string
    try {
      host = new URL(origin).hostname
    } catch {
      return null
    }
    if (host !== rpID && !host.endsWith(`.${rpID}`)) return null
  }
  return { rpID, rpName, origins }
}

export function webAuthnConfig(): WebAuthnConfig | null {
  const { WEBAUTHN_RP_ID, WEBAUTHN_RP_NAME, WEBAUTHN_ORIGINS, APP_URL } = process.env
  return parseWebAuthnConfig({ WEBAUTHN_RP_ID, WEBAUTHN_RP_NAME, WEBAUTHN_ORIGINS, APP_URL })
}
