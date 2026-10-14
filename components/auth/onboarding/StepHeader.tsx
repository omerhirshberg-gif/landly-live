'use client'

import { onboardingProgress, type OnboardingStep } from '@/lib/auth/onboarding'
import { useLang } from '@/lib/i18n/useLang'
import { StaticEmblem } from '../entrance/Emblem'
import styles from '../entrance/entrance.module.css'

// Back arrow and a small emblem standing in for the brand hero, over a slim
// progress line that fills continuously across every card: empty on the
// welcome, full on the celebration. No "Step 2 of 4" count, so the welcome
// and celebration never read as outside the flow. `onBack` is null where
// there's no going back. On desktop the split screen's brand panel shows the
// logo and the steps, so the emblem and bar step aside there.
export default function StepHeader({ step, onBack }: { step: OnboardingStep; onBack: (() => void) | null }) {
  const { t } = useLang()
  const percent = Math.round(onboardingProgress(step) * 100)
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={t('onb_back')}
            className="-ms-2 h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full text-slate-600 cursor-pointer transition-colors duration-200 [@media(hover:hover)]:hover:bg-slate-100 active:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="rtl:-scale-x-100">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        ) : (
          <span className="h-10 w-2 shrink-0" />
        )}
        <span className={`${styles.headerEmblem} h-8 w-8 shrink-0`} aria-hidden="true">
          <StaticEmblem />
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={t('onb_progress')}
        className={`${styles.progressTrack} h-[3px] rounded-full bg-slate-100 overflow-hidden`}
      >
        <div className={`${styles.progressFill} h-full rounded-full bg-brand`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
