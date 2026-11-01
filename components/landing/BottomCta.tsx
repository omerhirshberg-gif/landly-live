'use client'

import StoreButtons from '@/components/landing/StoreButtons'
import { useLang } from '@/lib/i18n/useLang'

// The landing's last word: both stores once more on a soft pastel banner.
export default function BottomCta() {
  const { t } = useLang()

  return (
    <section aria-labelledby="landing-cta-title" className="px-4 pb-10 sm:px-6 sm:pb-12 lg:px-8">
      <div className="mx-auto w-full max-w-[1240px] rounded-3xl border border-slate-200/80 bg-gradient-to-br from-blue-50/70 to-indigo-50/40 px-6 py-10 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:px-10 sm:py-12">
        <h2 id="landing-cta-title" className="mb-3 text-2xl font-black tracking-tight text-ink sm:text-4xl">{t('landing_cta_title')}</h2>
        <p className="mx-auto mb-6 max-w-xl text-base text-body">{t('landing_cta_sub')}</p>
        <div className="flex justify-center"><StoreButtons /></div>
      </div>
    </section>
  )
}
