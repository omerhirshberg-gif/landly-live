// Shared class strings for the admin portal's light theme. Plain Tailwind
// rather than the global .inp/.ds-btn classes: app/globals.css comes after
// Tailwind's utilities, so its rules would win over any per-field override.
// Every control is at least 48px tall (touch target) and uses 16px text so
// iOS Safari doesn't zoom into a focused field. Fields start at their own
// start edge (text-start), so one marked dir="auto" lines Hebrew up on the
// right as it's typed and English on the left.

export const ADMIN_INPUT =
  'block w-full min-h-12 rounded-xl border border-[#CBD5E1] bg-white px-4 py-3 text-start text-base text-[#0F172A] ' +
  'placeholder:text-[#94A3B8] outline-none transition-[border-color,background-color,box-shadow] duration-150 ' +
  'focus:border-[#0038B8] focus:bg-[#F8FBFF] focus:ring-4 focus:ring-[#0038B8]/15 ' +
  'disabled:cursor-not-allowed disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]'

export const ADMIN_LABEL = 'block mb-1.5 text-sm font-semibold text-[#0B1B3D]'

export const ADMIN_HINT = 'mt-1.5 text-[13px] leading-snug text-[#64748B]'

const BUTTON_BASE =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold whitespace-nowrap ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.98] [-webkit-tap-highlight-color:transparent] ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0038B8] ' +
  'disabled:cursor-not-allowed disabled:opacity-70'

export const PRIMARY_BUTTON = `${BUTTON_BASE} bg-[#0038B8] text-white shadow-sm shadow-[#0038B8]/25 hover:bg-[#002A8A] active:bg-[#002066]`

export const SECONDARY_BUTTON = `${BUTTON_BASE} border border-slate-200/90 bg-white text-slate-800 shadow-sm hover:bg-slate-50 hover:border-[#CBD5E1] active:bg-slate-100`

export const TERTIARY_BUTTON = `${BUTTON_BASE} bg-transparent px-2 text-[#0038B8] hover:underline active:bg-[#F0F7FF]`

export const DANGER_BUTTON = `${BUTTON_BASE} border border-[#FCA5A5] bg-white text-[#B91C1C] hover:bg-[#FEF2F2] active:bg-[#FEE2E2]`

/** Small uppercase heading over a group of cards or list rows. */
export const SECTION_HEADING = 'text-[13px] font-bold uppercase tracking-wider text-slate-500 mb-3'
