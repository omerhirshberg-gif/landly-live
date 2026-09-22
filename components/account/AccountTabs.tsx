'use client'

import { useLang } from '@/lib/i18n/useLang'

export type AccountTab = 'profile' | 'security'

interface AccountTabsProps {
  active: AccountTab
  onChange: (tab: AccountTab) => void
}

export default function AccountTabs({ active, onChange }: AccountTabsProps) {
  const { t } = useLang()

  const tabs: { id: AccountTab; label: string }[] = [
    { id: 'profile', label: t('dash_tab_profile') },
    { id: 'security', label: t('account_tab_security') },
  ]

  return (
    <div className="dash-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={`dash-tab ${active === tab.id ? 'dash-tab-active' : ''}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
