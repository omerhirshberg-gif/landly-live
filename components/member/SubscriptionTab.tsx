'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { User } from 'firebase/auth'
import { useLang } from '@/lib/i18n/useLang'
import { getUserDocument, SubscriptionStatus } from '@/lib/firebase/users'

export default function SubscriptionTab({ user }: { user: User }) {
  const { t } = useLang()
  const [status, setStatus] = useState<SubscriptionStatus>('inactive')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getUserDocument(user.uid).then((doc) => {
      if (cancelled) return
      setStatus(doc?.subscriptionStatus ?? 'inactive')
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [user.uid])

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 rounded-full px-3 py-1.5">
          <i className="fa-solid fa-circle text-[6px] text-slate-400"></i>
          {loading ? '…' : status}
        </span>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed mb-5">{t('sub_status_message')}</p>
      <Link href="/#pricing" className="tap-target inline-flex items-center gap-2 text-brand font-bold text-sm hover:underline">
        <span>{t('sub_view_plans_link')}</span>
        <i className="fa-solid fa-arrow-right text-xs"></i>
      </Link>
    </div>
  )
}
