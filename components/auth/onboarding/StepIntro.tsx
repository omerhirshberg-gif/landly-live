import type { Ref } from 'react'
import styles from '../entrance/entrance.module.css'

// Each step's title and one-line subtitle. The title takes focus when the
// step changes (for screen readers on touch devices); the subtitle drops out
// on short viewports so the step still fits without scrolling.
export default function StepIntro({ id, title, subtitle, titleRef }: { id: string; title: string; subtitle?: string; titleRef?: Ref<HTMLHeadingElement> }) {
  return (
    <div className="mb-5">
      <h2 id={id} ref={titleRef} tabIndex={-1} className="text-[22px] leading-7 font-extrabold text-slate-900 outline-none">
        {title}
      </h2>
      {subtitle && <p className={`${styles.subtitle} mt-1 text-sm leading-5 text-slate-500`}>{subtitle}</p>}
    </div>
  )
}
