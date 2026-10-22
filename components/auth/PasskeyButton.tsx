'use client'

// "Sign in with a passkey" on /login: the same metrics as GoogleButton (the
// auth screen's large secondary button), with the passkey glyph (a person and
// a key, after the FIDO Alliance mark) and a spinner while the browser's
// passkey sheet is open. In RTL the glyph stays as drawn; the row flips.
export default function PasskeyButton({
  label,
  busyLabel,
  busy,
  onClick,
  disabled,
}: {
  label: string
  busyLabel: string
  busy: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className="w-full inline-flex items-center justify-center gap-3 min-h-[54px] sm:min-h-[52px] px-5 rounded-[14px] border border-slate-200 bg-white text-slate-700 font-bold text-base select-none cursor-pointer transition-[transform,background-color] duration-150 ease-out [@media(hover:hover)]:hover:enabled:bg-slate-50 active:enabled:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      {busy ? (
        <span aria-hidden="true" className="h-[18px] w-[18px] rounded-full border-2 border-brand border-r-transparent animate-spin" />
      ) : (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#0038b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="9" cy="7" r="4" />
          <path d="M2 21v-1a6 6 0 0 1 6-6h2.5" />
          <circle cx="17.5" cy="13.5" r="2.5" />
          <path d="M17.5 16v5M17.5 18.5h2M17.5 21h1.5" />
        </svg>
      )}
      <span>{busy ? busyLabel : label}</span>
    </button>
  )
}
