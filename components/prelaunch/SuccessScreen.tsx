'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import { WhatsAppIcon } from '@/components/ui/SocialIcon'
import { PRELAUNCH_COPY, type PrelaunchLang } from '@/lib/prelaunch/copy'
import { referralLink, whatsappShareHref, type JoinedLead } from '@/lib/prelaunch/share'
import CommunityCard from './CommunityCard'

const COPIED_MS = 2200
const SECONDARY = 'inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-slate-200 bg-white px-5 text-sm font-semibold text-ink transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20'

// In-app browsers often have no navigator.clipboard, and the page may be
// refused it even where it exists.
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    area.setSelectionRange(0, text.length)
    let copied = false
    try {
      copied = document.execCommand('copy')
    } catch {
      copied = false
    }
    area.remove()
    return copied
  }
}

// The thank-you, the WhatsApp community first, then the chance to tell a friend.
// WhatsApp sharing is a plain link in this tab: in-app browsers
// often block window.open, and a link is what they hand to WhatsApp. Coming back
// can reload the page, which lands here again (lib/prelaunch/share.ts). The link
// is also shown as selectable text, the last resort where every share and copy
// route is blocked.
export default function SuccessScreen({
  lang,
  lead,
  onStartOver,
}: {
  lang: PrelaunchLang
  lead: JoinedLead
  onStartOver: () => void
}) {
  const copy = PRELAUNCH_COPY[lang]
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [link, setLink] = useState('')
  const [canShare, setCanShare] = useState(false)
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [titleStart, titleEnd] = copy.successTitle.split('{name}')

  useEffect(() => {
    setLink(referralLink(window.location.origin, lang, lead.referralCode))
    setCanShare(typeof navigator.share === 'function')
    // Also a visitor coming back to a finished sign-up, who would otherwise land on the hero.
    document.getElementById('join-form')?.scrollIntoView({ block: 'start' })
    headingRef.current?.focus({ preventScroll: true })
    return () => clearTimeout(timer.current)
  }, [lang, lead.referralCode])

  const copyLink = async () => {
    if (!(await copyText(link))) return
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), COPIED_MS)
  }

  const shareElsewhere = () => {
    // Dismissing the share sheet rejects; there's nothing to report.
    navigator.share({ text: copy.shareText, url: link }).catch(() => {})
  }

  return (
    <div>
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
          <Check aria-hidden="true" size={32} strokeWidth={1.75} className="text-emerald-600" />
        </div>
        <h2 ref={headingRef} tabIndex={-1} className="text-3xl font-black leading-tight tracking-tight [overflow-wrap:anywhere] focus:outline-none sm:text-4xl">
          {titleStart}<bdi>{lead.firstName}</bdi>{titleEnd}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-base leading-relaxed text-body [text-wrap:balance]">{copy.successSub}</p>
      </div>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
      <CommunityCard lang={lang} />

      <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md sm:p-7">
        <h3 className="text-lg font-extrabold leading-snug tracking-tight [text-wrap:balance]">{copy.shareTitle}</h3>

        <a
          href={link ? whatsappShareHref(lang, link) : undefined}
          className={`mt-4 ${SECONDARY}`}
        >
          <WhatsAppIcon width={18} height={18} fill="currentColor" />
          {copy.shareWhatsApp}
        </a>

        <div className="mt-3 space-y-3">
          <button type="button" onClick={copyLink} className={SECONDARY}>
            {copied ? <Check aria-hidden="true" size={18} strokeWidth={1.75} className="text-emerald-600" /> : <Copy aria-hidden="true" size={18} strokeWidth={1.75} />}
            <span aria-live="polite">{copied ? copy.copied : copy.copyLink}</span>
          </button>
          {canShare && (
            <button type="button" onClick={shareElsewhere} className={SECONDARY}>
              <Share2 aria-hidden="true" size={18} strokeWidth={1.75} />
              {copy.shareMore}
            </button>
          )}
        </div>

        {link && (
          <p className="mt-4 text-center text-xs text-slate-500">
            <span className="block">{copy.linkLabel}</span>
            <bdi dir="ltr" className="mt-1 block select-all break-all font-medium text-slate-600">{link}</bdi>
          </p>
        )}
      </section>
      </div>

      <p className="mt-3 text-center">
        <button type="button" onClick={onStartOver} className="min-h-[44px] px-3 text-sm font-medium text-slate-500 underline underline-offset-2 transition-colors hover:text-brand">
          {copy.notYou}
        </button>
      </p>
    </div>
  )
}
