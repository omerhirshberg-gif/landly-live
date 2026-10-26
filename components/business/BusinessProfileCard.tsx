'use client'

import { IdCard, Mail, MapPin, Phone, type LucideIcon } from 'lucide-react'
import Card from '@/components/admin/Card'
import IconFrame from '@/components/ui/IconFrame'
import { useBusiness } from '@/components/business/BusinessGate'
import { useBusinessLang } from '@/lib/business/BusinessLangProvider'

function InfoItem({
  icon,
  label,
  value,
  notSetLabel,
  ltr,
}: {
  icon: LucideIcon
  label: string
  value: string
  notSetLabel: string
  ltr?: boolean
}) {
  const isSet = value.trim().length > 0
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <IconFrame icon={icon} size="sm" tone="glass" />
      <div className="min-w-0">
        <div className="text-nano font-bold text-slate-500 uppercase tracking-wide">{label}</div>
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
        <InfoItem icon={IdCard} label={t('bizdash_id_label')} value={business.businessId} notSetLabel={notSet} ltr />
        <InfoItem icon={MapPin} label={t('bizdash_info_location')} value={business.location} notSetLabel={notSet} />
        <InfoItem icon={Mail} label={t('bizdash_info_email')} value={business.email} notSetLabel={notSet} ltr />
        <InfoItem icon={Phone} label={t('bizdash_info_phone')} value={business.phone} notSetLabel={notSet} ltr />
      </div>
    </Card>
  )
}
