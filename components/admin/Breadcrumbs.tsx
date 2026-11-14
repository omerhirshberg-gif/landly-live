'use client'

import Link from 'next/link'
import { useAdminTrail } from './AdminCrumbContext'
import { useAdminT } from '@/lib/admin/translations'

/**
 * Dashboard › section › page, from the route tree (lib/admin/routes.ts) and
 * the page's own crumb names (AdminCrumbContext.tsx): the same trail the
 * page's BackLink steps up.
 */
export default function Breadcrumbs() {
  const crumbs = useAdminTrail()
  const { t, route, dir } = useAdminT()

  return (
    <nav aria-label={t('breadcrumb.label')} className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => {
          const current = i === crumbs.length - 1
          return (
            <li key={crumb.href} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <i className={`fa-solid fa-chevron-right text-[10px] text-adm-hint ${dir === 'rtl' ? '-scale-x-100' : ''}`} aria-hidden="true" />}
              {current ? (
                <span aria-current="page" className="truncate font-semibold text-adm-text" dir="auto">
                  {route(crumb.label)}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate rounded-md font-medium text-adm-text-2 transition-colors hover:text-adm-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-adm-accent"
                  dir="auto"
                >
                  {route(crumb.label)}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
