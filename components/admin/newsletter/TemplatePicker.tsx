'use client'

import { useAdminT, type AdminKey } from '@/lib/admin/translations'
import { TEMPLATE_IDS, type TemplateId } from '@/lib/newsletter/templates'

const ICONS: Record<TemplateId, string> = { perks: 'fa-tags', community: 'fa-people-group', welcome: 'fa-wallet', blank: 'fa-pen' }

// Four ready-made campaigns in a swipeable row: one tap fills the form in the
// selected language, and everything stays editable.
export default function TemplatePicker({ selected, onPick }: { selected: TemplateId | null; onPick: (id: TemplateId) => void }) {
  const { t } = useAdminT()
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-adm-text">{t('newsletter.templates.title')}</h3>
        <p className="text-xs text-adm-muted">{t('newsletter.templates.hint')}</p>
      </div>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 [scrollbar-width:thin]">
        {TEMPLATE_IDS.map((id) => {
          const on = selected === id
          return (
            <li key={id} className="snap-start">
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onPick(id)}
                className={`flex min-h-11 w-56 flex-col items-start gap-3 rounded-2xl border p-4 text-start transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adm-accent ${on ? 'border-adm-accent bg-adm-accent-soft ring-2 ring-adm-accent/30' : 'border-adm-line bg-adm-surface hover:border-adm-line-strong'}`}
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-full ${on ? 'bg-adm-accent text-adm-on-accent' : 'bg-adm-raised text-adm-accent'}`} aria-hidden="true">
                  <i className={`fa-solid ${ICONS[id]} text-sm`} />
                </span>
                <span className="block min-w-0">
                  <span className="block text-sm font-bold leading-snug text-adm-text">{t(`newsletter.template.${id}` as AdminKey)}</span>
                  <span className="mt-1 block text-xs leading-snug text-adm-muted">{t(`newsletter.template.${id}.desc` as AdminKey)}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
