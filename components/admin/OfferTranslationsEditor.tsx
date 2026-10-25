'use client'

import { useId, useState } from 'react'
import { CONTENT_LANGS, directionOf, type ContentOverrides, type ContentTranslations } from '@/lib/i18n/contentTranslation'
import { LANGUAGES } from '@/lib/i18n/languages'
import type { Lang } from '@/lib/i18n/translations'
import type { OfferTextField } from '@/lib/offers/offerText'
import { ADMIN_HINT, ADMIN_INPUT } from './formStyles'

const OFFER_FIELD_LABELS: Record<OfferTextField, string> = {
  title: 'Title',
  description: 'Description',
  redemptionTerms: 'Redemption terms',
  redemptionInstructions: 'Redemption instructions',
}

const LINK_BUTTON =
  'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[#0038B8] transition-colors hover:bg-[#F0F7FF] active:bg-[#E0EFFE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8]'

// The offer form's Translations group. Google translates the title,
// description, terms and steps into the other four languages when the offer
// is saved (app/api/admin/offers); here the admin sees what members get and
// can write their own wording for any field in any language. Their wording is
// marked machine: false and kept as written when the source text changes
// later; "Use Google's translation" hands the field back. One language at a
// time (tabs), each field shown in that language's direction. The business
// forms use it for the name too (`labels`, `intro`, `sourceLang`, `pendingText`).
export default function OfferTranslationsEditor<F extends string = OfferTextField>({
  source,
  stored,
  overrides,
  onChange,
  labels = OFFER_FIELD_LABELS as Record<string, string> as Record<F, string>,
  legend = 'Translations',
  intro,
  sourceLang: knownSourceLang,
  pendingText = 'Translated when you save.',
  emptyText = 'Fill in the offer text above first.',
  singleLine = ['title' as F],
}: {
  source: Record<F, string>
  stored: ContentTranslations<F> | null | undefined
  overrides: ContentOverrides<F>
  onChange: (next: ContentOverrides<F>) => void
  labels?: Record<F, string>
  legend?: string
  /** Replaces the default explanation under the legend. */
  intro?: React.ReactNode
  /** The source language when the form already knows it (a name's script), before anything is stored. */
  sourceLang?: string
  /** What an untranslated field says until the save. */
  pendingText?: string
  emptyText?: string
  /** Fields edited in a one-line input rather than a textarea. */
  singleLine?: F[]
}) {
  const id = useId()
  const sourceLang = knownSourceLang ?? stored?.sourceLang
  const targets = CONTENT_LANGS.filter((lang) => lang !== sourceLang)
  const [picked, setActive] = useState<Lang>(targets[0] ?? 'en')
  // The source language can change under the tabs (a name retyped in another script).
  const active = targets.includes(picked) ? picked : (targets[0] ?? 'en')
  const fields = (Object.keys(labels) as F[]).filter((field) => source[field]?.trim())

  const setOverride = (lang: Lang, field: F, text: string | null) => {
    const byField: Partial<Record<F, string>> = { ...overrides[lang] }
    if (text === null) delete byField[field]
    else byField[field] = text
    const next = { ...overrides, [lang]: byField }
    if (Object.keys(byField).length === 0) delete next[lang]
    onChange(next)
  }

  const dir = directionOf(active)
  const label = (lang: Lang) => LANGUAGES.find((l) => l.code === lang)?.label ?? lang

  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">{legend}</legend>
      {intro ? <p className="mb-4 text-sm text-[#475569]">{intro}</p> : <p className="mb-4 text-sm text-[#475569]">
        Translated automatically by Google when you save
        {sourceLang ? (
          <>
            {' '}from <span className="font-semibold">{LANGUAGES.find((l) => l.code === sourceLang)?.label ?? sourceLang}</span>
          </>
        ) : null}
        . Write your own wording for any field to replace Google&apos;s; it stays as written even if you edit the source text later.
      </p>}

      <div role="tablist" aria-label="Translation language" className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-[#F1F5F9] p-1 [scrollbar-width:none]">
        {targets.map((lang) => {
          const manual = Object.keys(overrides[lang] ?? {}).length
          return (
            <button
              key={lang}
              type="button"
              role="tab"
              id={`${id}-tab-${lang}`}
              aria-selected={active === lang}
              aria-controls={`${id}-panel`}
              onClick={() => setActive(lang)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors duration-150 ${
                active === lang ? 'bg-white text-[#0B1B3D] shadow-sm' : 'text-[#475569] [@media(hover:hover)]:hover:text-[#0B1B3D]'
              }`}
            >
              <span lang={lang}>{label(lang)}</span>
              {manual > 0 && (
                <span className="rounded-full bg-[#0038B8] px-1.5 text-[10px] leading-4 text-white" aria-label={`${manual} written by you`}>
                  {manual}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${active}`} className="space-y-4">
        {fields.length === 0 && <p className={ADMIN_HINT}>{emptyText}</p>}
        {fields.map((field) => {
          const manual = overrides[active]?.[field]
          const storedEntry = stored?.fields[active]?.[field]
          const machineText = storedEntry?.machine ? storedEntry.text : null
          const fieldId = `${id}-${active}-${field}`
          const multiline = !singleLine.includes(field)
          return (
            <div key={`${active}-${field}`} className="rounded-xl border border-[#E2E8F0] p-3 sm:p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <label htmlFor={manual !== undefined ? fieldId : undefined} className="text-sm font-semibold text-[#0B1B3D]">
                  {labels[field]}
                </label>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    manual !== undefined ? 'bg-[#F0F7FF] text-[#0038B8]' : 'bg-[#F1F5F9] text-[#475569]'
                  }`}
                >
                  {manual !== undefined ? 'Your wording' : 'Google Translate'}
                </span>
              </div>
              {manual !== undefined ? (
                <>
                  {multiline ? (
                    <textarea
                      id={fieldId}
                      lang={active}
                      dir={dir}
                      rows={3}
                      className={`${ADMIN_INPUT} resize-y`}
                      value={manual}
                      onChange={(e) => setOverride(active, field, e.target.value)}
                    />
                  ) : (
                    <input id={fieldId} lang={active} dir={dir} className={ADMIN_INPUT} value={manual} onChange={(e) => setOverride(active, field, e.target.value)} />
                  )}
                  <button type="button" className={`${LINK_BUTTON} mt-1`} onClick={() => setOverride(active, field, null)}>
                    <i className="fa-solid fa-language text-[11px]" aria-hidden="true" />
                    Use Google&apos;s translation
                  </button>
                </>
              ) : (
                <>
                  <p lang={machineText ? active : undefined} dir={machineText ? dir : 'auto'} className={`whitespace-pre-line text-sm ${machineText ? 'text-[#0F172A]' : 'italic text-[#94A3B8]'}`}>
                    {machineText ?? pendingText}
                  </p>
                  <button
                    type="button"
                    className={`${LINK_BUTTON} mt-1`}
                    onClick={() => setOverride(active, field, machineText ?? source[field])}
                  >
                    <i className="fa-solid fa-pen text-[11px]" aria-hidden="true" />
                    Write my own
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
