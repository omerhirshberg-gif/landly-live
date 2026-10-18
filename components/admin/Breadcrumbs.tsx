'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getAdminPageTitle } from '@/lib/admin/pageTitle'

interface Crumb {
  label: string
  href?: string
}

/** Dashboard › section › page, labelled by lib/admin/pageTitle.ts like the rest of the shell. */
export function adminBreadcrumbs(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: getAdminPageTitle('/admin'), href: '/admin' }]
  const section = pathname.split('/')[2]
  if (!section) return [{ label: crumbs[0]!.label }]

  const sectionPath = `/admin/${section}`
  if (pathname === sectionPath) return [...crumbs, { label: getAdminPageTitle(sectionPath) }]
  return [...crumbs, { label: getAdminPageTitle(sectionPath), href: sectionPath }, { label: getAdminPageTitle(pathname) }]
}

export default function Breadcrumbs() {
  const crumbs = adminBreadcrumbs(usePathname())

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => (
          <li key={crumb.label} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <i className="fa-solid fa-chevron-right text-[10px] text-[#CBD5E1] rtl:-scale-x-100" aria-hidden="true" />}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="truncate rounded-md font-medium text-[#475569] transition-colors hover:text-[#0038B8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8]"
              >
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate font-semibold text-[#0B1B3D]">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
