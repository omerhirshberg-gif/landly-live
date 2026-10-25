import { PRODUCTION_FIREBASE_PROJECT_ID, STAGING_FIREBASE_PROJECT_ID } from '@/lib/firebase/envGuard'

// Which Firebase project every admin write lands in, in the admin header on
// every build (unlike the site's DevEnvironmentBadge, which is `next dev`
// only): red PROD for the production project, amber DEV for the staging
// one (lib/firebase/envGuard.ts), so live data is never edited by mistake.
// A Vercel Preview reads DEV, which is right: it runs on staging. Phones show a
// compact pill with just the word; the project id joins it from 640px, and the
// full name is in the tooltip.
const TONES = {
  prod: 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]',
  dev: 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]',
  other: 'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]',
} as const

const DOTS = { prod: 'bg-[#DC2626]', dev: 'bg-[#F59E0B]', other: 'bg-[#94A3B8]' } as const

export function adminEnvironment(projectId: string | undefined): { tone: keyof typeof TONES; label: string; projectId: string } {
  const id = projectId || 'no project'
  if (projectId === PRODUCTION_FIREBASE_PROJECT_ID) return { tone: 'prod', label: 'PROD', projectId: id }
  if (projectId === STAGING_FIREBASE_PROJECT_ID) return { tone: 'dev', label: 'DEV', projectId: id }
  return { tone: 'other', label: '?', projectId: id }
}

export default function AdminEnvironmentBadge() {
  // A literal read, so Next.js inlines it into the browser bundle.
  const { tone, label, projectId } = adminEnvironment(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
  return (
    <span
      title={`Firebase project: ${projectId}`}
      className={`inline-flex h-7 shrink-0 select-none items-center gap-1 whitespace-nowrap rounded-full border px-2 text-[11px] font-bold tracking-wide sm:h-8 sm:gap-1.5 sm:px-2.5 sm:text-xs ${TONES[tone]}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${DOTS[tone]}`} aria-hidden="true"></span>
      {label}
      <span className="hidden font-semibold sm:inline">({projectId})</span>
    </span>
  )
}
