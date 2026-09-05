import type { SubscriptionPlan } from '@/lib/firebase/users'

// Single source of truth for plan pricing, mirrored from the real prices in
// translations.ts (terms_p1 legal copy) — keep both in sync if prices change.
export interface PlanDefinition {
  id: SubscriptionPlan
  nameKey: 'plan_monthly_name' | 'plan_quarterly_name' | 'plan_annual_name'
  noteKey: 'plan_monthly_note' | 'plan_quarterly_note' | 'plan_annual_note1'
  billingMonths: number
  basePrice: number
  monthlyEquivalent: number
  currency: 'ILS'
}

export const PLANS: Record<SubscriptionPlan, PlanDefinition> = {
  monthly: {
    id: 'monthly',
    nameKey: 'plan_monthly_name',
    noteKey: 'plan_monthly_note',
    billingMonths: 1,
    basePrice: 39,
    monthlyEquivalent: 39,
    currency: 'ILS',
  },
  quarterly: {
    id: 'quarterly',
    nameKey: 'plan_quarterly_name',
    noteKey: 'plan_quarterly_note',
    billingMonths: 3,
    basePrice: 99,
    monthlyEquivalent: 33,
    currency: 'ILS',
  },
  annual: {
    id: 'annual',
    nameKey: 'plan_annual_name',
    noteKey: 'plan_annual_note1',
    billingMonths: 12,
    basePrice: 348,
    monthlyEquivalent: 29,
    currency: 'ILS',
  },
}

const MONTHLY_BASELINE = PLANS.monthly.monthlyEquivalent

export function isValidPlanId(value: string | null): value is SubscriptionPlan {
  return value === 'monthly' || value === 'quarterly' || value === 'annual'
}

// Discount vs. paying the monthly plan for the same number of months — 0 for
// the monthly plan itself, since there's nothing to discount against.
export function getPlanDiscount(plan: PlanDefinition): { amount: number; percent: number } | null {
  const equivalentMonthlyTotal = MONTHLY_BASELINE * plan.billingMonths
  const amount = equivalentMonthlyTotal - plan.basePrice
  if (amount <= 0) return null
  const percent = Math.round((amount / equivalentMonthlyTotal) * 100)
  return { amount, percent }
}

export function formatPrice(amount: number, currency: PlanDefinition['currency'] = 'ILS'): string {
  const symbol = currency === 'ILS' ? '₪' : currency
  return `${symbol}${amount}`
}
