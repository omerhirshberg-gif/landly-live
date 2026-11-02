import { PRELAUNCH_COPY, PRELAUNCH_PATHS, type PrelaunchLang } from './copy'

// The /join success screen's links, and the browser's memory of a finished
// sign-up. Sharing to WhatsApp often reloads an in-app browser's page when the
// visitor comes back, so the joined state is kept to land them on the success
// screen again rather than on an empty form.
//
// That memory is per tab and short-lived: a phone can be shared, and a lead's
// name must not greet the next person. sessionStorage alone isn't enough, since
// iOS Safari and a desktop browser's session restore bring it back after a
// restart, so an entry also expires. A visitor who returns later and signs up
// again is recognised by the server and gets the same referral code.

export const PRELAUNCH_JOINED_KEY = 'landly_prelaunch_joined'
export const JOINED_TTL_MS = 30 * 60_000

export interface JoinedLead {
  referralCode: string
  firstName: string
}

/** A lead's personal link, on whichever origin served the page, so DEV shares stay on DEV. */
export function referralLink(origin: string, lang: PrelaunchLang, referralCode: string): string {
  return `${origin}${PRELAUNCH_PATHS[lang]}?ref=${encodeURIComponent(referralCode)}`
}

/** The same visit in another language: the campaign query stays, and a ?lang= goes, or /join would redirect straight back. */
export function languageHref(lang: PrelaunchLang, search: string): string {
  const params = new URLSearchParams(search)
  params.delete('lang')
  const query = params.toString()
  return `${PRELAUNCH_PATHS[lang]}${query ? `?${query}` : ''}`
}

export function whatsappShareHref(lang: PrelaunchLang, link: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${PRELAUNCH_COPY[lang].shareText} ${link}`)}`
}

type KeyStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

// Blocked storage (private mode, some webviews) just forgets: the visitor sees
// the form again, and the server recognises them.
export function readJoinedLead(storage: () => KeyStore, now = Date.now()): JoinedLead | null {
  try {
    const parsed = JSON.parse(storage().getItem(PRELAUNCH_JOINED_KEY) ?? 'null')
    if (typeof parsed?.referralCode !== 'string' || typeof parsed?.firstName !== 'string') return null
    const age = now - parsed.savedAt
    if (age >= 0 && age < JOINED_TTL_MS) return { referralCode: parsed.referralCode, firstName: parsed.firstName }
    forgetJoinedLead(storage)
    return null
  } catch {
    return null
  }
}

export function rememberJoinedLead(storage: () => KeyStore, lead: JoinedLead, now = Date.now()): void {
  try {
    storage().setItem(PRELAUNCH_JOINED_KEY, JSON.stringify({ ...lead, savedAt: now }))
  } catch {
    // Storage blocked.
  }
}

export function forgetJoinedLead(storage: () => KeyStore): void {
  try {
    storage().removeItem(PRELAUNCH_JOINED_KEY)
  } catch {
    // Storage blocked.
  }
}
