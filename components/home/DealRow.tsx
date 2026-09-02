'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'
import { DealRowData } from '@/lib/data/deals'
import DealCard from './DealCard'

export default function DealRow({
  row,
  visible,
  spacingClassName = 'mb-10 sm:mb-12',
}: {
  row: DealRowData
  visible: boolean
  spacingClassName?: string
}) {
  const { t } = useLang()

  return (
    <div className={`deal-row ${spacingClassName}`} data-cat={row.cat} style={{ display: visible ? '' : 'none' }}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
          {row.showNewDot && <span className="new-badge-dot"></span>} <span>{t(row.titleKey)}</span>
        </h3>
        <Link href="/categories" className="text-sm font-semibold text-brand hover:underline">{t('see_all')}</Link>
      </div>
      <div className="scroll-x"><div className="flex gap-3 sm:gap-4 pb-2" style={{ width: 'max-content' }}>
        {row.deals.map((deal, i) => (
          <DealCard key={i} deal={deal} />
        ))}
      </div></div>
    </div>
  )
}
