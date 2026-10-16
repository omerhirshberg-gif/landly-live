'use client'

import { PASSWORD_REQUIREMENT_ITEMS, passwordRequirements } from '@/lib/auth/passwordValidation'
import { useLang } from '@/lib/i18n/useLang'

const CHECK = 'M20 6 9 17l-5-5'

// The four password rules under the password field, each ticking green as
// it's met (lib/auth/passwordValidation.ts). Two columns from 360px, one on
// the narrowest phones; items follow the page direction. Web counterpart of
// landly-mobile/src/auth/onboarding/PasswordRequirements.tsx.
//
// Shown only while the field is focused (`visible`); otherwise it takes no
// space. Opening and closing animate height (grid rows 0fr <-> 1fr), margin
// and opacity on the onboarding's silk curve; instant with reduced motion.
// Collapsed, it's inert, so keyboard and screen readers skip it.
export default function PasswordRequirements({ password, visible }: { password: string; visible: boolean }) {
  const { t } = useLang()
  const met = passwordRequirements(password)
  return (
    <div
      data-open={visible || undefined}
      aria-hidden={!visible || undefined}
      inert={!visible}
      className={`grid transition-[grid-template-rows,opacity,margin] duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
        visible ? 'grid-rows-[1fr] opacity-100 -mt-1.5 mb-5' : 'grid-rows-[0fr] opacity-0 mt-0 mb-0'
      }`}
    >
      <div className="min-h-0 overflow-hidden">
        <ul aria-label={t('onb_pwReq_title')} className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-x-3 gap-y-1.5">
          {PASSWORD_REQUIREMENT_ITEMS.map(({ key, label }) => (
            <li
              key={key}
              data-met={met[key] || undefined}
              className={`flex items-center gap-1.5 text-xs font-semibold transition-colors duration-200 ${met[key] ? 'text-emerald-600' : 'text-slate-500'}`}
            >
              <span
                aria-hidden="true"
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
                  met[key] ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white'
                }`}
              >
                {met[key] && (
                  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d={CHECK} />
                  </svg>
                )}
              </span>
              <span>
                {t(label)}
                <span className="sr-only">: {t(met[key] ? 'onb_pwReq_met' : 'onb_pwReq_unmet')}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
