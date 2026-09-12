interface SidebarShellProps {
  sidebar: React.ReactNode
  header?: React.ReactNode
  children: React.ReactNode
}

// Shared by the admin and business dashboards: a fixed sidebar plus a content
// area capped at a sensible max-width, flush against the sidebar with padding.
// `mx-auto` here would center the content *within the leftover space next to
// the sidebar* (not on the page), which on wide viewports opens a lopsided gap
// between the sidebar and the content instead of flushing them together --
// that was the actual root cause of the "content floating away from the
// sidebar" bug reported across business and admin pages. Padding-only, no
// auto margins, fixes it in this one shared place for every page that routes
// through here.
export default function SidebarShell({ sidebar, header, children }: SidebarShellProps) {
  return (
    <div className="min-h-screen bg-slate-950">
      {sidebar}
      <main className="md:ps-64">
        {header}
        <div className="max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  )
}
