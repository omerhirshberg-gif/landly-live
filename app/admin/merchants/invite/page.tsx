'use client'

import Switch from '@/components/admin/Switch'
import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import Alert from '@/components/admin/Alert'
import Card from '@/components/admin/Card'
import PageHeader from '@/components/admin/PageHeader'
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/admin/formStyles'
import { CATEGORY_TILES } from '@/lib/categories'
import { COMMISSION_PRESETS, PAYMENT_TERMS } from '@/lib/merchants/terms'

interface Result { link: string; message: string; whatsappHref: string | null; expiresAt: string; email: { sent: boolean; error?: string } | null }

const TERMS_LABEL: Record<string, string> = { net_0: 'Net 0: right after redemption', net_15: 'Net 15', net_30: 'Net 30', net_45: 'Net 45', net_60: 'Net 60' }

// Admin pre-locks the commercial terms; the merchant sees them read-only and
// fills in the rest. The link exists only on this screen (the database keeps a
// hash), so copy or send it before leaving.
export default function InviteMerchantPage() {
  const [f, setF] = useState({ businessName: '', contactEmail: '', contactPhone: '', commissionRate: '0.1', custom: '', paymentTerms: 'net_30', category: '', lang: 'he', existingBusinessUid: '', sendEmail: true })
  const [businesses, setBusinesses] = useState<{ id: string; name: string; onboarded: boolean }[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    adminFetch('/api/admin/merchants/invites').then((r) => (r.ok ? r.json() : null)).then((d) => d && setBusinesses(d.businesses.filter((b: { onboarded: boolean }) => !b.onboarded)))
  }, [])

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
    if (!res.ok) return setError(body?.error ?? 'Could not create the invite.')
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
        <PageHeader title="Invite ready" subtitle="This link is shown once. Only its hash is stored." />
        <Card className="space-y-5 p-6">
          {result.email && (result.email.sent ? <Alert tone="warning">Email sent to {f.contactEmail}.</Alert> : <Alert>Email not sent: {result.email.error}. Send the link another way.</Alert>)}
          <div>
            <label htmlFor="invite-link" className={ADMIN_LABEL}>One-time link</label>
            <input id="invite-link" readOnly value={result.link} onFocus={(e) => e.currentTarget.select()} dir="ltr" className={`${ADMIN_INPUT} font-mono text-sm`} />
            <p className={ADMIN_HINT}>Valid 7 days, works once.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copy} className={PRIMARY_BUTTON}><i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`} aria-hidden="true" /> {copied ? 'Copied' : 'Copy link'}</button>
            {result.whatsappHref && <a href={result.whatsappHref} target="_blank" rel="noopener noreferrer" className={SECONDARY_BUTTON}><i className="fa-brands fa-whatsapp" aria-hidden="true" /> Send via WhatsApp</a>}
            <button type="button" onClick={() => { setResult(null); setF((v) => ({ ...v, businessName: '', contactEmail: '', contactPhone: '', existingBusinessUid: '' })) }} className={SECONDARY_BUTTON}>Invite another</button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Invite merchant" subtitle="The commission and payment terms you set here are locked on the merchant's page." />
      <form onSubmit={submit}>
        <Card className="space-y-5 p-6">
          {error && <Alert>{error}</Alert>}
          <div>
            <label htmlFor="existing" className={ADMIN_LABEL}>Existing business (optional)</label>
            <select id="existing" value={f.existingBusinessUid} onChange={(e) => { const b = businesses.find((x) => x.id === e.target.value); setF((v) => ({ ...v, existingBusinessUid: e.target.value, businessName: b ? b.name : v.businessName })) }} className={ADMIN_INPUT}>
              <option value="">New business: create their login</option>
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div><label htmlFor="bn" className={ADMIN_LABEL}>Business name</label><input id="bn" required value={f.businessName} onChange={set('businessName')} dir="auto" className={ADMIN_INPUT} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="ce" className={ADMIN_LABEL}>Contact email</label><input id="ce" type="email" required value={f.contactEmail} onChange={set('contactEmail')} dir="ltr" className={ADMIN_INPUT} /></div>
            <div><label htmlFor="cp" className={ADMIN_LABEL}>Contact phone</label><input id="cp" type="tel" required value={f.contactPhone} onChange={set('contactPhone')} dir="ltr" placeholder="050-123-4567" className={ADMIN_INPUT} /></div>
          </div>
          <fieldset>
            <legend className={ADMIN_LABEL}>Commission</legend>
            <div className="flex flex-wrap gap-2">
              {[...COMMISSION_PRESETS.map((r) => ({ v: String(r), l: `${r * 100}%` })), { v: 'custom', l: 'Custom' }].map((o) => (
                <label key={o.v} className={`flex min-h-12 min-w-[4.5rem] cursor-pointer items-center justify-center rounded-xl border px-4 text-[15px] font-semibold transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-[#0038B8]/15 ${f.commissionRate === o.v ? 'border-[#0038B8] bg-[#0038B8] text-white' : 'border-[#CBD5E1] bg-white text-[#0B1B3D] hover:border-[#0038B8]'}`}>
                  <input type="radio" name="commission" value={o.v} checked={f.commissionRate === o.v} onChange={set('commissionRate')} className="sr-only" />
                  {o.l}
                </label>
              ))}
            </div>
            {f.commissionRate === 'custom' && <input aria-label="Custom commission percentage" required inputMode="decimal" placeholder="12.5%" value={f.custom} onChange={set('custom')} dir="ltr" className={`${ADMIN_INPUT} mt-2 max-w-[10rem]`} />}
            <p className={ADMIN_HINT}>Kept by Landly from each redeemed voucher. Up to 50%.</p>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="pt" className={ADMIN_LABEL}>Payment terms</label><select id="pt" value={f.paymentTerms} onChange={set('paymentTerms')} className={ADMIN_INPUT}>{PAYMENT_TERMS.map((t) => <option key={t} value={t}>{TERMS_LABEL[t]}</option>)}</select></div>
            <div><label htmlFor="lg" className={ADMIN_LABEL}>Page and contract language</label><select id="lg" value={f.lang} onChange={set('lang')} className={ADMIN_INPUT}><option value="he">עברית</option><option value="en">English</option></select></div>
          </div>
          {!f.existingBusinessUid && (
            <div><label htmlFor="cat" className={ADMIN_LABEL}>Category (optional)</label><select id="cat" value={f.category} onChange={set('category')} className={ADMIN_INPUT}><option value="">Set later</option>{CATEGORY_TILES.map((c) => <option key={c.category} value={c.category}>{c.category}</option>)}</select></div>
          )}
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-[#0B1B3D]">
            <Switch checked={f.sendEmail} onChange={(sendEmail) => setF((v) => ({ ...v, sendEmail }))} />
            Email the link to the merchant now
          </label>
          <button type="submit" disabled={busy} className={`${PRIMARY_BUTTON} w-full`}>{busy ? 'Creating…' : 'Create invite'}</button>
        </Card>
      </form>
    </div>
  )
}
