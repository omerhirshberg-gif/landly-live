'use client'

import { useState } from 'react'
import type { User } from 'firebase/auth'
import { Check, Earth } from 'lucide-react'
import SettingsPageShell from '@/components/settings/SettingsPageShell'
import SettingsRow, { SettingsGroup } from '@/components/settings/SettingsRow'
import { useLang } from '@/lib/i18n/useLang'
import { LANGUAGES } from '@/lib/i18n/languages'
import { RTL_LANGS, type Lang } from '@/lib/i18n/translations'
import { useAuth } from '@/lib/firebase/useAuth'
import { invalidateMemberProfile, useMemberProfile } from '@/lib/firebase/useMemberProfile'
import { updateUserLanguage, updateUserRegion } from '@/lib/firebase/users'
import { useOnboardingGuard } from '@/components/auth/useOnboardingGuard'
import { radioKeyDown } from '@/components/auth/onboarding/radioNav'
import { ISRAEL_REGIONS, ISRAEL_REGION_KEYS, originLabel, type IsraelRegion } from '@/lib/profile/countryOfOrigin'

// Language & Region, its own page under /settings (the only place the
// language is chosen once signed in). Everyone picks one of the five
// languages, applied at once (direction included). Members also see their
// country of origin (a row that opens /settings/language-region/origin) and
// pick where in Israel they live; both are saved to users/{uid}.
export default function LanguageRegionPage() {
  const { t, lang, setLang, isRtl } = useLang()
  const { user: authUser } = useAuth()
  const held = useOnboardingGuard()
  const user = held ? null : authUser

  const chooseLang = (code: Lang) => {
    if (code === lang) return
    setLang(code)
    if (user) updateUserLanguage(user.uid, code).catch(() => {})
  }

  return (
    <SettingsPageShell title={t('nav_lang_region')}>
      <SettingsGroup id="settings-language" title={t('settings_language_title')}>
        <div role="radiogroup" aria-labelledby="settings-language" className="divide-y divide-slate-100">
          {LANGUAGES.map((l, i) => {
            const checked = l.code === lang
            return (
              <ChoiceRow
                key={l.code}
                checked={checked}
                onSelect={() => chooseLang(l.code)}
                onKeyDown={(e) => radioKeyDown(e, isRtl, (n) => chooseLang(LANGUAGES[n].code))}
                tabStop={checked || (i === 0 && !LANGUAGES.some((x) => x.code === lang))}
              >
                <span lang={l.code} dir={(RTL_LANGS as readonly string[]).includes(l.code) ? 'rtl' : 'ltr'}>{l.label}</span>
              </ChoiceRow>
            )
          })}
        </div>
      </SettingsGroup>

      {user && <MemberRegion user={user} />}
    </SettingsPageShell>
  )
}

function MemberRegion({ user }: { user: User }) {
  const { t, lang, isRtl } = useLang()
  const { profile, loaded } = useMemberProfile(user)
  // The just-chosen region shows at once, before users/{uid} is read again.
  const [region, setRegion] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const current = region ?? profile?.israelRegion ?? ''

  const chooseRegion = async (next: IsraelRegion) => {
    if (next === current) return
    const previous = current
    setRegion(next)
    setFailed(false)
    try {
      await updateUserRegion(user.uid, next)
      invalidateMemberProfile(user.uid)
    } catch {
      setRegion(previous)
      setFailed(true)
    }
  }

  const origin = profile ? originLabel(profile.countryOfOrigin, lang) : null

  return (
    <>
      <SettingsGroup id="settings-origin" title={t('settings_origin_title')}>
        <SettingsRow
          icon={Earth}
          title={t('profile_origin_label')}
          subtitle={loaded ? origin ?? t('profile_origin_unset') : '…'}
          href="/settings/language-region/origin"
        />
      </SettingsGroup>

      <SettingsGroup id="settings-region" title={t('settings_region_title')}>
        <div role="radiogroup" aria-labelledby="settings-region" className="divide-y divide-slate-100">
          {ISRAEL_REGIONS.map((r, i) => {
            const checked = r === current
            return (
              <ChoiceRow
                key={r}
                checked={checked}
                disabled={!loaded}
                onSelect={() => chooseRegion(r)}
                onKeyDown={(e) => radioKeyDown(e, isRtl, (n) => chooseRegion(ISRAEL_REGIONS[n]))}
                tabStop={checked || (i === 0 && !(ISRAEL_REGIONS as readonly string[]).includes(current))}
              >
                {t(ISRAEL_REGION_KEYS[r])}
              </ChoiceRow>
            )
          })}
        </div>
      </SettingsGroup>

      {failed && (
        <p role="alert" className="-mt-3 px-1 text-meta font-semibold text-red-600">
          {t('settings_save_error')}
        </p>
      )}
    </>
  )
}

// A full-width radio row: label on the leading side, a check on the trailing side.
function ChoiceRow({
  checked,
  disabled,
  tabStop,
  onSelect,
  onKeyDown,
  children,
}: {
  checked: boolean
  disabled?: boolean
  tabStop: boolean
  onSelect: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      tabIndex={tabStop ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={`tap-target flex w-full items-center gap-3 min-h-[52px] px-4 py-3 text-start text-copy transition-colors focus-visible:outline-none focus-visible:bg-slate-50 [@media(hover:hover)]:hover:bg-slate-50 active:bg-slate-100 disabled:opacity-60 ${
        checked ? 'font-semibold text-brand' : 'text-ink'
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {checked && <Check aria-hidden="true" className="h-4 w-4 flex-shrink-0" strokeWidth={2} />}
    </button>
  )
}
