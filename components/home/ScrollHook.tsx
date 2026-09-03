'use client'

import { useLang } from '@/lib/i18n/useLang'

export default function ScrollHook() {
  const { t } = useLang()

  return (
    <section className="scroll-hook">
      <div className="hook-eyebrow"><i className="fa-solid fa-sparkles"></i> <span>{t('scroll_hook_eyebrow')}</span></div>
      <div className="hook-pills">
        <div className="hook-pill"><span className="hook-pill-icon">🍔</span> <span>{t('scroll_hook_q1')}</span></div>
        <div className="hook-pill"><span className="hook-pill-icon">🏄</span> <span>{t('scroll_hook_q2')}</span></div>
        <div className="hook-pill"><span className="hook-pill-icon">🍸</span> <span>{t('scroll_hook_q3')}</span></div>
      </div>
      <p className="hook-tagline">{t('scroll_hook_tagline')}</p>
      <div className="hook-arrow"><i className="fa-solid fa-chevron-down"></i></div>
      <p className="hook-hint">{t('scroll_hook_hint')}</p>
    </section>
  )
}
