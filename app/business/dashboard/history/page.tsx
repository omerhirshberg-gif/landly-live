'use client'

import VoucherList from '@/components/business/VoucherList'
import { useBusinessLang } from '@/lib/business/BusinessLangProvider'

export default function BusinessHistoryPage() {
  const { t } = useBusinessLang()

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-6">{t('bizdash_nav_history')}</h1>
      <VoucherList
        status="redeemed"
        emptyKey="bizdash_history_empty"
        errorKey="bizdash_history_error"
        dateColumnKey="bizdash_history_col_redeemed"
      />
    </div>
  )
}
