import { Stack } from 'expo-router'

// Sign in and sign up follow the app language and direction; the root view
// sets `direction` from it (and the onboarding wizard's first card chooses it).
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
