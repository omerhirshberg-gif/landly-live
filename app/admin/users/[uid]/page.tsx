'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/admin/adminSession'
import { formatIsraeliDate, formatIsraeliDateTime } from '@/lib/admin/formatDate'
import type { KycTier, UserStatus } from '@/lib/admin/userStatus'
import Alert from '@/components/admin/Alert'
import BidiText from '@/components/admin/BidiText'
import Card, { CardSkeletons } from '@/components/admin/Card'
import DeleteUserDialog from '@/components/admin/DeleteUserDialog'
import PageHeader from '@/components/admin/PageHeader'
import StatusBadge, { UserStatusBadge } from '@/components/admin/StatusBadge'
import { ADMIN_INPUT, ADMIN_LABEL, DANGER_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON, SECTION_HEADING } from '@/components/admin/formStyles'
import { useAdminT, type AdminKey } from '@/lib/admin/translations'

interface Member {
  uid: string
  passId: string
  status: UserStatus
  statusReason: string | null
  kycTier: KycTier
  name: string
  email: string
  phone: string
  phoneVerified: boolean
  emailVerified: boolean
  createdAt: string | null
  lastSignInAt: string | null
  sessions: { id: string; deviceName: string; platform: string; lastActiveAt: string | null }[]
  passes: { id: string; offerTitle: string; businessName: string; status: string; displayOrderNumber: string | null; at: string | null; expiresAt: string | null }[]
  orders: { id: string; offerTitle: string; status: string; amount: number; at: string | null }[]
  audit: { id: string; action: string; note: string | null; at: string | null }[]
}

