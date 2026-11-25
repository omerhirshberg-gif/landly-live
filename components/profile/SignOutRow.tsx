'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'

// Profile's Sign out: a calm destructive row, not a solid red block (the app's
// twin: src/components/SignOutRow.tsx). A pale rose surface (#fef2f2) with a
// hairline #fecaca border, the label and a line icon in #dc2626, and a deeper
// rose on hover and press. The icon points the reading direction, so it is
// mirrored in Hebrew.
export default function SignOutRow({ onSignOut }: { onSignOut: () => void | Promise<void> }) {
  const { t } = useLang()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await onSignOut()
        } finally {
          setBusy(false)
        }
      }}
      className="tap-target flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] border border-[#fecaca] bg-[#fef2f2] px-5 text-base font-semibold text-[#dc2626] transition-colors duration-150 motion-reduce:transition-none active:bg-[#fecaca] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200 [@media(hover:hover)]:hover:bg-[#fee2e2]"
    >
      <LogOut aria-hidden="true" className="h-5 w-5 rtl:-scale-x-100" strokeWidth={1.75} />
      {t('nav_logout')}
    </button>
  )
}
