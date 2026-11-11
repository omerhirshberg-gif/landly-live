'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CheckCircle2, FileCheck2, LoaderCircle, Upload } from 'lucide-react'
import SignatureCanvas from '@/components/business/SignatureCanvas'
import { BankEncryptionBanner, FIELD, Field, LockedTerm, Section } from '@/components/business/onboarding/Parts'
import { fill, ONBOARD_COPY, type OnboardLang } from '@/lib/merchants/onboardingCopy'
import { paymentTermsDays, type PaymentTerms } from '@/lib/merchants/terms'
import { LEGAL_ENTITY_TYPES, validateOnboarding } from '@/lib/merchants/validation'

interface Invite { businessName: string; commissionRate: number; paymentTerms: PaymentTerms; contactEmail: string; lang: OnboardLang; expiresAt: string }
type Load = { state: 'loading' } | { state: 'gone' } | { state: 'ready'; invite: Invite } | { state: 'done'; email: string }

const MAX_CHEQUE = 4 * 1024 * 1024

// Phone photos run 3 to 8 MB; the upload limit is 4 MB. Large images are
// scaled down in the browser first (PDFs are sent as they are).
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= 1.5 * 1024 * 1024) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    return blob ? new File([blob], 'cheque.jpg', { type: 'image/jpeg' }) : file
  } catch {
    return file
  }
}

