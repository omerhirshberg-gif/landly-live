import { useLang } from '@/lib/i18n/useLang'

// An empty perk slot on Home's category rows: the OfferCard's frame (rounded-2xl, hairline
// border, 16:10 picture area, white body) in neutral slate blocks, with a muted "Coming soon".
// Not a link and not focusable: it has no offer to open. A published perk takes its place.
export default function OfferCardPlaceholder({ className = '' }: { className?: string }) {
  const { t } = useLang()
  return (
    <div
      data-offer-placeholder=""
      className={`flex h-full select-none flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.07)] ${className}`}
    >
      <div className="relative aspect-[16/10] max-h-40 w-full bg-gradient-to-br from-slate-100 to-slate-50">
        <span className="absolute start-2.5 top-2.5 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold leading-4 text-muted ring-1 ring-slate-200/80">
          {t('home_coming_soon')}
        </span>
      </div>
      <div aria-hidden="true" className="flex flex-1 flex-col gap-2 p-3">
        <div className="h-3 w-1/2 rounded-full bg-slate-100" />
        <div className="h-3.5 w-[92%] rounded-full bg-slate-100" />
        <div className="h-3.5 w-3/5 rounded-full bg-slate-100" />
        <div className="mt-auto flex items-center gap-2 pt-2">
          <div className="h-5 w-20 rounded-full bg-slate-100" />
          <div className="h-4 w-12 rounded-full bg-slate-50" />
        </div>
      </div>
    </div>
  )
}
