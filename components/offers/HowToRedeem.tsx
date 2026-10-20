'use client'

import { useId } from 'react'
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
  /** On the offer page the member hasn't bought yet, so step one is buying it. */
  includePurchaseStep?: boolean
  /**
   * 'card': its own bordered card. 'section': a full-size section inside
   * another card (the offer page). 'inline': compact, inside a wallet pass.
   */
  variant?: 'card' | 'section' | 'inline'
}

// "How to redeem" ("אופן המימוש"): the method, then numbered steps -- the
// merchant's own instructions, or the method's standard steps -- then any
// conditions. Shared by the offer page and the web wallet; the Expo wallet
// (landly-mobile VoucherPass) shows the same content.
export default function HowToRedeem({ method, instructions, instructionsLang, terms = '', termsLang, includePurchaseStep = false, variant = 'card' }: HowToRedeemProps) {
  const { t } = useLang()
  const headingId = useId()
  const steps = [...(includePurchaseStep ? [t('redeem_step_buy')] : []), ...redemptionSteps(method, instructions, t)]
  // The merchant's own steps are in the content's language; the standard ones in the reader's.
  const stepLang = instructions.trim() ? instructionsLang ?? undefined : undefined

  return (
    <section
      aria-labelledby={headingId}
      className={variant === 'card' ? 'rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm sm:p-6' : ''}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className={`font-bold text-[#0B1B3D] ${variant === 'inline' ? 'text-sm' : 'text-base'}`}>
          {t('redeem_how_title')}
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0F7FF] px-3 py-1 text-xs font-semibold text-[#0038B8]">
          <i className={`fa-solid ${REDEMPTION_METHOD_ICONS[method]} text-[10px]`} aria-hidden="true" />
          {t(REDEMPTION_METHOD_LABEL_KEYS[method])}
        </span>
      </div>

      <ol className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0038B8] text-[11px] font-bold text-white"
            >
              {i + 1}
            </span>
            <span className="pt-0.5 text-sm leading-relaxed text-[#475569]" lang={includePurchaseStep && i === 0 ? undefined : stepLang} dir="auto">
              {step}
            </span>
          </li>
        ))}
      </ol>

      {terms && (
        <div className="mt-5 border-t border-[#F1F5F9] pt-4">
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-[#94A3B8]">{t('voucher_redemption_terms_label')}</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-[#475569]" lang={termsLang ?? undefined} dir="auto">
            {terms}
          </p>
        </div>
      )}
    </section>
  )
}
