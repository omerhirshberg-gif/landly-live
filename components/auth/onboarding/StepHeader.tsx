'use client'

import { stepProgress, type OnboardingStep } from '@/lib/auth/onboarding'
import { useLang } from '@/lib/i18n/useLang'
import { StaticEmblem } from '../entrance/Emblem'

// Back arrow, "Step 2 of 4" and a progress bar, with a small emblem standing
// in for the brand hero. `onBack` is null where there's no going back.
export default function StepHeader({
  step,
  onBack,
}: {
  step: OnboardingStep
  onBack: (() => void) | null
}) {
  const { t } = useLang()
  const { current, total } = stepProgress(step)
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2.5">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={t('onb_back')}
            className="-ms-2 h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full text-slate-600 cursor-pointer [@media(hover:hover)]:hover:bg-slate-100 active:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="rtl:-scale-x-100">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        ) : (
          <span className="h-10 w-2 shrink-0" />
        )}
        <span className="flex-1 text-[13px] font-semibold text-slate-500">
          {t('onb_stepOf').replace('{current}', String(current)).replace('{total}', String(total))}
        </span>
        <span className="h-8 w-8 shrink-0" aria-hidden="true">
          <StaticEmblem />
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-label={t('onb_stepOf').replace('{current}', String(current)).replace('{total}', String(total))}
        className="h-1.5 rounded-full bg-slate-100 overflow-hidden"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  )
}
