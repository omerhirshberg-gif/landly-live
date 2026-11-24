import * as Application from 'expo-application'
import * as Updates from 'expo-updates'
import { Platform } from 'react-native'
import { LandlyAppSigning } from '../../modules/landly-app-signing'
import type { GoogleBuildInfo } from '@shared/auth/googleClientHint'

// What this binary and its OTA bundle are, for the Google sign-in error detail (lib/auth/googleClientHint.ts).
// Testers have no debugger, so one screenshot has to say which package, build and update produced a failure
// (e.g. an Android DEVELOPER_ERROR is decided by the package name and signing key Google sees).
// Only JavaScript APIs of modules every build already compiles in (expo-application, expo-updates), so it ships by
// OTA. Every read is guarded: a missing field is left out and this never throws, so it can't mask the real error.

function read<T>(get: () => T | null | undefined): T | undefined {
  try {
    return get() ?? undefined
  } catch {
    return undefined
  }
}

export function nativeBuildInfo(): GoogleBuildInfo {
  // Only Android binaries built with modules/landly-app-signing have this; older builds and iOS leave it out.
  const signing = read(() => LandlyAppSigning?.getInfo())
  return {
    platform: Platform.OS,
    applicationId: read(() => Application.applicationId),
    versionCode: read(() => Application.nativeBuildVersion),
    updateId: read(() => Updates.updateId),
    channel: read(() => Updates.channel),
    runtimeVersion: read(() => Updates.runtimeVersion),
    embedded: read(() => Updates.isEmbeddedLaunch),
    signingSha1: signing?.signingSha1,
    installer: signing?.installer,
  }
}
