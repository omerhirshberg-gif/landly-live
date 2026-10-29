'use client'

import Link from 'next/link'
import { useAdminTrail } from './AdminCrumbContext'

/**
 * Dashboard › section › page, from the route tree (lib/admin/routes.ts) and
 * the page's own crumb names (AdminCrumbContext.tsx): the same trail the
 * page's BackLink steps up.
 */
export default function Breadcrumbs() {
  const crumbs = useAdminTrail()

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => {
          const current = i === crumbs.length - 1
          return (
            <li key={crumb.href} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <i className="fa-solid fa-chevron-right text-[10px] text-[#CBD5E1]" aria-hidden="true" />}
              {current ? (
                <span aria-current="page" className="truncate font-semibold text-[#0B1B3D]" dir="auto">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate rounded-md font-medium text-[#475569] transition-colors hover:text-[#0038B8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8]"
                  dir="auto"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
