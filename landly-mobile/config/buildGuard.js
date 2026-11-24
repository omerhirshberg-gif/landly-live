// Build-time environment guard for EAS profiles (docs/STORE_RELEASE.md). Pure CommonJS so app.config.js and the
// tests can both load it. A build that names its EAS profile (EAS_BUILD_PROFILE, set by EAS) must carry the Firebase
// project and API origin of that profile, or the config throws and the build stops: a "production" binary can never
// ship landly-dev values, and a DEV binary can never talk to PROD.
const PROD_PROJECT = 'landly-be752'
const DEV_PROJECT = 'landly-dev'
const PROD_API_ORIGIN = 'https://www.golandly.com'

/** Profile -> the Firebase project it must use. */
const PROFILE_PROJECT = {
  development: DEV_PROJECT,
  preview: DEV_PROJECT,
  testflight: DEV_PROJECT,
  production: PROD_PROJECT,
}

const LOCAL_HOST = /^(?:localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|\[?::1\]?)/i

function hostOf(url) {
  const authority = url.trim().replace(/^[a-z]+:\/\//i, '').split(/[/?#]/)[0]
  return authority.slice(authority.lastIndexOf('@') + 1).split(':')[0].toLowerCase()
}

const PROD_HOST = /^(?:www\.)?golandly\.com$/

/**
 * Returns the list of problems for this profile (empty = fine). `profile` undefined means a local run (Expo Go,
 * `expo start`, `expo run:*`): nothing to enforce.
 */
function guardProblems({ profile, projectId, apiBaseUrl }) {
  if (!profile) return []
  const expected = PROFILE_PROJECT[profile]
  if (!expected) return [`unknown EAS profile "${profile}" (expected one of ${Object.keys(PROFILE_PROJECT).join(', ')})`]
  const problems = []
  if (projectId !== expected) {
    problems.push(`profile "${profile}" must use Firebase project "${expected}", but EXPO_PUBLIC_FIREBASE_PROJECT_ID is "${projectId || '(unset)'}"`)
  }
  const api = (apiBaseUrl || '').trim()
  if (profile === 'production') {
    const normalized = api.replace(/^https?:\/\/golandly\.com(?=[:/?#]|$)/i, PROD_API_ORIGIN).replace(/\/+$/, '')
    if (normalized !== PROD_API_ORIGIN) problems.push(`profile "production" must use EXPO_PUBLIC_API_BASE_URL=${PROD_API_ORIGIN} (got "${api || '(unset)'}")`)
  } else if (profile === 'development') {
    // development: unset, a LAN / localhost address or a DEV URL are all fine, but never the PROD web app.
    if (api && PROD_HOST.test(hostOf(api))) problems.push(`profile "development" must not point at the PROD web app (got "${api}"); use a LAN / localhost address or the DEV web app`)
  } else {
    // preview / testflight: an explicit DEV origin, never local, never PROD, never an unset value that would fall back to PROD.
    if (!api) problems.push(`profile "${profile}" needs an explicit EXPO_PUBLIC_API_BASE_URL for the DEV web app (unset falls back to PROD)`)
    else if (!/^https:\/\//i.test(api)) problems.push(`profile "${profile}" needs an https EXPO_PUBLIC_API_BASE_URL (got "${api}")`)
    else if (LOCAL_HOST.test(hostOf(api))) problems.push(`profile "${profile}" must not use a local EXPO_PUBLIC_API_BASE_URL (got "${api}")`)
    else if (PROD_HOST.test(hostOf(api))) problems.push(`profile "${profile}" must not point at the PROD web app (got "${api}")`)
  }
  return problems
}

function assertBuildEnvironment(input) {
  const problems = guardProblems(input)
  if (problems.length) {
    throw new Error(`EAS build environment guard failed:\n - ${problems.join('\n - ')}\nFix the "${input.profile}" environment variables in EAS (docs/STORE_RELEASE.md).`)
  }
}

module.exports = { PROD_PROJECT, DEV_PROJECT, PROD_API_ORIGIN, PROFILE_PROJECT, guardProblems, assertBuildEnvironment }
