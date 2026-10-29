'use client'

import { ShieldUser, Trash2 } from 'lucide-react'
import SettingsPageShell from '@/components/settings/SettingsPageShell'
import SettingsRow, { SettingsGroup } from '@/components/settings/SettingsRow'
import SecuritySection from '@/components/settings/SecuritySection'
import SessionsCard from '@/components/settings/SessionsCard'
import PasskeysCard from '@/components/settings/PasskeysCard'
import { useSettingsMember } from '@/components/settings/useSettingsMember'
import { useLang } from '@/lib/i18n/useLang'
import { signInProvider, signInProviderCopy } from '@/lib/auth/signInProvider'
import { PROVIDER_ICONS } from '@/components/auth/entrance/ProviderTile'

// Privacy & Security, its own page under /settings (the avatar menu links
// here too): how the member signs in (password, Apple or Google:
// lib/auth/signInProvider.ts), Passkeys, Change Password for email/password
// accounts (an Apple or Google account has no Landly password, so it gets a
// note instead), the devices signed in (Sessions), then the data controls.
export default function PrivacySecurityPage() {
  const { t } = useLang()
  const user = useSettingsMember()
  const provider = user ? signInProvider(user) : null
  const hasPassword = provider === 'password'
  const copy = signInProviderCopy(provider ?? 'other')
  const logo = provider === 'apple' || provider === 'google' ? provider : null

  return (
    <SettingsPageShell title={t('nav_security')}>
      {user ? (
        <>
          <section aria-labelledby="settings-signin" className="mb-6">
            <h2 id="settings-signin" className="px-1 pb-2 text-meta font-semibold text-slate-500">{t('security_signin_title')}</h2>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
              <div className="flex items-center gap-3">
                {logo && (
                  <span aria-hidden="true" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-ink">
                    {PROVIDER_ICONS[logo]}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-copy font-semibold text-ink">{t(copy.title)}</span>
                  {user.email && <span className="block text-sm text-body truncate"><bdi>{user.email}</bdi></span>}
                </span>
              </div>
              {copy.note && <p className="mt-3 text-sm text-body">{t(copy.note)}</p>}
            </div>
          </section>

          <PasskeysCard user={user} />

          {hasPassword && (
            <div className="mb-6">
              <SecuritySection user={user} />
            </div>
          )}

          <SessionsCard user={user} />

          <SettingsGroup id="settings-data" title={t('security_data_title')}>
            <SettingsRow icon={ShieldUser} title={t('security_data_privacy')} href="/privacy" />
            <SettingsRow icon={Trash2} title={t('security_data_delete')} href="/settings/delete-account" />
          </SettingsGroup>
        </>
      ) : (
        <div className="h-64" aria-hidden="true" />
      )}
    </SettingsPageShell>
  )
}
