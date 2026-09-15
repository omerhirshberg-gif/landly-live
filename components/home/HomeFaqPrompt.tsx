'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'

export default function HomeFaqPrompt() {
  const { t } = useLang()

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-8 sm:py-10 text-center bg-white">
      <p className="text-sm text-slate-500">
        {t('home_faq_prompt_pre')}{' '}
        <Link href="/support" className="text-brand font-semibold hover:underline">
          {t('home_faq_prompt_link')}
        </Link>
      </p>
    </div>
  )
}
