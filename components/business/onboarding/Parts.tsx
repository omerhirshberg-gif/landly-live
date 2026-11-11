import { Lock, ShieldCheck } from 'lucide-react'

export const FIELD =
  'block w-full min-h-12 rounded-xl border border-slate-200 bg-white px-4 py-3 text-start text-base text-ink placeholder:text-slate-400 ' +
  'outline-none transition-[border-color,box-shadow] duration-150 focus:border-brand focus:ring-4 focus:ring-brand/15 disabled:bg-slate-50'

/** A frosted section card, the page's one surface treatment. */
export function Section({ index, title, note, children }: { index?: number; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md sm:p-7">
      <header className="mb-5 flex items-start gap-3">
        {index !== undefined && (
          <span aria-hidden="true" className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">{index}</span>
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
          {note && <p className="mt-0.5 text-sm text-slate-500">{note}</p>}
        </div>
      </header>
      {children}
    </section>
  )
}

export function Field({ id, label, help, error, children }: { id: string; label: string; help?: string; error?: string | null; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {help && <span className="ms-1.5 font-normal text-slate-400">· {help}</span>}
      </label>
      {children}
      {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-medium text-red-600">{error}</p>}
    </div>
  )
}

/** A read-only term the merchant can see but not change. */
export function LockedTerm({ label, value, help }: { label: string; value: string; help: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-blue-50/40 to-indigo-50/20 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <Lock aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-ink" dir="auto">{value}</p>
      <p className="mt-0.5 text-sm text-slate-500">{help}</p>
    </div>
  )
}

export function BankEncryptionBanner({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-5 flex gap-3 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-blue-50/40 to-indigo-50/20 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white bg-white shadow-sm" aria-hidden="true">
        <ShieldCheck className="h-5 w-5 text-brand" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{body}</p>
      </div>
    </div>
  )
}
