'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'
import { SUPPORT_EMAIL } from '@/lib/config'
import { Store } from 'lucide-react'
import { FacebookIcon, InstagramIcon, LinkedinIcon } from '@/components/ui/SocialIcon'

// Navigation (Home, Deals, How It Works, Olim, Businesses, Support) and the
// account actions live in the navbar and mobile drawer; the footer adds
// About Us (the company link people look for at the bottom of a page, also
// in the guest navbar), then FAQ, legal and the business portal. Deals
// (/categories) is the navbar's discovery link, so the footer doesn't repeat it.
// hover: is gated to real pointers so a tap doesn't leave a link stuck blue
// on iOS/Android; the 44px tap-target box keeps wrapped rows easy to hit.
const linkClass = 'tap-target inline-flex items-center gap-1.5 whitespace-nowrap text-sm transition-colors duration-150 cursor-pointer underline-offset-4 [@media(hover:hover)]:hover:text-brand [@media(hover:hover)]:hover:underline focus-visible:text-brand focus-visible:underline'
const bizLinkClass = 'text-slate-700 font-semibold'

const SOCIALS = [
  { href: 'https://instagram.com/golandly', label: 'Instagram', icon: InstagramIcon },
  { href: 'https://www.facebook.com/share/1DU2BKFA9d/?mibextid=wwXIfr', label: 'Facebook', icon: FacebookIcon },
  { href: 'https://www.linkedin.com/company/golandly/', label: 'LinkedIn', icon: LinkedinIcon },
]

export default function Footer() {
  const { t } = useLang()

  const links = [
    { href: '/about', label: t('footer_about') },
    { href: '/support#faq', label: t('faq_label_short') },
    { href: '/terms', label: t('terms_link') },
    { href: '/privacy', label: t('privacy_link') },
    { href: '/business/login', label: t('footer_biz_login'), biz: true },
  ]

  return (
    <footer
      className="bg-canvas border-t border-line text-body pt-8 px-4 sm:px-6"
      style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center text-center gap-5 lg:grid lg:grid-cols-[1fr_auto] lg:items-center lg:text-start lg:gap-x-8 lg:gap-y-3">
          <div className="max-w-xs lg:col-start-1 lg:row-start-1">
            <div className="flex items-center justify-center lg:justify-start gap-2">
              <img src="/logo-mark.png" alt="Landly" className="h-8 w-auto" />
              <span className="font-black text-slate-900 text-lg">Landly</span>
            </div>
            <p className="text-sm leading-relaxed mt-2">{t('footer_tagline')}</p>
          </div>

          {/* Each separator rides with the link before it, so a wrapped line
              never starts with a dot and the last link has none after it */}
          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-y-2 text-sm lg:col-span-2 lg:row-start-2 lg:flex-nowrap lg:justify-start">
            {links.map((l, i) => (
              <span key={l.href} className="inline-flex items-center">
                <Link href={l.href} className={`${linkClass} ${l.biz ? bizLinkClass : 'text-slate-600 font-medium'}`}>
                  {l.biz && <Store aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />}
                  {l.label}
                </Link>
                {i < links.length - 1 && <span className="text-slate-300 select-none mx-2 sm:mx-3" aria-hidden="true">·</span>}
              </span>
            ))}
          </nav>

          <div className="flex items-center gap-2 lg:col-start-2 lg:row-start-1">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="tap-target w-9 h-9 rounded-full border border-line bg-white text-body hover:text-slate-900 hover:border-slate-300 flex items-center justify-center transition-colors"
              >
                <s.icon className="h-4 w-4" strokeWidth={1.75} />
              </a>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-line flex flex-col items-center gap-1.5 text-xs text-center lg:flex-row lg:justify-between lg:text-start">
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span>© {new Date().getFullYear()} <bdi>Landly</bdi>. {t('footer_copyright_notice')}</span>
            <span aria-hidden="true">·</span>
            <span>{t('footer_location')}</span>
            <span aria-hidden="true">·</span>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-slate-900 transition-colors"><bdi>{SUPPORT_EMAIL}</bdi></a>
          </p>
          <p className="text-slate-500">{t('app_banner_text')}</p>
        </div>
      </div>
    </footer>
  )
}
