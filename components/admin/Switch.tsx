'use client'

type SwitchProps = {
  checked: boolean
  onChange: (checked: boolean) => void
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'onChange' | 'className' | 'role'>

// An iOS-style switch: a 44 x 24 track with a white knob. It is a real checkbox underneath
// (role="switch"), laid over the track so the whole control is clickable and keyboard-focusable;
// put it inside a <label> and the label's text toggles it too. The knob slides along the inline axis
// (start-* is logical, so it flips with the page direction), and the track turns green when on.
export default function Switch({ checked, onChange, ...rest }: SwitchProps) {
  return (
    <span className="relative inline-flex h-6 w-11 shrink-0">
      <input
        {...rest}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full bg-slate-200 transition-colors duration-200 peer-checked:bg-emerald-500 peer-focus-visible:ring-4 peer-focus-visible:ring-emerald-500/30 peer-disabled:opacity-50 motion-reduce:transition-none" />
      <span aria-hidden="true" className="pointer-events-none absolute start-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-[inset-inline-start] duration-200 peer-checked:start-[1.375rem] peer-disabled:opacity-80 motion-reduce:transition-none" />
    </span>
  )
}
