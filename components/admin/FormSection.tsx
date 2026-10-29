import Card from './Card'

interface FormSectionProps {
  icon: string
  title: string
  description?: string
  children: React.ReactNode
}

/** One titled card of a multi-section admin form. */
export function FormSection({ icon, title, description, children }: FormSectionProps) {
  return (
    <Card>
      <div className="flex items-start gap-3 border-b border-[#E2E8F0] px-5 py-4 sm:px-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F7FF] text-[#0038B8]">
          <i className={`fa-solid ${icon}`} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[#0B1B3D]">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-[#475569]">{description}</p>}
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </Card>
  )
}

/**
 * The form's Save / Cancel row, sticky at the bottom of the screen at every
 * size (above the home indicator on a phone), so a long form never hides its
 * primary action. `status` says whether there's anything to save.
 */
export function StickyActionBar({ status, children }: { status?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-[#E2E8F0] bg-white/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-6 sm:px-6 md:bottom-4 md:mx-0 md:rounded-2xl md:border md:px-5 md:pb-3 md:shadow-lg md:shadow-slate-900/5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {status ? (
          <p className="text-sm text-[#475569]" role="status">
            {status}
          </p>
        ) : (
          <span aria-hidden="true" />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>
      </div>
    </div>
  )
}

/** A spinner sized for a button label. */
export function ButtonSpinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 shrink-0 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
    />
  )
}
