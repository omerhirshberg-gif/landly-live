'use client'

import type { Ref } from 'react'
import { WELCOME_POINTS } from '@/lib/brand/onboardingIcons'
import { useLang } from '@/lib/i18n/useLang'
import Button from '../entrance/Button'
import PointList from './PointList'
import StepIntro from './StepIntro'

// Card 1: a personal welcome and what Landly brings, then "Get Started".
// Rendered as the wizard's step root, so its children stagger in.
export function welcomeTitle(t: (key: 'onb_welcome_title' | 'onb_welcome_title_generic') => string, name: string | null): string {
  return name ? t('onb_welcome_title').replace('{name}', name) : t('onb_welcome_title_generic')
}

export default function WelcomeStep({ id, name, titleRef, onStart }: { id: string; name: string | null; titleRef?: Ref<HTMLHeadingElement>; onStart: () => void }) {
  const { t } = useLang()
  return (
    <>
      <StepIntro id={id} title={welcomeTitle(t, name)} subtitle={t('onb_welcome_subtitle')} titleRef={titleRef} />
      <PointList points={WELCOME_POINTS.map((p) => ({ icon: p.icon, label: t(p.key) }))} className="mb-6" />
      <div>
        <Button label={t('onb_getStarted')} onClick={onStart} large arrow />
      </div>
    </>
  )
}
