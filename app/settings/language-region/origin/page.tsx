'use client'

import { useState } from 'react'
import SettingsPageShell from '@/components/settings/SettingsPageShell'
import { useSettingsMember } from '@/components/settings/useSettingsMember'
import CountryOfOriginPicker from '@/components/profile/CountryOfOriginPicker'
import { useLang } from '@/lib/i18n/useLang'
import { invalidateMemberProfile, useMemberProfile } from '@/lib/firebase/useMemberProfile'
import { updateUserCountryOfOrigin } from '@/lib/firebase/users'
import { originLabel } from '@/lib/profile/countryOfOrigin'

// Country of origin, its own page: opened from Language & Region and from
// the Edit button on /profile. Choosing a country saves it to users/{uid}
// at once; its checkmark is the confirmation, and only a failed save shows
// a message. Back (the button, the swipe, or the browser's) returns to
// wherever the member came from: /profile, or Language & Region
// (lib/navigation/settingsBack.ts).
export default function OriginPage() {
  const { t, lang } = useLang()
  const user = useSettingsMember()
  const { profile, loaded } = useMemberProfile(user)
  // The just-chosen country shows at once, before users/{uid} is read again.
  const [chosen, setChosen] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const value = chosen ?? profile?.countryOfOrigin ?? ''

  const choose = async (code: string) => {
    if (!user || code === value) return
    const previous = value
    setChosen(code)
    setFailed(false)
    try {
      await updateUserCountryOfOrigin(user.uid, code)
      invalidateMemberProfile(user.uid)
    } catch {
      setChosen(previous)
      setFailed(true)
    }
  }

  const current = originLabel(value, lang)

  return (
    <SettingsPageShell title={t('settings_origin_title')}>
      {user && loaded ? (
        <>
          <p id="origin-current" className="px-1 pb-3 text-[15px] text-body">
            <span className="font-semibold text-ink">{t('profile_origin_label')}:</span> {current ?? t('profile_origin_unset')}
          </p>
          <CountryOfOriginPicker value={value} onChange={choose} labelledBy="origin-current" listClassName="max-h-[calc(100dvh-16rem)]" />
          {failed && (
            <p role="alert" className="mt-3 px-1 text-[13px] font-semibold text-red-600">
              {t('settings_save_error')}
            </p>
          )}
        </>
      ) : (
        <div className="h-64" aria-hidden="true" />
      )}
    </SettingsPageShell>
  )
}
