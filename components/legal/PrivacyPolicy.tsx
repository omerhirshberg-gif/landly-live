import type { ReactNode } from 'react'
import { SUPPORT_EMAIL } from '@/lib/config'
import { RTL_LANGS, translations, type Lang } from '@/lib/i18n/translations'
import {
  PRIVACY_POLICY_UPDATED_ISO,
  isLtrToken,
  privacyPolicy,
  type PolicyBlock,
  type PolicyInline,
} from '@/lib/legal/privacyPolicyContent'

// The privacy policy, rendered from the shared text in
// lib/legal/privacyPolicyContent.ts (the same data the app's native screen
// renders). Kept free of hooks and client-only code so /privacy can render it
// on the server: reviewers such as Google's OAuth team get the full English
// text in the first HTML response, no JavaScript needed, and tests can render
// it with react-dom/server. LocalizedPrivacyPolicy then shows it in the
// member's language.
//
// Every statement describes what the code actually does. When data handling
// changes -- a new field on users/orders/vouchers, a new provider, analytics,
// push tokens -- update the pp_* strings in all five languages and
// PRIVACY_POLICY_UPDATED_ISO.

export const PRIVACY_POLICY_UPDATED = { iso: PRIVACY_POLICY_UPDATED_ISO, label: translations.en.pp_updated_date }

function A({ href, children }: { href: string; children: ReactNode }) {
  const external = href.startsWith('http')
  return (
    <a
      href={href}
      className="text-[#0038B8] font-semibold underline underline-offset-2 break-words hover:text-[#0066FF]"
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  )
}

function Run({ part }: { part: PolicyInline }) {
  if (typeof part === 'string') return <>{part}</>
  if ('bold' in part) return <strong>{part.bold}</strong>
  if ('code' in part) return <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.9em]">{part.code}</code>
  if ('link' in part) return <A href={part.href}>{part.link}</A>
  return <A href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</A>
}

// Addresses, numbers, URLs and code keep their own left-to-right order inside
// Hebrew text; a phone number has no strong characters, so it's set ltr.
function Runs({ parts }: { parts: PolicyInline[] }) {
  return (
    <>
      {parts.map((part, i) =>
        isLtrToken(part) ? (
          <bdi key={i} dir={typeof part === 'object' && 'href' in part && part.href.startsWith('tel:') ? 'ltr' : undefined}>
            <Run part={part} />
          </bdi>
        ) : (
          <Run key={i} part={part} />
        )
      )}
    </>
  )
}

function Block({ block }: { block: PolicyBlock }) {
  switch (block.kind) {
    case 'h3':
      return <h3 className="text-base sm:text-lg font-bold text-[#0F172A] pt-2">{block.text}</h3>
    case 'p':
      return <p><Runs parts={block.text} /></p>
    case 'callout':
      return (
        <p className="rounded-xl border border-[#BFD4FF] bg-[#EFF5FF] p-4 sm:p-5 text-[#0F172A]">
          <Runs parts={block.text} />
        </p>
      )
    case 'ul':
      return (
        <ul className="list-disc ps-6 space-y-2 marker:text-slate-400">
          {block.items.map((item, i) => <li key={i}><Runs parts={item} /></li>)}
        </ul>
      )
    case 'ol':
      return (
        <ol className="list-decimal ps-6 space-y-2 marker:font-semibold marker:text-[#0F172A]">
          {block.items.map((item, i) => <li key={i}><Runs parts={item} /></li>)}
        </ol>
      )
    case 'address':
      return (
        <address className="not-italic rounded-xl border border-slate-200 bg-[#F8FAFC] p-5 sm:p-6 space-y-1">
          {block.lines.map((line, i) => <p key={i}><Runs parts={line} /></p>)}
        </address>
      )
  }
}

export default function PrivacyPolicy({ lang = 'en' }: { lang?: Lang }) {
  const policy = privacyPolicy(lang)
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)

  return (
    <article lang={lang} dir={isRtl ? 'rtl' : 'ltr'} className="text-[#334155] text-base leading-[1.7] break-words">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0066FF] mb-2">Landly</p>
        <h1 className="text-3xl sm:text-4xl font-black text-[#0F172A] leading-tight mb-3">{policy.title}</h1>
        <p className="text-sm text-slate-500">
          {policy.updatedLabel} <time dateTime={PRIVACY_POLICY_UPDATED_ISO}>{policy.updatedDate}</time>
        </p>
        {lang !== 'en' && (
          <p role="note" className="mt-5 rounded-xl border border-[#BFD4FF] bg-[#EFF5FF] px-4 py-3 text-sm text-[#0F172A]">
            {translations[lang].legal_translation_notice}
          </p>
        )}
        <p className="mt-5"><Runs parts={policy.intro} /></p>
      </header>

      <nav aria-label={policy.contents} className="mb-10 rounded-xl border border-slate-200 bg-[#F8FAFC] p-5 sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] mb-3">{policy.contents}</h2>
        <ol className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 list-decimal ps-5 text-sm marker:text-slate-400">
          {policy.sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-[#0038B8] hover:underline underline-offset-2">{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      {policy.sections.map((section, index) => (
        <section
          key={section.id}
          id={section.id}
          aria-labelledby={`${section.id}-title`}
          className="scroll-mt-24 border-t border-slate-200 pt-8 mt-8 first:border-t-0 first:pt-0 first:mt-0"
        >
          <h2 id={`${section.id}-title`} className="text-xl sm:text-2xl font-extrabold text-[#0F172A] mb-4 leading-snug">
            {index + 1}. {section.title}
          </h2>
          <div className="space-y-4">
            {section.blocks.map((block, i) => <Block key={i} block={block} />)}
          </div>
        </section>
      ))}
    </article>
  )
}
