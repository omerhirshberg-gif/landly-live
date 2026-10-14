import Constants from 'expo-constants'
import { devApiOrigin, normalizeApiBaseUrl, PRODUCTION_API_ORIGIN } from '@shared/apiOrigin'

// In order: EXPO_PUBLIC_API_BASE_URL (via app.config.js); in development, the
// `next dev` server on port 3000 of the machine running Metro (so the API and
// the in-app browser pages reach the local web app); otherwise production.
// Normalized to the final host, never the apex domain that redirects to it (a
// redirect drops API calls' Authorization header) -- even from a manifest
// cached before that default changed.
export const API_BASE_URL: string = normalizeApiBaseUrl(
  Constants.expoConfig?.extra?.apiBaseUrl ||
    (__DEV__ && devApiOrigin(Constants.expoConfig?.hostUri)) ||
    PRODUCTION_API_ORIGIN,
)
