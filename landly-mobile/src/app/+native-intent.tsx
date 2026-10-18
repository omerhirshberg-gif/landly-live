import { appPathForLink } from '@shared/navigation/deepLinks'
import { rememberDeepLink } from '../lib/deepLinks'

// Every link the OS hands the app (landly://offers/{id}, a website URL once
// universal links ship) passes through here before Expo Router sees it. Offer
// and voucher links are mapped onto the app's own routes
// (lib/navigation/deepLinks.ts) and remembered in case sign-in comes first;
// anything else -- the dev client's links included -- goes through unchanged.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const route = appPathForLink(path)
    if (!route) return path
    rememberDeepLink(route)
    return route
  } catch {
    return '/'
  }
}
