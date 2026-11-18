'use client'

import { useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { useAdminT } from '@/lib/admin/translations'
import Alert from '@/components/admin/Alert'
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL, PRIMARY_BUTTON } from '@/components/admin/formStyles'
import PoolSheet from './PoolSheet'

// A new Raayonit voucher type: a name, what it is worth and sells for, and the low-stock warning.
// The wholesale cost is optional (0 when unknown) and only feeds margin reports.
export default function NewVoucherTypeSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useAdminT()
  const [form, setForm] = useState({ title: '', faceValue: '', price: '', warningThreshold: '10', unitCost: '' })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const faceValue = Number(form.faceValue)
    const price = Number(form.price)
    if (!form.title.trim() || !(faceValue > 0) || !(price > 0) || price > faceValue) return setError(t('stock.invalid'))
    setSaving(true)
    setError(null)
    const res = await adminFetch('/api/admin/pools', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, faceValue, price, warningThreshold: Number(form.warningThreshold) }) }).catch(() => null)
    if (res?.ok) return onDone()
    setError((await res?.json().catch(() => null))?.error ?? t('stock.createFailed'))
    setSaving(false)
  }

  return (
    <PoolSheet title={t('stock.title')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        {error && <Alert>{error}</Alert>}
        <div>
          <label htmlFor="stock-name" className={ADMIN_LABEL}>{t('stock.name')}</label>
          <input id="stock-name" required className={ADMIN_INPUT} placeholder={t('stock.namePlaceholder')} value={form.title} onChange={set('title')} maxLength={120} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="stock-value" className={ADMIN_LABEL}>{t('stock.value')}</label>
            <input id="stock-value" required inputMode="decimal" dir="ltr" className={`${ADMIN_INPUT} tabular-nums`} placeholder="100" value={form.faceValue} onChange={set('faceValue')} />
          </div>
          <div>
            <label htmlFor="stock-price" className={ADMIN_LABEL}>{t('stock.price')}</label>
            <input id="stock-price" required inputMode="decimal" dir="ltr" className={`${ADMIN_INPUT} tabular-nums`} placeholder="89" value={form.price} onChange={set('price')} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="stock-warn" className={ADMIN_LABEL}>{t('stock.warning')}</label>
            <input id="stock-warn" required inputMode="numeric" dir="ltr" className={`${ADMIN_INPUT} tabular-nums`} value={form.warningThreshold} onChange={set('warningThreshold')} />
          </div>
          <div>
            <label htmlFor="stock-cost" className={ADMIN_LABEL}>{t('stock.cost')}</label>
            <input id="stock-cost" inputMode="decimal" dir="ltr" className={`${ADMIN_INPUT} tabular-nums`} placeholder="0" value={form.unitCost} onChange={set('unitCost')} />
          </div>
        </div>
        <p className={ADMIN_HINT}>{t('stock.costHint')}</p>
        <button type="submit" className={`${PRIMARY_BUTTON} w-full`} disabled={saving}>{saving ? t('stock.creating') : t('stock.create')}</button>
      </form>
    </PoolSheet>
  )
}
