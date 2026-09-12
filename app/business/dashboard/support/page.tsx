'use client'

import Card from '@/components/admin/Card'
import { useBusinessLang } from '@/lib/business/BusinessLangProvider'
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY, SUPPORT_WHATSAPP_LINK } from '@/lib/config'

// Business profile fields (name/category/location/ח.פ) are admin-managed
// only -- there's no self-edit path here on purpose. This is just the
// "how do I ask for a change" contact block.
export default function BusinessSupportPage() {
  const { t } = useBusinessLang()

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-4">{t('bizdash_nav_support')}</h1>
      <p className="text-slate-400 text-sm mb-6 max-w-xl">{t('bizdash_support_desc')}</p>

      <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
        <Card className="p-5">
          <div className="text-2xl mb-2">📧</div>
          <div className="font-bold text-white mb-1">{t('support_email_us')}</div>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand text-sm font-semibold hover:underline" dir="ltr">
            {SUPPORT_EMAIL}
          </a>
          <p className="text-xs text-slate-500 mt-2">{t('support_email_note')}</p>
        </Card>
        <Card className="p-5">
          <div className="text-2xl mb-2">💬</div>
          <div className="font-bold text-white mb-1">{t('support_whatsapp')}</div>
          <a
            href={SUPPORT_WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            dir="ltr"
            className="text-brand text-sm font-semibold hover:underline"
          >
            {SUPPORT_WHATSAPP_DISPLAY}
          </a>
          <p className="text-xs text-slate-500 mt-2">{t('support_whatsapp_note')}</p>
        </Card>
      </div>
    </div>
  )
}