// One member: who they are, what they hold (a read-only view of their passes:
// never the code or QR, and no way to act as them), how they sign in, and a
// status control that records who did what in the audit log.
export default function MemberPage() {
  const { t } = useAdminT()
  const { uid } = useParams<{ uid: string }>()
  const [member, setMember] = useState<Member | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState<UserStatus | null>(null)
  const [reason, setReason] = useState('')
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await adminFetch(`/api/admin/users/${encodeURIComponent(uid)}`)
    const body = await res.json().catch(() => null)
    if (!res.ok) return setError(body?.error ?? t('member.loadFailed'))
    setMember(body)
  }, [uid])
  useEffect(() => {
    void load()
  }, [load])

  const changeStatus = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pending) return
    setBusy(true)
    setError(null)
    const res = await adminFetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: pending, reason }),
    })
    const body = await res.json().catch(() => null)
    setBusy(false)
    if (!res.ok) return setError(body?.error ?? t('member.statusFailed'))
    setPending(null)
    setReason('')
    setNotice(`Status is now ${pending}.`)
    void load()
  }

  const resend = async () => {
    setError(null)
    const res = await adminFetch(`/api/admin/users/${encodeURIComponent(uid)}/activation`, { method: 'POST' })
    const body = await res.json().catch(() => null)
    if (!res.ok) return setError(body?.error ?? t('member.emailFailed'))
    setNotice(t('member.emailSent'))
    void load()
  }

  if (!member) return error ? <Alert>{error}</Alert> : <CardSkeletons count={3} />
  return (
    <div className="space-y-8">
      <PageHeader title={member.name || member.email || t('member.fallbackTitle')} />
      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="warning">{notice}</Alert>}

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-xl font-bold tracking-tight text-adm-text"><BidiText>{member.name || '—'}</BidiText></p>
            <p className="truncate text-sm text-adm-muted"><bdi dir="ltr">{member.email}</bdi></p>
          </div>
          <UserStatusBadge status={member.status} />
        </div>
        {member.statusReason && <p className="mt-3 text-sm text-adm-text-2">{t('member.reason', { reason: '' })}<BidiText>{member.statusReason}</BidiText></p>}
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-sm md:grid-cols-4">
          <Fact label={t('member.passId')}><bdi dir="ltr" className="font-mono">{member.passId}</bdi></Fact>
          <Fact label={t('member.verification')}>{t(`member.kyc.${member.kycTier}` as AdminKey)}</Fact>
          <Fact label={t('users.phone')}>{member.phone ? <bdi dir="ltr">{member.phone}</bdi> : '—'}</Fact>
          <Fact label={t('users.col.joined')}><bdi dir="ltr">{formatIsraeliDate(member.createdAt)}</bdi></Fact>
          <Fact label={t('users.col.lastSignIn')}><bdi dir="ltr">{formatIsraeliDateTime(member.lastSignInAt)}</bdi></Fact>
          <Fact label={t('users.email')}>{member.emailVerified ? t('member.emailVerified') : t('member.emailNotVerified')}</Fact>
        </dl>
        <div className="mt-6 flex flex-wrap gap-2 border-t border-adm-line-soft pt-5">
          {!member.emailVerified && member.status === 'active' && (
            <button type="button" className={SECONDARY_BUTTON} onClick={resend}><i className="fa-solid fa-paper-plane" aria-hidden="true" /> {t('member.resend')}</button>
          )}
          {member.status === 'active' ? (
            <>
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setPending('suspended')}><i className="fa-solid fa-pause" aria-hidden="true" /> {t('member.suspend')}</button>
              <button type="button" className={DANGER_BUTTON} onClick={() => setPending('banned')}><i className="fa-solid fa-ban" aria-hidden="true" /> {t('member.ban')}</button>
            </>
          ) : (
            <button type="button" className={PRIMARY_BUTTON} onClick={() => setPending('active')}>{t('member.restore')}</button>
          )}
          <button type="button" className={`${DANGER_BUTTON} ms-auto`} onClick={() => setDeleting(true)}><i className="fa-solid fa-trash-can" aria-hidden="true" /> {t('member.delete')}</button>
        </div>
        {pending && (
          <form onSubmit={changeStatus} className="mt-5 space-y-3 rounded-2xl border border-adm-line bg-adm-sunken/60 p-4">
            <label htmlFor="status-reason" className={ADMIN_LABEL}>
              {pending === 'active' ? t('member.noteOptional') : pending === 'banned' ? t('member.reasonBan') : t('member.reasonSuspend')}
            </label>
            <input id="status-reason" required={pending !== 'active'} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} className={ADMIN_INPUT} dir="auto" autoFocus />
            <p className="text-xs text-adm-muted">
              {pending === 'active' ? t('member.restoreHint') : t('member.blockHint')}
            </p>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={pending === 'banned' ? DANGER_BUTTON : PRIMARY_BUTTON}>{busy ? t('member.saving') : t('member.confirm')}</button>
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setPending(null)}>{t('common.cancel')}</button>
            </div>
          </form>
        )}
      </Card>

      {deleting && <DeleteUserDialog uid={uid} onClose={() => setDeleting(false)} onDeleted={() => router.push('/admin/users?deleted=1')} />}

      <section aria-labelledby="passes-h">
        <h2 id="passes-h" className={SECTION_HEADING}>{t('member.passes')}</h2>
        <Card className="divide-y divide-adm-line-soft">
          {member.passes.length === 0 && <p className="p-5 text-sm text-adm-muted">{t('member.noPasses')}</p>}
          {member.passes.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-adm-text"><BidiText>{p.offerTitle}</BidiText></p>
                <p className="truncate text-xs text-adm-muted"><BidiText>{p.businessName}</BidiText> · <bdi dir="ltr">{p.displayOrderNumber ?? p.id}</bdi></p>
              </div>
              <div className="flex items-center gap-3 text-xs text-adm-muted">
                {p.expiresAt && <span>{t('member.expires', { date: `\u2066${formatIsraeliDate(p.expiresAt)}\u2069` })}</span>}
                <StatusBadge tone={p.status === 'active' ? 'emerald' : p.status === 'redeemed' ? 'blue' : 'slate'}>{p.status}</StatusBadge>
              </div>
            </div>
          ))}
        </Card>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="sessions-h">
          <h2 id="sessions-h" className={SECTION_HEADING}>{t('member.devices')}</h2>
          <Card className="divide-y divide-adm-line-soft">
            {member.sessions.length === 0 && <p className="p-5 text-sm text-adm-muted">{t('member.noDevices')}</p>}
            {member.sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm">
                <span className="min-w-0 truncate font-medium text-adm-text"><BidiText>{s.deviceName}</BidiText> <span className="text-xs font-normal text-adm-hint">{s.platform}</span></span>
                <bdi dir="ltr" className="shrink-0 text-xs text-adm-muted">{formatIsraeliDateTime(s.lastActiveAt)}</bdi>
              </div>
            ))}
          </Card>
        </section>
        <section aria-labelledby="audit-h">
          <h2 id="audit-h" className={SECTION_HEADING}>{t('member.activity')}</h2>
          <Card className="divide-y divide-adm-line-soft">
            {member.audit.length === 0 && <p className="p-5 text-sm text-adm-muted">{t('member.nothingYet')}</p>}
            {member.audit.map((a) => (
              <div key={a.id} className="px-5 py-3.5 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium text-adm-text">{a.action}</span>
                  <bdi dir="ltr" className="text-xs text-adm-muted">{formatIsraeliDateTime(a.at)}</bdi>
                </div>
                {a.note && <p className="mt-0.5 text-xs text-adm-muted"><BidiText>{a.note}</BidiText></p>}
              </div>
            ))}
          </Card>
        </section>
      </div>

      <section aria-labelledby="orders-h">
        <h2 id="orders-h" className={SECTION_HEADING}>{t('member.orders')}</h2>
        <Card className="divide-y divide-adm-line-soft">
          {member.orders.length === 0 && <p className="p-5 text-sm text-adm-muted">{t('member.noOrders')}</p>}
          {member.orders.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm">
              <span className="min-w-0 truncate font-medium text-adm-text"><BidiText>{o.offerTitle}</BidiText></span>
              <span className="flex shrink-0 items-center gap-3 text-xs text-adm-muted">
                <bdi dir="ltr">₪{o.amount}</bdi>
                <StatusBadge tone={o.status === 'paid' ? 'emerald' : o.status === 'failed' ? 'rose' : 'amber'}>{o.status}</StatusBadge>
              </span>
            </div>
          ))}
        </Card>
      </section>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-adm-hint">{label}</dt>
      <dd className="mt-0.5 font-semibold text-adm-text">{children}</dd>
    </div>
  )
}
