'use client'

import type { PasswordStrength } from '@/lib/auth/onboarding'
import type { TranslationKey } from '@/lib/i18n/translations'
import { useLang } from '@/lib/i18n/useLang'

const LEVELS: Record<Exclude<PasswordStrength, 0>, { key: TranslationKey; bar: string; text: string }> = {
  1: { key: 'onb_strength_weak', bar: 'bg-red-500', text: 'text-red-600' },
  2: { key: 'onb_strength_fair', bar: 'bg-amber-500', text: 'text-amber-600' },
  3: { key: 'onb_strength_strong', bar: 'bg-emerald-500', text: 'text-emerald-600' },
}

// Three bars and a one-word verdict under the password field; empty until
// the first character is typed.
export default function PasswordStrengthMeter({ strength }: { strength: PasswordStrength }) {
  const { t } = useLang()
  const level = strength ? LEVELS[strength] : null
  return (
    <div className="-mt-1.5 mb-5 flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1.5" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${level && n <= strength ? level.bar : 'bg-slate-200'}`} />
        ))}
      </div>
      <span className={`min-w-[56px] text-end text-xs font-bold ${level ? level.text : 'text-transparent'}`}>
        {level ? <><span className="sr-only">{t('onb_strength_label')}: </span>{t(level.key)}</> : ' '}
      </span>
    </div>
  )
}
