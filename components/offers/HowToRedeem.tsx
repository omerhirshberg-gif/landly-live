'use client'

import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { REDEMPTION_METHOD_LABEL_KEYS, redemptionSteps, type RedemptionMethod } from '@/lib/offers/redemption'
import { REDEMPTION_METHOD_ICONS } from '@/components/discover/RedemptionBadge'

interface HowToRedeemProps {
  method: RedemptionMethod
  instructions: string
  /** The language `instructions` is written in (translated or not), for lang on the merchant's steps. */
  instructionsLang?: string | null
  /** The merchant's conditions (redemptionTerms), shown under the steps. */
  terms?: string
  termsLang?: string | null
  /** Kept for callers; the "buy it" step is no longer shown. */
  includePurchaseStep?: boolean
  /**
   * 'card': its own bordered card. 'section': a full-size section inside
   * another card. 'inline': compact, inside a wallet pass. 'accordion': the
   * offer page's folds, the steps open and any conditions closed.
   */
  variant?: 'card' | 'section' | 'inline' | 'accordion'
}

// "How to redeem" ("אופן המימוש"): the method, then numbered steps -- the
// merchant's own instructions, or the method's standard steps -- then any
// conditions. Shared by the offer page and the web wallet; the Expo wallet
// (landly-mobile VoucherPass) shows the same content.
export default function HowToRedeem({ method, instructions, instructionsLang, terms = '', termsLang, variant = 'card' }: HowToRedeemProps) {
  const { t } = useLang()
  const headingId = useId()
  const MethodIcon = REDEMPTION_METHOD_ICONS[method]
  const steps = redemptionSteps(method, instructions, t)
  // Numbers only where order matters: the merchant's own multi-line instructions.
  // The standard copy reads as plain lines, with no "1, 2" badges.
  const numbered = instructions.trim() !== '' && steps.length > 1
  // The merchant's own steps are in the content's language; the standard ones in the reader's.
  const stepLang = instructions.trim() ? instructionsLang ?? undefined : undefined

  const methodPill = (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brandTint px-3 py-1 text-xs font-semibold text-brand">
      <MethodIcon aria-hidden="true" className="h-3 w-3" strokeWidth={2} />
      {t(REDEMPTION_METHOD_LABEL_KEYS[method])}
    </span>
  )
  const stepList = (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3">
          {numbered && (
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brandTint text-micro font-bold text-brand"
            >
              {i + 1}
            </span>
          )}
          <span className="text-sm leading-relaxed text-body" lang={stepLang} dir="auto">
            {step}
          </span>
        </li>
      ))}
    </ol>
  )
  const termsText = (
    <p className="whitespace-pre-line text-sm leading-relaxed text-body" lang={termsLang ?? undefined} dir="auto">
      {terms}
    </p>
  )

  if (variant === 'accordion') {
    return (
      <div className="divide-y divide-slate-100 fold:divide-slate-200/80">
        <Fold title={t('offer_how_title')} defaultOpen>
          <div className="mb-4">{methodPill}</div>
          {stepList}
        </Fold>
        {terms && <Fold title={t('offer_fine_print_title')}>{termsText}</Fold>}
      </div>
    )
  }

  return (
    <section
      aria-labelledby={headingId}
      className={variant === 'card' ? 'rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6' : ''}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className={`font-bold text-ink ${variant === 'inline' ? 'text-sm' : 'text-base'}`}>
          {t('redeem_how_title')}
        </h2>
        {methodPill}
      </div>

      <div className="mt-4">{stepList}</div>

      {terms && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">{t('voucher_redemption_terms_label')}</h3>
          {termsText}
        </div>
      )}
    </section>
  )
}

// One fold of the offer page, the FAQ's accordion without its card.
export function Fold({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()

  return (
    <div>
      <h2>
        <button
          type="button"
          id={`${id}-button`}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={() => setOpen(!open)}
          className="flex min-h-12 w-full items-center justify-between gap-4 py-3 text-start text-base font-bold text-ink transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [@media(hover:hover)]:hover:text-brand"
        >
          <span>{title}</span>
          <ChevronDown aria-hidden="true" className={`acc-icon h-5 w-5 flex-shrink-0 text-brand ${open ? 'open' : ''}`} strokeWidth={1.75} />
        </button>
      </h2>
      <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-button`} className={`acc-body ${open ? 'open' : ''}`}>
        <div>
          <div className="pb-4">{children}</div>
        </div>
      </div>
    </div>
  )
}
