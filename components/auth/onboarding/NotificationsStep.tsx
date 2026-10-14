'use client'

import { NOTIFICATION_POINTS } from '@/lib/brand/onboardingIcons'
import { useLang } from '@/lib/i18n/useLang'
import Button from '../entrance/Button'
import PointList from './PointList'

// "Enable" asks the browser for permission (Web Push); "Maybe Later" asks
// nothing. Either one saves the answers and moves on to the celebration.
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
      <PointList points={NOTIFICATION_POINTS.map((p) => ({ icon: p.icon, label: t(p.key) }))} className="mb-6" />
      <div className="grid gap-2.5">
        <Button label={t('onb_notif_enable')} onClick={onEnable} busy={busy === 'enable'} disabled={busy === 'later'} large />
        <Button label={t('onb_notif_later')} onClick={onLater} busy={busy === 'later'} disabled={busy === 'enable'} variant="secondary" />
      </div>
    </>
  )
}
