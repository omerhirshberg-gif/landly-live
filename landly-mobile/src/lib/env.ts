import Constants from 'expo-constants'
import { normalizeApiBaseUrl, PRODUCTION_API_ORIGIN } from '@shared/apiOrigin'

// Filled by app.config.js. Normalized to the final host, never the apex
// domain that redirects to it (a redirect drops API calls' Authorization
// header) -- even from a manifest cached before that default changed.
export const API_BASE_URL: string = normalizeApiBaseUrl(Constants.expoConfig?.extra?.apiBaseUrl || PRODUCTION_API_ORIGIN)
