'use client'

import { useAdminT, type AdminKey } from '@/lib/admin/translations'
import Card from '@/components/admin/Card'
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL, ADMIN_SELECT, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/admin/formStyles'
import TemplatePicker from './TemplatePicker'
import type { TemplateId } from '@/lib/newsletter/templates'
import { LANGS, SEGMENTS, type AudienceCount, type AudienceKind, type AudienceLang, type AudienceSegment, type AudienceState, type ContentState } from './types'

interface Props {
  content: ContentState
  onContent: (next: ContentState) => void
  audience: AudienceState
  onAudience: (next: AudienceState) => void
  count: AudienceCount
  testEmail: string
  onTestEmail: (value: string) => void
  testing: boolean
  onTest: () => void
  onSend: () => void
  template: TemplateId | null
  onTemplate: (id: TemplateId) => void
}

function RecipientBadge({ count }: { count: AudienceCount }) {
  const { t } = useAdminT()
  const tone = count.status === 'error' || count.overCap ? 'border-adm-danger-line bg-adm-danger-soft text-adm-danger' : 'border-adm-line bg-adm-raised text-adm-text'
  return (
    <div className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm ${tone}`} role="status">
      <span className="font-semibold">{t('newsletter.recipients')}</span>
      <span className="text-end">
        {count.status === 'loading' && <span className="text-adm-muted">{t('newsletter.recipients.loading')}</span>}
        {count.status === 'error' && t('newsletter.recipients.failed')}
        {count.status === 'ready' && count.overCap && <span>{t('newsletter.recipients.overCap', { cap: count.cap.toLocaleString('en-US') })}</span>}
        {count.status === 'ready' && !count.overCap && count.count === 0 && <span className="text-adm-muted">{t('newsletter.recipients.none')}</span>}
        {count.status === 'ready' && !count.overCap && count.count > 0 && <bdi dir="ltr" className="text-lg font-extrabold tabular-nums">{count.count.toLocaleString('en-US')}</bdi>}
      </span>
    </div>
  )
}

export default function NewsletterComposer({ content, onContent, audience, onAudience, count, testEmail, onTestEmail, testing, onTest, onSend, template, onTemplate }: Props) {
  const { t } = useAdminT()
  const set = (key: keyof ContentState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onContent({ ...content, [key]: e.target.value })
  const canSend = count.status === 'ready' && count.count > 0 && !count.overCap && !!content.subject.trim() && !!content.body.trim()

  return (
    <Card className="p-4 sm:p-6">
      <h2 className="mb-5 text-base font-bold tracking-tight text-adm-text">{t('newsletter.composer')}</h2>

      <div className="space-y-5">
        <TemplatePicker selected={template} onPick={onTemplate} />

        <div className="grid gap-4 border-t border-adm-line/80 pt-5 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label htmlFor="nl-audience" className={ADMIN_LABEL}>{t('newsletter.audience')}</label>
            <select id="nl-audience" className={ADMIN_SELECT} value={audience.kind} onChange={(e) => onAudience({ ...audience, kind: e.target.value as AudienceKind })}>
              {(['users', 'leads', 'all'] as const).map((kind) => (
                <option key={kind} value={kind}>{t(`newsletter.audience.${kind}` as AdminKey)}</option>
              ))}
            </select>
            {audience.kind !== 'users' && <p className={ADMIN_HINT}>{t('newsletter.audience.leadsHint')}</p>}
          </div>
          <div className="sm:col-span-3 sm:grid sm:grid-cols-2 sm:gap-4">
            <div>
              <label htmlFor="nl-segment" className={ADMIN_LABEL}>{t('newsletter.segment')}</label>
              <select id="nl-segment" className={ADMIN_SELECT} value={audience.segment} onChange={(e) => onAudience({ ...audience, segment: e.target.value as AudienceSegment })}>
                {SEGMENTS.map((s) => (
                  <option key={s} value={s}>{t(`newsletter.segment.${s}` as AdminKey)}</option>
                ))}
              </select>
            </div>
            <div className="mt-4 sm:mt-0">
              <label htmlFor="nl-lang" className={ADMIN_LABEL}>{t('newsletter.language')}</label>
              <select id="nl-lang" className={ADMIN_SELECT} value={audience.lang} onChange={(e) => onAudience({ ...audience, lang: e.target.value as AudienceLang })}>
                <option value="all">{t('newsletter.language.all')}</option>
                {LANGS.map((l) => (
                  <option key={l.value} value={l.value}>{l.native}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="sm:col-span-3">
            <RecipientBadge count={count} />
            {count.simulated && <p className={ADMIN_HINT}>{t('newsletter.simulated')}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="nl-subject" className={ADMIN_LABEL}>{t('newsletter.subject')}</label>
          <input id="nl-subject" dir="auto" maxLength={150} className={ADMIN_INPUT} value={content.subject} onChange={set('subject')} />
        </div>
        <div>
          <label htmlFor="nl-headline" className={ADMIN_LABEL}>{t('newsletter.headline')}</label>
          <input id="nl-headline" dir="auto" maxLength={150} className={ADMIN_INPUT} value={content.headline} onChange={set('headline')} />
        </div>
        <div>
          <label htmlFor="nl-body" className={ADMIN_LABEL}>{t('newsletter.body')}</label>
          <textarea id="nl-body" dir="auto" rows={9} maxLength={10000} className={`${ADMIN_INPUT} resize-y leading-relaxed`} value={content.body} onChange={set('body')} />
          <p className={ADMIN_HINT}>{t('newsletter.bodyHint')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nl-cta-label" className={ADMIN_LABEL}>{t('newsletter.ctaLabel')}</label>
            <input id="nl-cta-label" dir="auto" maxLength={40} className={ADMIN_INPUT} value={content.ctaLabel} onChange={set('ctaLabel')} />
          </div>
          <div>
            <label htmlFor="nl-cta-url" className={ADMIN_LABEL}>{t('newsletter.ctaUrl')}</label>
            <input id="nl-cta-url" type="url" inputMode="url" dir="ltr" placeholder="https://" className={ADMIN_INPUT} value={content.ctaUrl} onChange={set('ctaUrl')} />
          </div>
        </div>

        <div className="border-t border-adm-line/80 pt-5">
          <label htmlFor="nl-test" className={ADMIN_LABEL}>{t('newsletter.testEmail')}</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input id="nl-test" type="email" inputMode="email" dir="ltr" autoComplete="off" className={ADMIN_INPUT} value={testEmail} onChange={(e) => onTestEmail(e.target.value)} />
            <button type="button" onClick={onTest} disabled={testing || !content.subject.trim() || !content.body.trim()} className={`${SECONDARY_BUTTON} sm:shrink-0`}>
              <i className="fa-solid fa-flask" aria-hidden="true" />
              {testing ? t('newsletter.test.sending') : t('newsletter.test.send')}
            </button>
          </div>
        </div>

        <button type="button" onClick={onSend} disabled={!canSend} className={`${PRIMARY_BUTTON} w-full`}>
          <i className="fa-solid fa-paper-plane" aria-hidden="true" />
          {t('newsletter.send.button')}
        </button>
      </div>
    </Card>
  )
}
