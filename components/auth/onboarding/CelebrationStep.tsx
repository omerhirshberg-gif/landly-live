'use client'

import type { Ref } from 'react'
import { ONB_ICONS } from '@/lib/brand/onboardingIcons'
import { useLang } from '@/lib/i18n/useLang'
import Button from '../entrance/Button'
import styles from '../entrance/entrance.module.css'

// Card 6: the answers are saved. A glowing badge lands on a soft spring (no
// bounce), its halo settles into a slow breath, and the copy follows. Its
// children are the step root's, so the wizard's .celebrate stagger applies.
export default function CelebrationStep({
  id,
  name,
  titleRef,
  busy,
  onExplore,
}: {
  id: string
  name: string | null
  titleRef?: Ref<HTMLHeadingElement>
  busy: boolean
  onExplore: () => void
}) {
  const { t } = useLang()
  return (
    <>
      <div className={styles.badgeWrap} aria-hidden="true">
        <span className={styles.halo} />
        <span className={styles.badge}>
          <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round">
            <path d={ONB_ICONS.check} />
          </svg>
        </span>
      </div>
      <h2 id={id} ref={titleRef} tabIndex={-1} className="text-[24px] leading-8 font-extrabold text-slate-900 text-center outline-none">
        {name ? t('onb_done_title').replace('{name}', name) : t('onb_done_title_generic')}
      </h2>
      <p className="mt-2 mb-7 text-[15px] leading-6 text-slate-500 text-center">{t('onb_done_body')}</p>
      <div>
        <Button label={t('onb_done_cta')} onClick={onExplore} busy={busy} large />
      </div>
    </>
  )
}
