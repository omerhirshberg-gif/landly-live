'use client'

import { useAdminT } from '@/lib/admin/translations'

// Shown whenever the payout file would carry the fictitious test institution
// code (no MASAV_INSTITUTION_CODE set): such a file is only for rehearsal and
// is named MASAV_MOCK_TEST_*, so it can't be sent to a bank by mistake.
export default function MasavModeBadge({ institutionCode }: { institutionCode: string }) {
  const { t } = useAdminT()
  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/40 px-4 py-3 text-sm font-semibold text-amber-900">
      <i className="fa-solid fa-triangle-exclamation mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
      <span>
        {t('masav.mock')} <bdi dir="ltr" className="font-mono">{institutionCode}</bdi>
        <span className="mt-0.5 block text-xs font-medium text-amber-800/80">{t('masav.note')}</span>
      </span>
    </div>
  )
}
