import { auth } from './config'

// A live listener refused with permission-denied may mean this session was
// revoked on another device ("Sign out of all devices", an email change):
// the rules' authFresh() refuses it at once, while the SDK itself would only
// find out at its next hourly token refresh. Forcing that refresh now ends a
// revoked session straight away -- Firebase signs out on
// auth/user-token-expired, and the screens move to the login form (in the
// app, past the lock) as on any sign-out. A session that's still valid just
// gets a new token. One check at a time, however many listeners fail.
let checking: Promise<void> | null = null

export function recheckSessionIfDenied(error: unknown): void {
  if ((error as { code?: unknown } | null)?.code !== 'permission-denied') return
  const user = auth.currentUser
  if (!user || checking) return
  checking = user
    .getIdToken(true)
    .then(() => {})
    .catch(() => {})
    .finally(() => {
      checking = null
    })
}
