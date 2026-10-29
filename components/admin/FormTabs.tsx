'use client'

import { useCallback, useId, useRef, useState } from 'react'

// A long admin form in tabs (Basic info, Media, Pricing…) instead of one
// endless scroll. Every panel stays mounted, only hidden, so the whole form
// submits and validates as one: when the browser finds an invalid field in a
// hidden panel (it can't focus it there), its tab opens, the field is focused
// and its message shown, and every tab with a problem gets a red dot. The tab
// row sticks under the admin header and scrolls sideways on a phone. The
// admin is always LTR (AdminShell), so the arrow keys move left and right.

export interface FormTab<T extends string = string> {
  id: T
  label: string
  icon: string
}

export function useFormTabs<T extends string>(tabs: readonly FormTab<T>[]) {
  const id = useId()
  const [active, setActive] = useState<T>(tabs[0]!.id)
  const [errors, setErrors] = useState<ReadonlySet<T>>(new Set())
  // Invalid events of one submit attempt arrive together; a pause starts a new attempt.
  const lastInvalid = useRef(0)

  const onInvalidCapture = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    const field = event.target as HTMLInputElement
    const tab = field.closest<HTMLElement>('[data-form-tab]')?.dataset.formTab as T | undefined
    if (!tab) return
    const now = performance.now()
    const fresh = now - lastInvalid.current > 250
    lastInvalid.current = now
    if (!fresh) {
      setErrors((prev) => new Set(prev).add(tab))
      return
    }
    setErrors(new Set([tab]))
    setActive(tab)
    // Once its panel is showing: the browser's own message, on the field itself.
    requestAnimationFrame(() => {
      field.focus({ preventScroll: false })
      field.reportValidity?.()
    })
  }, [])

  // A submit that passed the browser's checks clears the dots.
  const onSubmitCapture = useCallback(() => setErrors(new Set()), [])

  return {
    tabs,
    active,
    setActive,
    errors,
    tabId: (tab: T) => `${id}-tab-${tab}`,
    panelId: (tab: T) => `${id}-panel-${tab}`,
    formProps: { onInvalidCapture, onSubmitCapture },
  }
}

export type FormTabsState<T extends string> = ReturnType<typeof useFormTabs<T>>

export function FormTabs<T extends string>({ state, label }: { state: FormTabsState<T>; label: string }) {
  const { tabs, active, setActive, errors, tabId, panelId } = state

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === active)
    const next =
      event.key === 'ArrowRight' ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length
      : event.key === 'Home' ? 0
      : event.key === 'End' ? tabs.length - 1
      : null
    if (next === null) return
    event.preventDefault()
    setActive(tabs[next]!.id)
    document.getElementById(tabId(tabs[next]!.id))?.focus()
  }

  return (
    // Sticks under the admin header; on a phone it runs edge to edge and scrolls sideways.
    <div className="sticky top-[var(--admin-header-h)] z-20 -mx-4 mb-6 overflow-x-auto bg-[#F8FAFC]/90 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 md:top-[var(--admin-header-h-md)] md:mx-0 md:px-0">
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex w-max min-w-full gap-1 rounded-2xl border border-slate-200/80 bg-white p-1 shadow-sm">
        {tabs.map((tab) => {
          const selected = tab.id === active
          const invalid = errors.has(tab.id)
          return (
            <button
              key={tab.id}
              id={tabId(tab.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId(tab.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              className={`relative inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-colors duration-150 [-webkit-tap-highlight-color:transparent] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0038B8] ${
                selected ? 'bg-[#0038B8] text-white shadow-sm shadow-[#0038B8]/25' : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0B1B3D]'
              }`}
            >
              <i className={`fa-solid ${tab.icon} text-xs`} aria-hidden="true" />
              {tab.label}
              {invalid && (
                <>
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#DC2626]" aria-hidden="true" />
                  <span className="sr-only">(needs attention)</span>
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** One tab's fields: always mounted (so the form validates and submits whole), shown only while its tab is. */
export function TabPanel<T extends string>({ state, tab, children }: { state: FormTabsState<T>; tab: T; children: React.ReactNode }) {
  const selected = state.active === tab
  return (
    <div
      role="tabpanel"
      id={state.panelId(tab)}
      aria-labelledby={state.tabId(tab)}
      data-form-tab={tab}
      className={selected ? 'space-y-6' : 'hidden'}
    >
      {children}
    </div>
  )
}
