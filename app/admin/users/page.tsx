'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { useAdminT } from '@/lib/admin/translations'
import type { AdminLocale } from '@/lib/admin/adminLocale'
import { formatIsraeliDate, formatIsraeliDateTime } from '@/lib/admin/formatDate'
import { displayPhone, whatsappHref } from '@/lib/admin/businessPhone'
import {
  countryShares,
  dialCode,
  filterUsers,
  segmentShares,
  userTotals,
  type AdminUserRow,
  type Share,
  type UserFilters,
} from '@/lib/admin/userStats'
import { countryName, flagEmoji } from '@/lib/auth/onboarding'
import type { CountryCode } from 'libphonenumber-js'
import Alert from '@/components/admin/Alert'
import Card, { CardSkeletons } from '@/components/admin/Card'
import CustomerTypeBadge, { customerTypeInfo } from '@/components/admin/CustomerTypeBadge'
import BidiText from '@/components/admin/BidiText'
import DataTable from '@/components/admin/DataTable'
import EmptyState from '@/components/admin/EmptyState'
import { ResultCount, SearchInput } from '@/components/admin/ListToolbar'
import PageHeader from '@/components/admin/PageHeader'
import StatCard from '@/components/admin/StatCard'
import { UserStatusBadge } from '@/components/admin/StatusBadge'
import { ADMIN_INPUT, ADMIN_LABEL, SECONDARY_BUTTON, SECTION_HEADING } from '@/components/admin/formStyles'

interface UsersResponse {
  users: AdminUserRow[]
  total: number
  typeCounts: Record<string, number>
  truncated: boolean
  generatedAt: string
}

/** A dropdown's "everything" value; '' already means "not set". */
const ANY = '__any__'

const NO_FILTERS = { query: '', customerType: ANY, originCountry: ANY, phoneCountry: ANY, status: ANY }

const countryIn = (locale: AdminLocale) => (code: string) => (code ? countryName(code as CountryCode, locale) : '')

