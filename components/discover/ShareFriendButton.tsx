'use client'

import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'

// "Share with a friend" at the end of a results list: the system share sheet where there is one, else the link is copied.
export default function ShareFriendButton({ className = '' }: { className?: string }) {
  const { t } = useLang()
  const [copied, setCopied] = useState(false)
  const share = async () => {
    const url = window.location.href
    try {
      if (typeof navigator.share === 'function') await navigator.share({ url })
      else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // A dismissed share sheet is not an error.
    }
  }
  return (
    <div className={`flex justify-center ${className}`}>
      <button
        type="button"
        onClick={share}
        className="tap-target inline-flex min-h-12 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-[15px] font-semibold text-ink transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [@media(hover:hover)]:hover:bg-slate-50"
      >
        {copied ? <Check aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.75} /> : <Share2 aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.75} />}
        <span aria-live="polite">{t('category_share_friend')}</span>
      </button>
    </div>
  )
}
