'use client'

import VoucherList from '@/components/business/VoucherList'
import { useBusinessLang } from '@/lib/business/BusinessLangProvider'

export default function BusinessVouchersPage() {
  const { t } = useBusinessLang()

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-6">{t('bizdash_nav_vouchers')}</h1>
      <VoucherList
        status="active"
        emptyKey="bizdash_vouchers_empty"
        errorKey="bizdash_vouchers_error"
        dateColumnKey="bizdash_vouchers_col_purchased"
      />
    </div>
  )
}