// Members at a glance: totals, who they are (member type) and where they're
// from (country of origin, and the country their WhatsApp number dials),
// then every member, searchable and filterable. Each row opens the
// member's page (read-only pass view, status changes with an audit trail). The server caches the list for 5 minutes;
// Refresh skips the cache.
export default function UsersPage() {
  const { t, locale } = useAdminT()
  const country = useMemo(() => countryIn(locale), [locale])
  const [data, setData] = useState<UsersResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [filters, setFilters] = useState(NO_FILTERS)

  const load = useCallback(async (fresh: boolean) => {
    setRefreshing(true)
    setError(null)
    try {
      const res = await adminFetch(`/api/admin/users${fresh ? '?fresh=1' : ''}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error)
      setData(body)
    } catch {
      setError(t('users.loadFailed'))
    } finally {
      setRefreshing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void load(false)
  }, [load])

  const rows = useMemo(() => data?.users ?? [], [data])
  const totals = useMemo(() => userTotals(rows), [rows])
  const segments = useMemo(() => (data ? segmentShares(rows, data.typeCounts) : []), [data, rows])
  const origins = useMemo(() => countryShares(rows, (row) => row.originCountry), [rows])
  const phones = useMemo(() => countryShares(rows, (row) => row.phoneCountry), [rows])

  const filtered = useMemo(() => {
    const any = (value: string) => (value === ANY ? null : value)
    const active: UserFilters = {
      query: filters.query,
      customerType: any(filters.customerType),
      originCountry: any(filters.originCountry),
      phoneCountry: any(filters.phoneCountry),
      status: any(filters.status) as UserFilters['status'],
    }
    return filterUsers(rows, active)
  }, [rows, filters])
  const filtering = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS)
  const set = (patch: Partial<typeof NO_FILTERS>) => setFilters((prev) => ({ ...prev, ...patch }))

  // Every country anyone has, for the dropdowns (not just the top ones in the breakdown).
  const originOptions = useMemo(() => countryOptions(rows.map((row) => row.originCountry), country), [rows, country])
  const phoneOptions = useMemo(() => countryOptions(rows.map((row) => row.phoneCountry), country), [rows, country])

  return (
    <div>
      <PageHeader
        title={t('route.Users')}
        subtitle={data ? t('users.updated', { when: `\u2066${formatIsraeliDateTime(data.generatedAt)}\u2069` }) : t('users.subtitle')}
        actions={
          <button type="button" className={`${SECONDARY_BUTTON} w-full sm:w-auto`} onClick={() => void load(true)} disabled={refreshing} aria-busy={refreshing}>
            <i className={`fa-solid fa-arrows-rotate text-xs ${refreshing ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
            {refreshing ? t('users.refreshing') : t('users.refresh')}
          </button>
        }
      />

      {error && <Alert className="mb-6">{error}</Alert>}
      {data?.truncated && (
        <Alert tone="warning" className="mb-6">
          {t('users.truncated', { shown: rows.length.toLocaleString('en'), total: data.total.toLocaleString('en') })}
        </Alert>
      )}

      <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t('users.stat.members')} value={data ? data.total : null} icon="fa-users" accent="blue" emptyHint={t('users.stat.membersHint')} />
        <StatCard label={t('users.stat.email')} value={data ? totals.emailVerified : null} icon="fa-envelope-circle-check" accent="emerald" />
        <StatCard label={t('users.stat.phone')} value={data ? totals.phoneVerified : null} icon="fa-mobile-screen" accent="violet" />
        <StatCard label={t('users.stat.passes')} value={data ? totals.withPasses : null} icon="fa-ticket" accent="amber" />
      </div>

      {data === null && !error && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <CardSkeletons count={3} className="h-72" />
        </div>
      )}

      {data && rows.length === 0 && <EmptyState icon="fa-users" title={t('users.emptyTitle')} description={t('users.emptyBody')} />}

      {data && rows.length > 0 && (
        <>
          <div className="mb-10 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Breakdown
              title={t('users.memberType')}
              shares={segments}
              selected={filters.customerType}
              onSelect={(key) => set({ customerType: filters.customerType === key ? ANY : key })}
              describe={(key) => {
                const info = customerTypeInfo(key, locale)
                return { label: info.label, mark: info.emoji, color: info.color }
              }}
            />
            <Breakdown
              title={t('users.origin')}
              shares={origins}
              selected={filters.originCountry}
              onSelect={(key) => set({ originCountry: filters.originCountry === key ? ANY : key })}
              describe={(key) => countryRow(key, false, country, t)}
            />
            <Breakdown
              title={t('users.phoneCountry')}
              shares={phones}
              selected={filters.phoneCountry}
              onSelect={(key) => set({ phoneCountry: filters.phoneCountry === key ? ANY : key })}
              describe={(key) => countryRow(key, true, country, t)}
            />
          </div>

          <section aria-label={t('users.members')}>
            <h2 className={SECTION_HEADING}>{t('users.members')}</h2>
            <div className="mb-6 space-y-3">
              <SearchInput label={t('users.search')} placeholder={t('users.searchPlaceholder')} value={filters.query} onChange={(query) => set({ query })} className="max-w-xl" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FilterSelect id="users-type" label={t('users.memberType')} value={filters.customerType} onChange={(customerType) => set({ customerType })}>
                  {segments.map((share) => (
                    <option key={share.key} value={share.key}>
                      {customerTypeInfo(share.key, locale).label} ({share.count})
                    </option>
                  ))}
                </FilterSelect>
                <FilterSelect id="users-origin" label={t('users.origin')} value={filters.originCountry} onChange={(originCountry) => set({ originCountry })}>
                  {originOptions.map((code) => (
                    <option key={code} value={code}>
                      {code ? `${flagEmoji(code)} ${country(code)}` : t('users.notSet')}
                    </option>
                  ))}
                </FilterSelect>
                <FilterSelect id="users-phone" label={t('users.phoneCountry')} value={filters.phoneCountry} onChange={(phoneCountry) => set({ phoneCountry })}>
                  {phoneOptions.map((code) => (
                    <option key={code} value={code}>
                      {code ? `${flagEmoji(code)} ${country(code)} (${dialCode(code)})` : t('users.noPhone')}
                    </option>
                  ))}
                </FilterSelect>
                <FilterSelect id="users-status" label={t('users.status')} value={filters.status} onChange={(status) => set({ status })}>
                  <option value="active">{t('userStatus.active')}</option>
                  <option value="suspended">{t('userStatus.suspended')}</option>
                  <option value="banned">{t('userStatus.banned')}</option>
                </FilterSelect>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ResultCount shown={filtered.length} total={rows.length} noun={t('users.nounMembers')} />
                {filtering && (
                  <button type="button" onClick={() => setFilters(NO_FILTERS)} className="inline-flex min-h-11 items-center text-sm font-semibold text-[#0038B8] hover:text-[#002A8A]">
                    {t('list.clearFilters')}
                  </button>
                )}
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon="fa-magnifying-glass"
                title={t('users.noMatchTitle')}
                description={t('users.noMatchBody')}
                action={
                  <button type="button" onClick={() => setFilters(NO_FILTERS)} className={SECONDARY_BUTTON}>
                    {t('list.clearFilters')}
                  </button>
                }
              />
            ) : (
              <UsersTable rows={filtered} country={country} />
            )}
          </section>
        </>
      )}
    </div>
  )
}

