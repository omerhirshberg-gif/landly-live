'use client'

import { useLang } from '@/lib/i18n/useLang'

export type MemberTab = 'perks' | 'redeemed' | 'subscription' | 'support' | 'profile'

interface MemberTabsProps {
  active: MemberTab
  onChange: (tab: MemberTab) => void
}

export default function MemberTabs({ active, onChange }: MemberTabsProps) {
  const { t } = useLang()

  const tabs: { id: MemberTab; label: string }[] = [
    { id: 'perks', label: t('dash_tab_perks') },
    { id: 'redeemed', label: t('dash_tab_redeemed') },
    { id: 'subscription', label: t('dash_tab_subscription') },
    { id: 'support', label: t('dash_tab_support') },
    { id: 'profile', label: t('dash_tab_profile') },
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
