import { FirebaseError } from 'firebase/app'

const MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'Could not create an account. Please try again, or try signing in or resetting your password.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Password should be at least 6 characters.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  // Apple or Google with an email that already has a Landly account made another way.
  // A Google or Apple session Firebase didn't mark verified (signInCustomer.ts signs it out).
  'auth/unverified-provider-email': "We couldn't confirm your email with that account. Please try again or sign in with your email.",
  'auth/account-exists-with-different-credential': 'An account with this email already exists. Sign in the way you first signed up.',
  'auth/expired-action-code': 'This link has expired. Please request a new one.',
  'auth/invalid-action-code': 'This link is invalid or has already been used.',
  'auth/requires-recent-login': 'Please sign in again to complete this action.',
}

export function getAuthErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    return MESSAGES[err.code] ?? 'Something went wrong. Please try again.'
  }
  return 'Something went wrong. Please try again.'
}
