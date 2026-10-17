'use client'

import SettingsPageShell from '@/components/settings/SettingsPageShell'
import SettingsRow, { SettingsGroup } from '@/components/settings/SettingsRow'
import { fromSettingsHref } from '@/components/settings/BackToSettings'
import { useLang } from '@/lib/i18n/useLang'
import { LANGUAGES } from '@/lib/i18n/languages'
import { useAuth } from '@/lib/firebase/useAuth'
import { useMemberProfile } from '@/lib/firebase/useMemberProfile'
import { useOnboardingGuard } from '@/components/auth/useOnboardingGuard'
import { originLabel } from '@/lib/profile/countryOfOrigin'
import { APP_VERSION } from '@/lib/config'

// Settings, reached from the drawer's Settings link and the avatar menu.
// Everyone gets Language & Region and Help & legal (Support, Terms,
// Privacy, the version); signed-in members also get Privacy & Security and
// the Danger zone's Delete Account request. Every row opens its own page
// (/settings/language-region, /settings/privacy-security,
// /settings/delete-account), never a sheet or dialog. No Sign Out here: it
// lives in the drawer and the avatar menu. Support, Terms and Privacy open
// with ?from=settings, so they show a Back to Settings button (BackToSettings.tsx).
export default function SettingsPage() {
  const { t, lang } = useLang()
  const { user: authUser, loading } = useAuth()
  // A member mid-onboarding is sent back to the wizard; until that's settled
  // the page shows only what guests see.
  const held = useOnboardingGuard()
  const user = held ? null : authUser
  const { profile } = useMemberProfile(user)

  const currentLang = LANGUAGES.find((l) => l.code === lang)?.label ?? lang
  const origin = profile ? originLabel(profile.countryOfOrigin, lang) : null

  return (
    <SettingsPageShell title={t('nav_settings_heading')}>
      <SettingsGroup id="settings-prefs" title={t('settings_group_prefs')}>
        <SettingsRow
          icon="fa-globe"
          title={t('nav_lang_region')}
          subtitle={origin ? `${currentLang} · ${origin}` : currentLang}
          href="/settings/language-region"
        />
      </SettingsGroup>

      {user && (
        <SettingsGroup id="settings-account" title={t('settings_group_account')}>
          <SettingsRow icon="fa-shield-halved" title={t('nav_security')} subtitle={t('nav_security_sub')} href="/settings/privacy-security" />
        </SettingsGroup>
      )}

      <SettingsGroup id="settings-help" title={t('settings_group_help')}>
        <SettingsRow icon="fa-headset" title={t('nav_support_title')} subtitle={t('nav_support_sub')} href={fromSettingsHref('/support')} />
        <SettingsRow icon="fa-file-lines" title={t('nav_terms_link')} href={fromSettingsHref('/terms')} />
        <SettingsRow icon="fa-user-shield" title={t('nav_privacy_link')} href={fromSettingsHref('/privacy')} />
      </SettingsGroup>

      {user && (
        <SettingsGroup id="settings-danger" title={t('settings_group_danger')}>
          <SettingsRow icon="fa-trash-can" title={t('del_row_title')} subtitle={t('del_row_sub')} href="/settings/delete-account" destructive />
        </SettingsGroup>
      )}

      {/* Signed-out visitors land here too (the drawer links it); the account rows wait for auth to settle */}
      {(loading || held) && <div className="h-24" aria-hidden="true" />}

      <p className="mt-2 text-center text-xs text-slate-400">
        <bdi>Landly</bdi> · {t('nav_version')} <bdi>{APP_VERSION}</bdi>
      </p>
    </SettingsPageShell>
  )
}