// The merchant's onboarding page (/business/onboard/<token>), reached from the
// emailed or WhatsApp link: locked terms, the details we need, the bank
// account and cheque, and a drawn signature. One submit does it all.
export default function OnboardPage() {
  const { token } = useParams<{ token: string }>()
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [lang, setLang] = useState<OnboardLang>('he')

  useEffect(() => {
    let cancelled = false
    fetch(`/api/business/onboard/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) return setLoad({ state: 'gone' })
        const invite: Invite = await res.json()
        setLang(invite.lang)
        setLoad({ state: 'ready', invite })
      })
      .catch(() => !cancelled && setLoad({ state: 'gone' }))
    return () => { cancelled = true }
  }, [token])

  const c = ONBOARD_COPY[lang]
  const rtl = lang === 'he'

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} lang={lang} className="min-h-[100dvh] bg-gradient-to-b from-slate-50 via-white to-blue-50/30 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6">
        <span className="text-base font-extrabold tracking-tight text-ink">{c.brand}</span>
        <button type="button" onClick={() => setLang(rtl ? 'en' : 'he')} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
          {c.switchTo}
        </button>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-10 sm:px-6">
        {load.state === 'loading' && <p className="py-24 text-center text-slate-500" role="status">{c.loading}</p>}
        {load.state === 'gone' && (
          <div className="mt-16 rounded-3xl border border-slate-200/80 bg-white/80 p-8 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md">
            <h1 className="text-xl font-bold tracking-tight text-ink">{c.goneTitle}</h1>
            <p className="mt-2 text-slate-600">{c.goneBody}</p>
          </div>
        )}
        {load.state === 'done' && (
          <div className="mt-16 rounded-3xl border border-slate-200/80 bg-white/80 p-8 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md" role="status">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-indigo-50" aria-hidden="true"><CheckCircle2 className="h-6 w-6 text-brand" strokeWidth={1.75} /></span>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">{c.doneTitle}</h1>
            <p className="mt-2 text-slate-600">{fill(c.doneBody, { email: '⁦' + load.email + '⁩' })}</p>
            <Link href="/business/login" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-6 font-semibold text-white shadow-sm transition-colors hover:bg-brandDark">{c.signIn}</Link>
          </div>
        )}
        {load.state === 'ready' && <OnboardForm token={token} invite={load.invite} lang={lang} onDone={(email) => setLoad({ state: 'done', email })} onGone={() => setLoad({ state: 'gone' })} />}
      </main>
    </div>
  )
}

function OnboardForm({ token, invite, lang, onDone, onGone }: { token: string; invite: Invite; lang: OnboardLang; onDone: (email: string) => void; onGone: () => void }) {
  const c = ONBOARD_COPY[lang]
  const [values, setValues] = useState({ legalEntityType: '', legalName: '', taxId: '', signatoryName: '', signatoryId: '', signatoryRole: '', bankCode: '', branchCode: '', accountNumber: '' })
  const [cheque, setCheque] = useState<File | null>(null)
  const [signature, setSignature] = useState<Blob | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setValues((v) => ({ ...v, [k]: e.target.value }))

  const days = paymentTermsDays(invite.paymentTerms)
  const commission = `${Number((invite.commissionRate * 100).toFixed(2))}%`
  const date = new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { dateStyle: 'long' }).format(new Date(invite.expiresAt))

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    const small = await shrinkImage(file)
    if (small.size > MAX_CHEQUE) return setErrors((e) => ({ ...e, cheque: c.chequeHelp }))
    setCheque(small)
    setErrors((e) => { const { cheque: _, ...rest } = e; return rest })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const next: Record<string, string> = {}
    const checked = validateOnboarding(values)
    if (!checked.ok) for (const k of Object.keys(checked.errors)) next[k] = c.fieldError
    if (!cheque) next.cheque = c.chequeRequired
    if (!signature) next.signature = c.signRequired
    if (!agreed) next.agreed = c.confirmRequired
    setErrors(next)
    if (Object.keys(next).length) {
      const first = Object.keys(next)[0]!
      document.getElementById(first === 'agreed' ? 'agreed' : first === 'signature' ? 'signature-field' : first === 'cheque' ? 'cheque-button' : first)?.focus()
      return
    }
    setBusy(true)
    const body = new FormData()
    for (const [k, v] of Object.entries(values)) body.set(k, v)
    body.set('cheque', cheque!)
    body.set('signature', new File([signature!], 'signature.png', { type: 'image/png' }))
    try {
      const res = await fetch(`/api/business/onboard/${encodeURIComponent(token)}`, { method: 'POST', body })
      if (res.status === 404) return onGone()
      const data = await res.json().catch(() => null)
      if (res.ok) return onDone(invite.contactEmail)
      if (data?.fields) setErrors(Object.fromEntries(Object.entries(data.fields as Record<string, string>).map(([k]) => [k, c.fieldError])))
      setFormError(res.status === 400 || res.status === 409 ? (data?.error ?? c.genericError) : c.genericError)
    } catch {
      setFormError(c.genericError)
    } finally {
      setBusy(false)
    }
  }

  const err = (k: string) => errors[k] ?? null
  const bad = (k: string) => (errors[k] ? 'border-red-400' : '')
  const input = (k: keyof typeof values, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => ({
    id: k, name: k, value: values[k], onChange: set(k), required: true, autoComplete: 'off', 'aria-invalid': !!errors[k] || undefined, 'aria-describedby': errors[k] ? `${k}-error` : undefined, className: `${FIELD} ${bad(k)}`, ...extra,
  })

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="px-1 pb-1 pt-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent" dir="auto">{fill(c.welcome, { name: invite.businessName })}</span>
        </h1>
        <p className="mt-2 text-slate-600">{c.intro}</p>
      </div>

      <Section title={c.termsTitle} note={c.termsNote}>
        <div className="grid gap-3 sm:grid-cols-2">
          <LockedTerm label={c.commission} value={commission} help={c.commissionHelp} />
          <LockedTerm label={c.payments} value={invite.paymentTerms.replace('_', ' ').toUpperCase()} help={days === 0 ? c.immediately : fill(c.days, { n: String(days) })} />
        </div>
      </Section>

      <Section index={1} title={c.businessTitle}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field id="legalEntityType" label={c.entityType} error={err('legalEntityType')}>
              <select id="legalEntityType" name="legalEntityType" value={values.legalEntityType} onChange={set('legalEntityType')} required aria-invalid={!!errors.legalEntityType || undefined} aria-describedby={errors.legalEntityType ? 'legalEntityType-error' : undefined} className={`${FIELD} ${bad('legalEntityType')}`}>
                <option value="" disabled>{c.choose}</option>
                {LEGAL_ENTITY_TYPES.map((type) => <option key={type} value={type}>{c[`entity_${type}` as const]}</option>)}
              </select>
            </Field>
          </div>
          <div className="sm:col-span-2"><Field id="legalName" label={c.legalName} error={err('legalName')}><input {...input('legalName', { dir: 'auto', maxLength: 120 })} /></Field></div>
          <Field id="taxId" label={c.taxId} error={err('taxId')}><input {...input('taxId', { inputMode: 'numeric', dir: 'ltr', maxLength: 9 })} /></Field>
          <span className="hidden sm:block" />
          <Field id="signatoryName" label={c.signatoryName} error={err('signatoryName')}><input {...input('signatoryName', { dir: 'auto', maxLength: 100, autoComplete: 'name' })} /></Field>
          <Field id="signatoryId" label={c.signatoryId} error={err('signatoryId')}><input {...input('signatoryId', { inputMode: 'numeric', dir: 'ltr', maxLength: 9 })} /></Field>
          <Field id="signatoryRole" label={c.signatoryRole} error={err('signatoryRole')}><input {...input('signatoryRole', { dir: 'auto', maxLength: 60, autoComplete: 'organization-title' })} /></Field>
        </div>
      </Section>

      <Section index={2} title={c.bankTitle}>
        <BankEncryptionBanner title={c.bankBannerTitle} body={c.bankBanner} />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field id="bankCode" label={c.bankCode} help={c.bankCodeHelp} error={err('bankCode')}><input {...input('bankCode', { inputMode: 'numeric', dir: 'ltr', maxLength: 2 })} /></Field>
          <Field id="branchCode" label={c.branch} help={c.branchHelp} error={err('branchCode')}><input {...input('branchCode', { inputMode: 'numeric', dir: 'ltr', maxLength: 3 })} /></Field>
          <div className="col-span-2 sm:col-span-1"><Field id="accountNumber" label={c.account} error={err('accountNumber')}><input {...input('accountNumber', { inputMode: 'numeric', dir: 'ltr', maxLength: 9 })} /></Field></div>
        </div>
        <div className="mt-5">
          <p className="mb-1.5 text-sm font-semibold text-ink">{c.cheque}</p>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,application/pdf" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = '' }} />
          <button
            id="cheque-button" type="button" onClick={() => fileInput.current?.click()} aria-describedby="cheque-help"
            className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border border-dashed bg-white/60 px-4 py-3 text-start transition-colors hover:border-brand hover:bg-blue-50/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${errors.cheque ? 'border-red-400' : 'border-slate-300'}`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white" aria-hidden="true">
              {cheque ? <FileCheck2 className="h-5 w-5 text-brand" strokeWidth={1.75} /> : <Upload className="h-5 w-5 text-slate-500" strokeWidth={1.75} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink" dir="auto">{cheque ? cheque.name : c.chooseFile}</span>
              {cheque && <span className="block text-xs text-slate-500">{c.changeFile}</span>}
            </span>
          </button>
          <p id="cheque-help" className="mt-1.5 text-sm text-slate-500">{c.chequeHelp}</p>
          {errors.cheque && <p role="alert" className="mt-1 text-sm font-medium text-red-600">{errors.cheque}</p>}
        </div>
      </Section>

      <Section index={3} title={c.signTitle} note={c.agreementSummary}>
        <label className="flex cursor-pointer items-start gap-3">
          <input id="agreed" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 accent-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" />
          <span className="text-sm leading-relaxed text-ink">{c.confirm}</span>
        </label>
        {errors.agreed && <p role="alert" className="mt-1.5 text-sm font-medium text-red-600">{errors.agreed}</p>}
        <div id="signature-field" tabIndex={-1} className="mt-5 outline-none">
          <p className="mb-1.5 text-sm font-semibold text-ink">{c.signLabel}</p>
          <SignatureCanvas onChange={setSignature} label={c.signLabel} clearLabel={c.clear} hint={c.signHint} invalid={!!errors.signature} />
          {errors.signature && <p role="alert" className="mt-1 text-sm font-medium text-red-600">{errors.signature}</p>}
        </div>
      </Section>

      {formError && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{formError}</p>}
      <button type="submit" disabled={busy} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand px-6 text-base font-bold text-white shadow-[0_8px_24px_rgb(0,56,184,0.25)] transition-[background-color,transform] duration-200 hover:bg-brandDark active:scale-[0.99] disabled:opacity-70 motion-reduce:transition-none [@media(hover:hover)]:hover:-translate-y-0.5">
        {busy && <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" strokeWidth={2} />}
        {busy ? c.submitting : c.submit}
      </button>
      <p className="px-1 text-center text-xs text-slate-400">{fill(c.expires, { date })}</p>
    </form>
  )
}
