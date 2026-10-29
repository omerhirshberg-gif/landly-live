'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { adminParent, adminTrail, type Crumb, type CrumbContext } from '@/lib/admin/routes'

// What the route tree (lib/admin/routes.ts) can't know from the path alone:
// the names of dynamic crumbs, and the business an offer page sits under
// (from its query, which only the page reads, inside its own Suspense
// boundary, then confirms once the offer has loaded). The page reports them
// with useAdminCrumbs; the header's breadcrumbs and title, and the page's own
// BackLink, read the same trail. Outside the shell (unit tests) there's no
// provider and the trail comes from the path alone.

const CrumbStateContext = createContext<{ context: CrumbContext; setContext: (next: CrumbContext) => void } | null>(null)

export function AdminCrumbProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [state, setState] = useState<{ path: string; context: CrumbContext }>({ path: pathname, context: {} })
  const setContext = useCallback((next: CrumbContext) => setState({ path: pathname, context: next }), [pathname])
  // A page's context is only good on that page: dropped as soon as the path changes.
  const context = state.path === pathname ? state.context : {}
  const value = useMemo(() => ({ context, setContext }), [context, setContext])
  return <CrumbStateContext.Provider value={value}>{children}</CrumbStateContext.Provider>
}

/** Called by a page once its data is in: its dynamic crumb labels and (offer pages) its business. */
export function useAdminCrumbs(context: CrumbContext | null) {
  const setContext = useContext(CrumbStateContext)?.setContext
  const key = JSON.stringify(context)
  useEffect(() => {
    if (setContext && context) setContext(context)
    // `key` stands for `context`'s contents, so a new object with the same values doesn't loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setContext, key])
}

function useCrumbInputs(): [string, CrumbContext] {
  const pathname = usePathname()
  const context = useContext(CrumbStateContext)?.context ?? {}
  return [pathname, context]
}

/** Dashboard › … › this page. */
export function useAdminTrail(): Crumb[] {
  const [pathname, context] = useCrumbInputs()
  return adminTrail(pathname, undefined, context)
}

/** The crumb "Back" leads to (and a saved form returns to). */
export function useAdminParent(): Crumb | null {
  const [pathname, context] = useCrumbInputs()
  return adminParent(pathname, undefined, context)
}
