import { requireOptionalNativeModule } from 'expo'

export type AppSigningInfo = {
  /** SHA-1 of the certificate this APK is signed with, "AA:BB:..." (20 bytes). */
  signingSha1?: string
  signerCount?: number
  /** Kind of installer only: the Play Store, none (a sideload / adb install) or another store. */
  installer?: 'play' | 'sideload' | 'other'
}

// Android binaries built with this module only. Absent in Expo Go, in older builds, on iOS and on the web, where the
// Google sign-in detail simply leaves the key and installer out (src/auth/nativeBuildInfo.ts).
export const LandlyAppSigning = requireOptionalNativeModule<{ getInfo(): AppSigningInfo }>('LandlyAppSigning')
