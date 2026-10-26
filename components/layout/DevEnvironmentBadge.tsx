// "DEV · <project id>" under the navbar's trailing corner during `next dev`, so
// it's always clear which Firebase project the site is talking to (the
// Expo app shows the same badge: landly-mobile/src/components/DevEnvironmentBadge.tsx).
// Clicks pass straight through it and screen readers skip it. A production
// build renders nothing: NODE_ENV is inlined, so this is compiled away.
export default function DevEnvironmentBadge() {
  if (process.env.NODE_ENV !== 'development') return null
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'no project'
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed end-2 top-[calc(4.25rem+env(safe-area-inset-top))] z-[60] inline-flex select-none items-center gap-1.5 rounded-full bg-ink/70 px-2 py-0.5 text-nano font-bold leading-4 tracking-wide text-white backdrop-blur-sm"
      dir="ltr"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
      DEV · {projectId}
    </div>
  )
}
