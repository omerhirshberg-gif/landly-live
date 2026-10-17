'use client'

import SettingsPageShell from '@/components/settings/SettingsPageShell'
import DeleteAccountForm from '@/components/settings/DeleteAccountForm'
import { useSettingsBack } from '@/components/settings/useSettingsBack'
import { useSettingsMember } from '@/components/settings/useSettingsMember'
import { useLang } from '@/lib/i18n/useLang'

// Delete Account, its own page under /settings (the Danger zone row and
// Privacy & Security's data controls link here): the request form, which
// emails the team via /api/account/delete-request. Cancel and Done go back
// to Settings, like the header's back button.
export default function DeleteAccountPage() {
  const { t } = useLang()
  const user = useSettingsMember()
  const goBack = useSettingsBack()

  return (
    <SettingsPageShell title={t('del_row_title')}>
      {user ? <DeleteAccountForm user={user} onLeave={goBack} /> : <div className="h-64" aria-hidden="true" />}
    </SettingsPageShell>
  )
}
