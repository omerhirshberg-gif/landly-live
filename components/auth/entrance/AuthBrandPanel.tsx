'use client'

import { useId } from 'react'
import { brandPanelSteps, type BrandPanelContext, type SignInMethod } from '@/lib/auth/brandPanelSteps'
import type { OnboardingStep } from '@/lib/auth/onboarding'
import { ONB_ICONS, WELCOME_POINTS } from '@/lib/brand/onboardingIcons'
import type { TranslationKey } from '@/lib/i18n/translations'
import { useLang } from '@/lib/i18n/useLang'
import BrandHero, { type EntranceMode } from './BrandHero'
import styles from './entrance.module.css'

export type { BrandPanelContext } from '@/lib/auth/brandPanelSteps'

const ONBOARDING_TITLES: Record<OnboardingStep, TranslationKey> = {
  welcome: 'onb_panel_welcome',
  language: 'onb_panel_language',
  persona: 'onb_panel_persona',
  origin: 'onb_panel_origin',
  phone: 'onb_panel_phone',
  notifications: 'onb_panel_notifications',
  done: 'onb_panel_done',
}

function copyFor(context: BrandPanelContext): { title: TranslationKey; body: TranslationKey; points: boolean } {
  if (context === 'signIn') return { title: 'auth_panel_signIn_title', body: 'auth_panel_signIn_body', points: true }
  if (context === 'reset') return { title: 'auth_panel_reset_title', body: 'auth_panel_reset_body', points: true }
  if (context === 'signUp' || context === 'verify' || context === 'verified')
    return { title: 'auth_panel_signUp_title', body: 'auth_panel_signUp_body', points: true }
  return { title: ONBOARDING_TITLES[context], body: context === 'done' ? 'onb_panel_done_body' : 'onb_panel_body', points: false }
}

// Desktop web only (from 1024px; entrance.module.css hides it below): the
// brand side of the split auth screen. The logo (with its staged intro, in
// place of the hero above the card), a headline for whatever the form side
// shows, Landly's promises, and where the member is in the journey (states:
// lib/auth/brandPanelSteps.ts; `via` is how they're signing in). The copy
// cross-fades when the context changes; the panel itself never moves.
export default function AuthBrandPanel({
  context,
  entrance,
  via = 'email',
}: {
  context: BrandPanelContext
  entrance: EntranceMode
  via?: SignInMethod
}) {
  const { t } = useLang()
  const stepsId = useId()
  const copy = copyFor(context)
  const steps = brandPanelSteps(context, via)
  return (
    <aside className={styles.brandPanel}>
      <div className={styles.brandLogo}>
        <BrandHero mode={entrance} />
      </div>

      <div className={styles.brandContent}>
        <div key={copy.title} className={styles.brandCopy}>
          <h2 className={styles.brandTitle}>{t(copy.title)}</h2>
          <p className={styles.brandBody}>{t(copy.body)}</p>
          {copy.points && (
            <ul className={styles.brandPoints}>
              {WELCOME_POINTS.map((p) => (
                <li key={p.icon}>
                  <span aria-hidden="true" className={styles.brandPointIcon}>
                    <svg
                      width={18}
                      height={18}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.25}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d={ONB_ICONS[p.icon]} />
                    </svg>
                  </span>
                  {t(p.key)}
                </li>
              ))}
            </ul>
          )}
        </div>

        {steps && (
          <div className={styles.brandSteps}>
            <p id={stepsId} className={styles.brandStepsLabel}>
              {t(steps.label)}
            </p>
            <ol aria-labelledby={stepsId}>
              {steps.items.map((item, i) => (
                <li key={item.label} data-state={item.state} aria-current={item.state === 'current' ? 'step' : undefined}>
                  <span className={styles.brandStepDot} aria-hidden="true">
                    {item.state === 'done' ? (
                      <svg
                        width={14}
                        height={14}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d={ONB_ICONS.check} />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span>
                    {t(item.label)}
                    {item.state === 'done' && <span className="sr-only"> — {t('auth_panel_stepDone')}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </aside>
  )
}
