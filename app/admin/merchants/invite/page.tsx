'use client'

import Switch from '@/components/admin/Switch'
import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import Alert from '@/components/admin/Alert'
import Card from '@/components/admin/Card'
import PageHeader from '@/components/admin/PageHeader'
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_SELECT, ADMIN_LABEL, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/admin/formStyles'
import { CATEGORY_TILES } from '@/lib/categories'
import { COMMISSION_PRESETS, PAYMENT_TERMS } from '@/lib/merchants/terms'
import { useAdminT } from '@/lib/admin/translations'

interface Result { link: string; message: string; whatsappHref: string | null; expiresAt: string; email: { sent: boolean; error?: string } | null }


// Admin pre-locks the commercial terms; the merchant sees them read-only and
// fills in the rest. The link exists only on this screen (the database keeps a
// hash), so copy or send it before leaving.
export default function InviteMerchantPage() {
  const { t } = useAdminT()
  const [f, setF] = useState({ businessName: '', contactEmail: '', contactPhone: '', commissionRate: '0.1', custom: '', paymentTerms: 'net_30', category: '', lang: 'he', existingBusinessUid: '', sendEmail: true })
  const [businesses, setBusinesses] = useState<{ id: string; name: string; onboarded: boolean }[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    adminFetch('/api/admin/merchants/invites').then((r) => (r.ok ? r.json() : null)).then((d) => d && setBusinesses(d.businesses.filter((b: { onboarded: boolean }) => !b.onboarded)))
  }, [])

  const termLabel = (term: string) => (term === 'net_0' ? t('invite.net0') : t('invite.net', { days: term.replace('net_', '') }))
  const rate = f.commissionRate === 'custom' ? f.custom : f.commissionRate
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await adminFetch('/api/admin/merchants/invites', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, commissionRate: rate.endsWith('%') ? rate : Number(rate), sendEmail: f.sendEmail }),
    })
    const body = await res.json().catch(() => null)
    setBusy(false)
    if (!res.ok) return setError(body?.error ?? t('invite.createFailed'))
    setResult(body)
  }

  const copy = async () => {
    if (!result) return
    try { await navigator.clipboard.writeText(result.link); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* the link stays selectable */ }
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((v) => ({ ...v, [k]: e.target.value }))

  if (result) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={t('invite.readyTitle')} subtitle={t('invite.readySub')} />
        <Card className="space-y-5 p-6">
          {result.email && (result.email.sent ? <Alert tone="warning">{t('invite.emailSent', { email: f.contactEmail })}</Alert> : <Alert>{t('invite.emailNotSent', { error: result.email.error ?? '' })}</Alert>)}
          <div>
            <label htmlFor="invite-link" className={ADMIN_LABEL}>{t('invite.link')}</label>
            <input id="invite-link" readOnly value={result.link} onFocus={(e) => e.currentTarget.select()} dir="ltr" className={`${ADMIN_INPUT} font-mono text-sm`} />
            <p className={ADMIN_HINT}>{t('invite.linkHint')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copy} className={PRIMARY_BUTTON}><i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`} aria-hidden="true" /> {copied ? t('invite.copied') : t('invite.copyLink')}</button>
            {result.whatsappHref && <a href={result.whatsappHref} target="_blank" rel="noopener noreferrer" className={SECONDARY_BUTTON}><i className="fa-brands fa-whatsapp" aria-hidden="true" /> {t('invite.whatsapp')}</a>}
            <button type="button" onClick={() => { setResult(null); setF((v) => ({ ...v, businessName: '', contactEmail: '', contactPhone: '', existingBusinessUid: '' })) }} className={SECONDARY_BUTTON}>{t('invite.another')}</button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('invite.title')} subtitle={t('invite.subtitle')} />
      <form onSubmit={submit}>
        <Card className="space-y-5 p-6">
          {error && <Alert>{error}</Alert>}
          <div>
            <label htmlFor="existing" className={ADMIN_LABEL}>{t('invite.existing')}</label>
            <select id="existing" value={f.existingBusinessUid} onChange={(e) => { const b = businesses.find((x) => x.id === e.target.value); setF((v) => ({ ...v, existingBusinessUid: e.target.value, businessName: b ? b.name : v.businessName })) }} className={ADMIN_SELECT}>
              <option value="">{t('invite.newBusiness')}</option>
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div><label htmlFor="bn" className={ADMIN_LABEL}>{t('invite.businessName')}</label><input id="bn" required value={f.businessName} onChange={set('businessName')} dir="auto" className={ADMIN_INPUT} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="ce" className={ADMIN_LABEL}>{t('invite.contactEmail')}</label><input id="ce" type="email" required value={f.contactEmail} onChange={set('contactEmail')} dir="ltr" className={ADMIN_INPUT} /></div>
            <div><label htmlFor="cp" className={ADMIN_LABEL}>{t('invite.contactPhone')}</label><input id="cp" type="tel" required value={f.contactPhone} onChange={set('contactPhone')} dir="ltr" placeholder="050-123-4567" className={ADMIN_INPUT} /></div>
          </div>
          <fieldset>
            <legend className={ADMIN_LABEL}>{t('invite.commission')}</legend>
            <div className="flex flex-wrap gap-2">
              {[...COMMISSION_PRESETS.map((r) => ({ v: String(r), l: `${r * 100}%` })), { v: 'custom', l: t('invite.custom') }].map((o) => (
                <label key={o.v} className={`flex min-h-12 min-w-[4.5rem] cursor-pointer items-center justify-center rounded-xl border px-4 text-[15px] font-semibold transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-[#0038B8]/15 ${f.commissionRate === o.v ? 'border-[#0038B8] bg-[#0038B8] text-white' : 'border-[#CBD5E1] bg-white text-[#0B1B3D] hover:border-[#0038B8]'}`}>
                  <input type="radio" name="commission" value={o.v} checked={f.commissionRate === o.v} onChange={set('commissionRate')} className="sr-only" />
                  {o.l}
                </label>
              ))}
            </div>
            {f.commissionRate === 'custom' && <input aria-label={t('invite.customAria')} required inputMode="decimal" placeholder="12.5%" value={f.custom} onChange={set('custom')} dir="ltr" className={`${ADMIN_INPUT} mt-2 max-w-[10rem]`} />}
            <p className={ADMIN_HINT}>{t('invite.commissionHint')}</p>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="pt" className={ADMIN_LABEL}>{t('invite.paymentTerms')}</label><select id="pt" value={f.paymentTerms} onChange={set('paymentTerms')} className={ADMIN_SELECT}>{PAYMENT_TERMS.map((term) => <option key={term} value={term}>{termLabel(term)}</option>)}</select></div>
            <div><label htmlFor="lg" className={ADMIN_LABEL}>{t('invite.pageLang')}</label><select id="lg" value={f.lang} onChange={set('lang')} className={ADMIN_SELECT}><option value="he">עברית</option><option value="en">English</option></select></div>
          </div>
          {!f.existingBusinessUid && (
            <div><label htmlFor="cat" className={ADMIN_LABEL}>{t('invite.category')}</label><select id="cat" value={f.category} onChange={set('category')} className={ADMIN_SELECT}><option value="">{t('invite.setLater')}</option>{CATEGORY_TILES.map((c) => <option key={c.category} value={c.category}>{c.category}</option>)}</select></div>
          )}
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-[#0B1B3D]">
            <Switch checked={f.sendEmail} onChange={(sendEmail) => setF((v) => ({ ...v, sendEmail }))} />
            {t('invite.sendEmail')}
          </label>
          <button type="submit" disabled={busy} className={`${PRIMARY_BUTTON} w-full`}>{busy ? t('invite.creating') : t('invite.create')}</button>
        </Card>
      </form>
    </div>
  )
}
