'use client'

import { useState } from 'react'
import SettingsPageShell from '@/components/settings/SettingsPageShell'
import { useSettingsMember } from '@/components/settings/useSettingsMember'
import PersonaStep from '@/components/auth/onboarding/PersonaStep'
import { isCustomerType, personaNote } from '@/lib/customerTypes'
import { useLang } from '@/lib/i18n/useLang'
import { invalidateMemberProfile, useMemberProfile } from '@/lib/firebase/useMemberProfile'
import { updateUserCustomerType } from '@/lib/firebase/users'

// The member type (Student, New Immigrant, Lone Soldier, ...), its own page:
// opened from the Edit button on /profile (app: settings/member-type). The
// same chips as onboarding; "Other" keeps its optional note, so unlike
// Country of origin this saves on Save rather than on each tap. Back
// returns to /profile (lib/navigation/settingsBack.ts).
export default function MemberTypePage() {
  const { t } = useLang()
  const user = useSettingsMember()
  const { profile, loaded } = useMemberProfile(user)
  // The member's edits; null until they touch a field, so the stored values show.
  const [type, setType] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'failed'>('idle')

  const storedType = profile?.customerType ?? ''
  const storedNote = profile?.customerTypeOther ?? ''
  const value = type ?? storedType
  const noteValue = note ?? storedNote
  const changed = value !== storedType || personaNote(value, noteValue) !== personaNote(storedType, storedNote)

  const edit = (next: () => void) => {
    next()
    setStatus('idle')
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || saving || !isCustomerType(value) || !changed) return
    setSaving(true)
    setStatus('idle')
    try {
      await updateUserCustomerType(user.uid, value, noteValue)
      invalidateMemberProfile(user.uid)
      setStatus('saved')
    } catch {
      setStatus('failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsPageShell title={t('signup_customerTypeLabel')}>
      {user && loaded ? (
        <form onSubmit={save} className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-sm">
          <p id="member-type-label" className="mb-4 text-[15px] font-semibold text-ink">{t('onb_persona_title')}</p>
          <PersonaStep
            labelledBy="member-type-label"
            value={value}
            onChange={(next) => edit(() => setType(next))}
            note={noteValue}
            onNoteChange={(next) => edit(() => setNote(next))}
          />
          {status === 'saved' && (
            <p role="status" className="mb-3 text-[13px] font-semibold text-emerald-700">{t('profile_save_success')}</p>
          )}
          {status === 'failed' && (
            <p role="alert" className="mb-3 text-[13px] font-semibold text-red-600">{t('settings_save_error')}</p>
          )}
          <button type="submit" disabled={saving || !changed || !isCustomerType(value)} aria-busy={saving || undefined} className="ds-btn ds-btn-primary w-full disabled:opacity-60">
            {t('profile_save_btn')}
          </button>
        </form>
      ) : (
        <div className="h-64" aria-hidden="true" />
      )}
    </SettingsPageShell>
  )
}
