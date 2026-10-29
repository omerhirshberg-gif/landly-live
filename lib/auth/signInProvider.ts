import type { TranslationKey } from '../i18n/translations'

// How a member signs in, for Privacy & Security on the website and in the
// app: what the "Sign-in method" card names, and whether it offers Change
// Password. Read from the Firebase user's linked providers. A Landly password
// wins (it's the one thing the card can manage); then Apple, also recognised
// by an Apple private-relay address when the provider list doesn't say;
// then Google. Anything else gets a neutral label, never a guessed one.
// Pure and shared with the Expo app.

export type SignInProvider = 'password' | 'apple' | 'google' | 'other'

export const APPLE_RELAY_DOMAIN = '@privaterelay.appleid.com'

export function signInProvider(user: { email?: string | null; providerData?: readonly { providerId: string }[] | null }): SignInProvider {
  const ids = new Set((user.providerData ?? []).map((p) => p.providerId))
  if (ids.has('password')) return 'password'
  if (ids.has('apple.com') || (user.email ?? '').toLowerCase().endsWith(APPLE_RELAY_DOMAIN)) return 'apple'
  if (ids.has('google.com')) return 'google'
  return 'other'
}

/** The card's title, and the note under it (null for a password account, which gets Change Password instead). */
export function signInProviderCopy(provider: SignInProvider): { title: TranslationKey; note: TranslationKey | null } {
  switch (provider) {
    case 'password':
      return { title: 'security_method_password', note: null }
    case 'apple':
      return { title: 'security_method_apple', note: 'security_apple_note' }
    case 'google':
      return { title: 'security_method_google', note: 'security_google_note' }
    default:
      return { title: 'security_method_other', note: 'security_other_note' }
  }
}
