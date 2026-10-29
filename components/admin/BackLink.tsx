'use client'

import BackButton from './BackButton'
import { useAdminParent } from './AdminCrumbContext'

// Deliberately NOT router.back()/browser history -- that leaks whatever tab
// the user happened to be on before jumping to this section via the
// sidebar. "Back" is the page this one sits under in the route tree
// (lib/admin/routes.ts), the same crumb the breadcrumbs show before it, so
// the two can never disagree. (The browser's own back and edge swipe still
// step through history as usual.)
export default function BackLink() {
  const parent = useAdminParent()
  if (!parent) return null
  return (
    <BackButton href={parent.href} className="-ms-3 mb-2">
      <span className="max-w-[16rem] truncate" dir="auto">
        Back to {parent.label === 'Dashboard' ? 'dashboard' : parent.label}
      </span>
    </BackButton>
  )
}
