'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'

export default function HowItWorks({ variant = 'guest' }: { variant?: 'guest' | 'member' }) {
  const { t } = useLang()

  const steps =
    variant === 'member'
      ? ([
          { icon: '🎟️', titleKey: 'step2_title', descKey: 'step2_desc' },
          { icon: '🎯', titleKey: 'step3_title', descKey: 'step3_desc' },
          { icon: '🏪', titleKey: 'step_redeem_title', descKey: 'step_redeem_desc' },
        ] as const)
      : ([
          { icon: '👤', titleKey: 'step1_title', descKey: 'step1_desc' },
          { icon: '🎟️', titleKey: 'step2_title', descKey: 'step2_desc' },
          { icon: '🎯', titleKey: 'step3_title', descKey: 'step3_desc' },
        ] as const)

  return (
    <section id="how" className="py-16 sm:py-20 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-6">
        <div className="max-w-2xl mb-10 sm:mb-12">
          <div className="text-xs font-bold tracking-widest text-brand uppercase mb-3">{t('how_label')}</div>
          <h2 className="text-3xl sm:text-4xl font-black text-[#0B1B3D] mb-3" style={{ letterSpacing: '-0.025em' }}>{t('how_title')}</h2>
          <p className="text-[#475569] text-[15px] sm:text-base leading-relaxed">{t('how_sub')}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {steps.map((step, i) => (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 text-center shadow-[0_1px_2px_rgba(15,23,42,.04),0_4px_16px_rgba(15,23,42,.05)]" key={step.titleKey}>
              <div className="step-num">{i + 1}</div>
              <div className="text-3xl mb-3" aria-hidden="true">{step.icon}</div>
              <h3 className="font-bold text-[17px] text-[#0B1B3D] mb-2">{t(step.titleKey)}</h3>
              <p className="text-[#475569] text-sm leading-relaxed">{t(step.descKey)}</p>
            </div>
          ))}
          <Link
            href="/olim"
            className="block text-center text-white rounded-2xl p-6 bg-[radial-gradient(120%_120%_at_0%_0%,#0038B8_0%,#002A8A_100%)] shadow-[0_2px_4px_rgba(0,42,138,.12),0_12px_32px_rgba(0,56,184,.22)] transition duration-200 [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:shadow-[0_4px_8px_rgba(0,42,138,.16),0_20px_44px_rgba(0,56,184,.32)] motion-reduce:transform-none"
          >
            <div className="text-4xl mb-3" aria-hidden="true">✈️</div>
            <div className="text-[11px] font-bold tracking-widest uppercase mb-2 text-white/70">{t('step4_label')}</div>
            <h3 className="font-black text-[19px] mb-2 leading-tight">{t('step4_title')}</h3>
            <p className="text-white/80 text-sm leading-relaxed mb-5">{t('step4_desc')}</p>
            <div className="inline-flex items-center gap-2 text-sm font-bold text-white border border-white/30 rounded-full px-4 py-2">
              {t('step4_link')} <i className="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
            </div>
          </Link>
        </div>
      </div>
    </section>
  )
}
