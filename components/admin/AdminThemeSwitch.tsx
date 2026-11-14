'use client'

import { useAdminT } from '@/lib/admin/translations'
import { useAdminTheme, type AdminTheme } from '@/lib/admin/adminTheme'

const OPTIONS: readonly { value: AdminTheme; labelKey: 'theme.dark' | 'theme.light' }[] = [
  { value: 'dark', labelKey: 'theme.dark' },
  { value: 'light', labelKey: 'theme.light' },
]

// The admin's background: [ Dark | Light ], laid out like AdminLangSwitch.
// The labels are words in the admin's language, so they follow it.
export default function AdminThemeSwitch({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useAdminTheme()
  const { t } = useAdminT()
  return (
    <div role="group" aria-label={t('settings.theme')} className={`inline-flex h-11 items-center gap-1 rounded-xl border border-adm-line bg-adm-sunken p-1 ${className}`}>
      {OPTIONS.map((option) => {
        const selected = option.value === theme
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => setTheme(option.value)}
            className={`inline-flex h-full min-h-11 min-w-11 flex-1 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent/50 ${
              selected ? 'bg-adm-nav-active text-adm-nav-active-text shadow-sm' : 'text-adm-text-2 hover:text-adm-text'
            }`}
          >
            {t(option.labelKey)}
          </button>
        )
      })}
    </div>
  )
}
