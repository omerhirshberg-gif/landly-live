'use client'

import SettingsPageShell from '@/components/settings/SettingsPageShell'
import SettingsRow, { SettingsGroup } from '@/components/settings/SettingsRow'
import SecuritySection from '@/components/settings/SecuritySection'
import SessionsCard from '@/components/settings/SessionsCard'
import PasskeysCard from '@/components/settings/PasskeysCard'
import { useSettingsMember } from '@/components/settings/useSettingsMember'
import { useLang } from '@/lib/i18n/useLang'

// Privacy & Security, its own page under /settings (the avatar menu links
// here too): how the member signs in, Passkeys, Change Password for
// email/password accounts (a Google-only account has no Landly password, so
// it gets a note instead), the Sessions card, then the data controls.
export default function PrivacySecurityPage() {
  const { t } = useLang()
  const user = useSettingsMember()
  const hasPassword = !!user?.providerData?.some((p) => p.providerId === 'password')

  return (
    <SettingsPageShell title={t('nav_security')}>
      {user ? (
        <>
          <section aria-labelledby="settings-signin" className="mb-6">
            <h2 id="settings-signin" className="px-1 pb-2 text-[13px] font-semibold text-slate-500">{t('security_signin_title')}</h2>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-[15px] font-semibold text-ink">{hasPassword ? t('security_method_password') : t('security_method_google')}</p>
              {user.email && <p className="text-sm text-body truncate"><bdi>{user.email}</bdi></p>}
              {!hasPassword && <p className="mt-3 text-sm text-body">{t('security_google_note')}</p>}
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
            <SettingsRow icon="fa-user-shield" title={t('security_data_privacy')} href="/privacy" />
            <SettingsRow icon="fa-trash-can" title={t('security_data_delete')} href="/settings/delete-account" />
          </SettingsGroup>
        </>
      ) : (
        <div className="h-64" aria-hidden="true" />
      )}
    </SettingsPageShell>
  )
}
