// Where the /join page points. Each link can be overridden per deployment with a
// NEXT_PUBLIC_ variable, read literally so the bundler inlines it. Only an https
// link is ever rendered: anything else falls back to the known-good address.

export function httpsLink(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  try {
    return new URL(value).protocol === 'https:' ? value : fallback
  } catch {
    return fallback
  }
}

export const INSTAGRAM_URL = httpsLink(process.env.NEXT_PUBLIC_INSTAGRAM_URL, 'https://www.instagram.com/golandly/')
export const FACEBOOK_URL = httpsLink(process.env.NEXT_PUBLIC_FACEBOOK_URL, 'https://www.facebook.com/golandly/')
export const LINKEDIN_URL = httpsLink(process.env.NEXT_PUBLIC_LINKEDIN_URL, 'https://www.linkedin.com/company/golandly/')
export const WHATSAPP_COMMUNITY_URL = httpsLink(process.env.NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL, 'https://chat.whatsapp.com/GC9Ais2kDVYKwRQ9rHVYKM')
