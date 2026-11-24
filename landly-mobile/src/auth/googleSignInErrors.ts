import { FirebaseError } from 'firebase/app'

// Sorts a failure from Android's native Google sheet into the Firebase-style
// codes login.tsx already says in the member's language
// (lib/firebase/authErrors.ts). Kept free of native imports so it is unit
// tested. The library's status codes (cancelled, in progress, Play services)
// are passed in by googleSignIn.android.ts; everything else is read from the
// native code and message, because the library only names a few of them.
//
// Why this exists: every unrecognised native failure used to become
// 'auth/internal-error', so a wrong signing key (Google's DEVELOPER_ERROR,
// code 10) looked exactly like a Firebase failure. The original native code
// now stays in the error message (logged by logAuthError, never shown).

export type GoogleStatusCodes = { SIGN_IN_CANCELLED: string; IN_PROGRESS: string; PLAY_SERVICES_NOT_AVAILABLE: string }

// Code 10 / DEVELOPER_ERROR from Play services, or 28444 "Developer console is not set up correctly" from Credential Manager.
const DEVELOPER_ERROR = /developer[\s_-]?(?:error|console)|\b(?:10|28444)\b/i
const NETWORK_ERROR = /network|timeout|timed out|unreachable|offline|connection/i

function nativeDetail(err: unknown): string {
  const { code, message } = (err ?? {}) as { code?: unknown; message?: unknown }
  const parts = [typeof code === 'string' || typeof code === 'number' ? `code=${code}` : '', typeof message === 'string' ? message : '']
  return parts.filter(Boolean).join(' ').slice(0, 300)
}

/** The Firebase-style error for a native Google sign-in failure. */
export function translateGoogleNativeError(err: unknown, codes: GoogleStatusCodes): FirebaseError {
  const { code, message } = (err ?? {}) as { code?: unknown; message?: unknown }
  if (code === codes.SIGN_IN_CANCELLED) return new FirebaseError('auth/popup-closed-by-user', 'Google sign-in was cancelled')
  if (code === codes.IN_PROGRESS) return new FirebaseError('auth/cancelled-popup-request', 'Google sign-in is already in progress')
  if (code === codes.PLAY_SERVICES_NOT_AVAILABLE) {
    return new FirebaseError('auth/google-play-services-unavailable', 'Google Play services is not available')
  }
  const detail = nativeDetail(err)
  const text = `${typeof code === 'string' || typeof code === 'number' ? code : ''} ${typeof message === 'string' ? message : ''}`
  // The app's package name and signing SHA-1 are not on an Android OAuth client in the Firebase project's Google Cloud project.
  if (DEVELOPER_ERROR.test(text)) return new FirebaseError('auth/google-config-error', `Google sign-in is not configured for this build (${detail})`)
  if (NETWORK_ERROR.test(text)) return new FirebaseError('auth/network-request-failed', `Google sign-in could not reach Google (${detail})`)
  return new FirebaseError('auth/internal-error', `Google sign-in failed (${detail})`)
}
