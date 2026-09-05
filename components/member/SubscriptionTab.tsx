'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { User } from 'firebase/auth'
import { useLang } from '@/lib/i18n/useLang'
import { Lang } from '@/lib/i18n/translations'
import { getUserDocument, SubscriptionPlan, SubscriptionStatus } from '@/lib/firebase/users'

const PLAN_NAME_KEY: Record<SubscriptionPlan, 'plan_monthly_name' | 'plan_quarterly_name' | 'plan_annual_name'> = {
  monthly: 'plan_monthly_name',
  quarterly: 'plan_quarterly_name',
  annual: 'plan_annual_name',
}

const DATE_LOCALE: Record<Lang, string> = {
  en: 'en-US',
  ru: 'ru-RU',
  es: 'es-ES',
  fr: 'fr-FR',
  he: 'he-IL',
}

export default function SubscriptionTab({ user }: { user: User }) {
  const { t, lang } = useLang()
  const [status, setStatus] = useState<SubscriptionStatus>('inactive')
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getUserDocument(user.uid).then((doc) => {
      if (cancelled) return
      setStatus(doc?.subscriptionStatus ?? 'inactive')
      setPlan(doc?.subscriptionPlan ?? null)
      setExpiresAt(doc?.subscriptionExpiresAt ?? null)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [user.uid])

  const isExpired = !!expiresAt && expiresAt.getTime() < Date.now()
  const hasActivePlan = !loading && status === 'active' && plan && !isExpired
  const formattedExpiry = expiresAt
    ? new Intl.DateTimeFormat(DATE_LOCALE[lang], { year: 'numeric', month: 'long', day: 'numeric' }).format(expiresAt)
    : null

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 rounded-full px-3 py-1.5">
          <i className={`fa-solid fa-circle text-[6px] ${hasActivePlan ? 'text-emerald-500' : 'text-slate-400'}`}></i>
          {loading ? '…' : hasActivePlan ? t('sub_active_label') : status}
        </span>
        {hasActivePlan && plan && (
          <span className="text-sm font-bold text-slate-900">{t(PLAN_NAME_KEY[plan])}</span>
        )}
      </div>

      {hasActivePlan && formattedExpiry ? (
        <p className="text-sm text-slate-700 leading-relaxed mb-5">
          {t('sub_expires_label').replace('{date}', formattedExpiry)}
        </p>
      ) : expiresAt && formattedExpiry ? (
        <p className="text-sm text-red-600 font-semibold leading-relaxed mb-5">
          {t('sub_expired_label').replace('{date}', formattedExpiry)}
        </p>
      ) : (
        <p className="text-sm text-slate-700 leading-relaxed mb-5">{t('sub_status_message')}</p>
      )}

      <Link href="/#pricing" className="tap-target inline-flex items-center gap-2 text-brand font-bold text-sm hover:underline">
        <span>{t('sub_view_plans_link')}</span>
        <i className="fa-solid fa-arrow-right text-xs"></i>
      </Link>
    </div>
  )
}
