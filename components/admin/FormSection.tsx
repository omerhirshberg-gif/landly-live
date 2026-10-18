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
 * The submit row. On phones it sticks to the bottom of the screen (above the
 * home indicator) so the button stays reachable in a long form.
 */
export function FormActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 border-t border-[#E2E8F0] bg-white/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
      {children}
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
