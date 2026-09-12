'use client'

import Card from '@/components/admin/Card'
import { useBusiness } from '@/components/business/BusinessGate'
import { useBusinessLang } from '@/lib/business/BusinessLangProvider'

function InfoItem({
  icon,
  label,
  value,
  notSetLabel,
  ltr,
}: {
  icon: string
  label: string
  value: string
  notSetLabel: string
  ltr?: boolean
}) {
  const isSet = value.trim().length > 0
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <div className="w-8 h-8 rounded-lg border border-white/10 bg-white/[0.03] flex items-center justify-center shrink-0 text-slate-400">
        <i className={`fa-solid ${icon} text-xs`} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{label}</div>
        <div
          className={`text-sm truncate ${isSet ? 'text-white font-semibold' : 'text-slate-500 italic font-normal'}`}
          dir={isSet && ltr ? 'ltr' : undefined}
        >
          {isSet ? value : notSetLabel}
        </div>
      </div>
    </div>
  )
}

// The single, unified business-identity block: name + category as the header
// row, then a compact info grid below it -- this is the only place any of
// these fields appear on the dashboard (they previously showed once in the
// page header and again in a separate "Business Info" card). Read-only --
// business data is admin-managed only (see BusinessSupportPage).
export default function BusinessProfileCard() {
  const { business } = useBusiness()
  const { t } = useBusinessLang()
  const notSet = t('bizdash_info_not_set')

  return (
    <Card className="p-5 sm:p-6 mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-xs font-bold tracking-widest text-blue-400 uppercase mb-1">{t('bizdash_label')}</div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">{business.businessName}</h1>
        </div>
        <span className="segment-badge" style={{ background: '#0038b8' }}>
          {business.category}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-4 mt-5 pt-5 border-t border-white/5">
        <InfoItem icon="fa-id-card" label={t('bizdash_id_label')} value={business.businessId} notSetLabel={notSet} ltr />
        <InfoItem icon="fa-location-dot" label={t('bizdash_info_location')} value={business.location} notSetLabel={notSet} />
        <InfoItem icon="fa-envelope" label={t('bizdash_info_email')} value={business.email} notSetLabel={notSet} ltr />
        <InfoItem icon="fa-phone" label={t('bizdash_info_phone')} value={business.phone} notSetLabel={notSet} ltr />
      </div>
    </Card>
  )
}