function countryOptions(codes: readonly string[], country: (code: string) => string): string[] {
  const unique = [...new Set(codes)]
  const named = unique.filter(Boolean).sort((a, b) => country(a).localeCompare(country(b)))
  return unique.includes('') ? [...named, ''] : named
}

function countryRow(key: string, phone: boolean, country: (code: string) => string, t: ReturnType<typeof useAdminT>['t']) {
  if (key === '*') return { label: t('users.otherCountries'), mark: '·', color: '#94A3B8' }
  if (!key) return { label: phone ? t('users.noPhone') : t('users.notSet'), mark: '—', color: '#CBD5E1' }
  return { label: phone ? `${country(key)} ${dialCode(key)}` : country(key), mark: flagEmoji(key), color: '#0038B8' }
}

function FilterSelect({ id, label, value, onChange, children }: { id: string; label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  const { t } = useAdminT()
  return (
    <div>
      <label htmlFor={id} className={ADMIN_LABEL}>
        {label}
      </label>
      <select id={id} className={`${ADMIN_INPUT} cursor-pointer`} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={ANY}>{t('users.all')}</option>
        {children}
      </select>
    </div>
  )
}

/** A card of horizontal bars, one per group; a bar filters the list to its group (again to undo). */
function Breakdown({
  title,
  shares,
  selected,
  onSelect,
  describe,
}: {
  title: string
  shares: readonly Share[]
  selected: string
  onSelect: (key: string) => void
  describe: (key: string) => { label: string; mark: string; color: string }
}) {
  const max = Math.max(1, ...shares.map((share) => share.count))
  return (
    <Card className="p-4 sm:p-5">
      <h2 className={SECTION_HEADING}>{title}</h2>
      <ul className="space-y-1">
        {shares.map((share) => {
          const { label, mark, color } = describe(share.key)
          const pressed = selected === share.key
          const other = share.key === '*'
          return (
            <li key={share.key}>
              <button
                type="button"
                disabled={other}
                aria-pressed={other ? undefined : pressed}
                onClick={() => onSelect(share.key)}
                className={`block min-h-11 w-full rounded-xl px-2 py-1.5 text-start transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8] disabled:cursor-default ${
                  pressed ? 'bg-[#F0F7FF]' : 'enabled:hover:bg-[#F8FAFC]'
                }`}
              >
                <span className="flex items-center gap-2 text-sm">
                  <span aria-hidden="true" className="w-5 shrink-0 text-center leading-none">
                    {mark}
                  </span>
                  <span className={`min-w-0 flex-1 truncate ${pressed ? 'font-semibold text-[#0038B8]' : 'text-[#0B1B3D]'}`} dir="auto">
                    {label}
                  </span>
                  <span className="shrink-0 tabular-nums text-[#475569]">
                    <bdi dir="ltr">{share.count}</bdi>
                    <span className="ms-1.5 text-xs text-[#64748B]">
                      <bdi dir="ltr">{share.percent}%</bdi>
                    </span>
                  </span>
                </span>
                <span className="mt-1.5 ms-7 block h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]" aria-hidden="true">
                  <span className="block h-full rounded-full" style={{ width: `${(share.count / max) * 100}%`, backgroundColor: color }} />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function UserAvatar({ user }: { user: AdminUserRow }) {
  const [failed, setFailed] = useState(false)
  const initial = [...(user.name || user.email).trim()][0]?.toUpperCase() ?? '?'
  return (
    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F0F7FF] text-sm font-bold text-[#0038B8]">
      {user.photoURL && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.photoURL} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        initial
      )}
    </span>
  )
}

function UserIdentity({ user }: { user: AdminUserRow }) {
  const { t } = useAdminT()
  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar user={user} />
      <div className="min-w-0">
        <BidiText className="font-semibold text-[#0B1B3D]">{user.name || t('users.noName')}</BidiText>
        <bdi dir="ltr" className="mt-0.5 block truncate text-xs text-[#64748B] [text-align:match-parent]">
          {user.email}
        </bdi>
      </div>
    </div>
  )
}

function PhoneContact({ user }: { user: AdminUserRow }) {
  const { t } = useAdminT()
  if (!user.phone) return <span className="text-sm text-[#64748B]">{t('users.noPhone')}</span>
  return (
    <span className="inline-flex items-center gap-2">
      {user.phoneCountry && <span aria-hidden="true">{flagEmoji(user.phoneCountry)}</span>}
      <bdi dir="ltr" className="tabular-nums text-[#475569]">
        {displayPhone(user.phone)}
      </bdi>
      <a
        href={whatsappHref(user.phone)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('users.chatWith', { name: user.name || user.email })}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#25D366] transition-colors hover:bg-[#ECFDF5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8]"
      >
        <i className="fa-brands fa-whatsapp text-lg" aria-hidden="true" />
      </a>
    </span>
  )
}

function Verified({ user }: { user: AdminUserRow }) {
  const { t } = useAdminT()
  return (
    <span className="inline-flex items-center gap-3 text-sm">
      <VerifiedMark ok={user.emailVerified} icon="fa-envelope" label={t('users.email')} />
      <VerifiedMark ok={user.phoneVerified} icon="fa-mobile-screen" label={t('users.phone')} />
    </span>
  )
}

function VerifiedMark({ ok, icon, label }: { ok: boolean; icon: string; label: string }) {
  const { t } = useAdminT()
  const text = t(ok ? 'users.verified' : 'users.notVerified', { what: label })
  return (
    <span className={`inline-flex items-center gap-1 ${ok ? 'text-emerald-700' : 'text-[#CBD5E1]'}`} title={text}>
      <i className={`fa-solid ${icon} text-xs`} aria-hidden="true" />
      <i className={`fa-solid ${ok ? 'fa-circle-check' : 'fa-circle-xmark'} text-[11px]`} aria-hidden="true" />
      <span className="sr-only">{text}</span>
    </span>
  )
}

const time = (value: string | null) => (value ? new Date(value).getTime() : 0)

function UsersTable({ rows, country }: { rows: AdminUserRow[]; country: (code: string) => string }) {
  const { t, tn, locale } = useAdminT()
  return (
    <DataTable
      label={t('users.members')}
      rows={rows}
      rowKey={(user) => user.uid}
      rowHref={(user) => `/admin/users/${encodeURIComponent(user.uid)}`}
      initialSort={{ id: 'joined', direction: 'desc' }}
      columns={[
        { id: 'user', header: t('users.col.user'), sortValue: (user) => user.name || user.email, cell: (user) => <UserIdentity user={user} /> },
        { id: 'contact', header: t('users.col.contact'), cell: (user) => <PhoneContact user={user} /> },
        {
          id: 'type',
          header: t('users.col.type'),
          sortValue: (user) => customerTypeInfo(user.customerType, locale).label,
          cell: (user) => <CustomerTypeBadge type={user.customerType} note={user.customerTypeOther} />,
        },
        {
          id: 'origin',
          header: t('users.col.from'),
          className: 'hidden 2xl:table-cell',
          sortValue: (user) => country(user.originCountry),
          cell: (user) =>
            user.originCountry ? (
              <span className="inline-flex items-center gap-1.5 text-[#475569]">
                <span aria-hidden="true">{flagEmoji(user.originCountry)}</span>
                {country(user.originCountry)}
              </span>
            ) : (
              <span className="text-[#64748B]">—</span>
            ),
        },
        { id: 'status', header: t('users.col.status'), sortValue: (user) => user.status, cell: (user) => <UserStatusBadge status={user.status} /> },
        { id: 'verified', header: t('users.col.verified'), className: 'hidden xl:table-cell', cell: (user) => <Verified user={user} /> },
        {
          id: 'passes',
          header: t('users.col.passes'),
          align: 'end',
          sortValue: (user) => user.activePasses,
          cell: (user) => <span className={`font-semibold tabular-nums ${user.activePasses ? 'text-[#0B1B3D]' : 'text-[#CBD5E1]'}`}>{user.activePasses}</span>,
        },
        {
          id: 'joined',
          header: t('users.col.joined'),
          sortValue: (user) => time(user.createdAt),
          cell: (user) => (
            <bdi dir="ltr" className="tabular-nums text-[#475569]">
              {formatIsraeliDate(user.createdAt)}
            </bdi>
          ),
        },
        {
          id: 'lastSignIn',
          header: t('users.col.lastSignIn'),
          className: 'hidden xl:table-cell',
          sortValue: (user) => time(user.lastSignInAt),
          cell: (user) => (
            <bdi dir="ltr" className="tabular-nums text-[#475569]">
              {formatIsraeliDateTime(user.lastSignInAt)}
            </bdi>
          ),
        },
      ]}
      card={(user) => (
        <>
          <UserIdentity user={user} />
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#E2E8F0] pt-3">
            <CustomerTypeBadge type={user.customerType} note={user.customerTypeOther} />
            {user.originCountry && (
              <span className="inline-flex items-center gap-1 text-xs text-[#475569]">
                <span aria-hidden="true">{flagEmoji(user.originCountry)}</span>
                {country(user.originCountry)}
              </span>
            )}
            {user.status !== 'active' && <UserStatusBadge status={user.status} />}
            <span className="ms-auto">
              <Verified user={user} />
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
            <PhoneContact user={user} />
            <span className="inline-flex items-center gap-3">
              <span>
                <span className="font-semibold tabular-nums text-[#0B1B3D]">{user.activePasses}</span> {tn('users.pass', user.activePasses, { n: '' }).trim()}
              </span>
              <span>
                {t('users.joined')} <bdi dir="ltr">{formatIsraeliDate(user.createdAt)}</bdi>
              </span>
            </span>
          </div>
          <div className="mt-1 text-xs text-[#64748B]">
            {t('users.lastSignIn')} <bdi dir="ltr">{formatIsraeliDateTime(user.lastSignInAt)}</bdi>
          </div>
        </>
      )}
    />
  )
}
