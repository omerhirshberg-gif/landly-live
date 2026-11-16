import type { Currency, Money } from './pricing'

// Flat monthly plan fees (Vercel Pro today), editable by the admin without a
// deploy: stored in system_config/fixed_subscriptions of each Firebase project
// (lib/usage/fixedSubscriptions.server.ts); these defaults apply when nothing
// is stored. Applied to every month alike. Pure, so the page, the email and
// the tests share it.

export interface FixedSubscription {
  id: string
  label: string
  amount: number
  currency: Currency
  active: boolean
}

export const VERCEL_PRO_ID = 'vercelPro'
export const MAX_SUBSCRIPTIONS = 10
export const MAX_AMOUNT = 10_000

export const DEFAULT_SUBSCRIPTIONS: readonly FixedSubscription[] = [{ id: VERCEL_PRO_ID, label: 'Vercel Pro', amount: 20, currency: 'USD', active: true }]

const ID = /^[a-z][a-zA-Z0-9]{0,31}$/

export const priceOf = (item: Pick<FixedSubscription, 'amount' | 'currency'>): Money => ({ amount: item.amount, currency: item.currency })

function cleanItem(raw: unknown): FixedSubscription | null {
  if (!raw || typeof raw !== 'object') return null
  const { id, label, amount, currency, active } = raw as Record<string, unknown>
  if (typeof id !== 'string' || !ID.test(id)) return null
  if (typeof label !== 'string' || !label.trim() || label.trim().length > 60) return null
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) return null
  if (currency !== 'USD' && currency !== 'ILS') return null
  if (typeof active !== 'boolean') return null
  return { id, label: label.trim(), amount: Math.round(amount * 100) / 100, currency, active }
}

/** What the admin may save: a list with Vercel Pro in it (it can be switched off, not removed), unique ids, at most MAX_SUBSCRIPTIONS. */
export function parseSubscriptionsInput(raw: unknown): { ok: true; items: FixedSubscription[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_SUBSCRIPTIONS) return { ok: false, error: 'Invalid subscriptions.' }
  const items: FixedSubscription[] = []
  for (const entry of raw) {
    const item = cleanItem(entry)
    if (!item) return { ok: false, error: 'Invalid subscription.' }
    if (items.some((other) => other.id === item.id)) return { ok: false, error: 'Duplicate subscription.' }
    items.push(item)
  }
  if (!items.some((item) => item.id === VERCEL_PRO_ID)) return { ok: false, error: 'Vercel Pro cannot be removed.' }
  return { ok: true, items }
}

/** Stored items made safe: malformed ones dropped, Vercel Pro's default back when missing. Never throws. */
export function normalizeSubscriptions(raw: unknown): FixedSubscription[] {
  const stored = Array.isArray(raw) ? raw.map(cleanItem).filter((item): item is FixedSubscription => item !== null) : []
  const items = stored.filter((item, index) => stored.findIndex((other) => other.id === item.id) === index).slice(0, MAX_SUBSCRIPTIONS)
  return items.some((item) => item.id === VERCEL_PRO_ID) ? items : [...DEFAULT_SUBSCRIPTIONS, ...items].slice(0, MAX_SUBSCRIPTIONS)
}
