'use client'

import type { TranslationKey } from '@/lib/i18n/translations'
import { useLang } from '@/lib/i18n/useLang'
import Button from '../entrance/Button'

const BENEFITS: TranslationKey[] = ['onb_notif_drops', 'onb_notif_redemptions', 'onb_notif_updates']

// Last step. "Enable" asks the browser for permission; "Maybe Later" asks
// nothing. Either one finishes onboarding.
export default function NotificationsStep({
  busy,
  onEnable,
  onLater,
}: {
  busy: 'enable' | 'later' | null
  onEnable: () => void
  onLater: () => void
}) {
  const { t } = useLang()
  return (
    <>
      <ul className="mb-6 grid gap-2.5">
        {BENEFITS.map((key) => (
          <li key={key} className="flex items-center gap-3 text-[15px] font-semibold text-slate-700">
            <span aria-hidden="true" className="h-7 w-7 shrink-0 rounded-full bg-brandLight flex items-center justify-center">
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#0038b8" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            {t(key)}
          </li>
        ))}
      </ul>
      <div className="grid gap-2.5">
        <Button label={t('onb_notif_enable')} onClick={onEnable} busy={busy === 'enable'} disabled={busy === 'later'} large />
        <Button label={t('onb_notif_later')} onClick={onLater} busy={busy === 'later'} disabled={busy === 'enable'} variant="secondary" />
      </div>
    </>
  )
}
