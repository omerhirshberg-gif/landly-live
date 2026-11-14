// Shared class strings for the admin portal (themed by the --adm-* tokens in app/globals.css). Plain Tailwind
// rather than the global .inp/.ds-btn classes: app/globals.css comes after
// Tailwind's utilities, so its rules would win over any per-field override.
// Every control is at least 48px tall (touch target) and uses 16px text so
// iOS Safari doesn't zoom into a focused field. Fields start at their own
// start edge (text-start), so one marked dir="auto" lines Hebrew up on the
// right as it's typed and English on the left.

export const ADMIN_INPUT =
  'block w-full min-h-12 rounded-xl border border-adm-line-strong bg-adm-input px-4 py-3 text-start text-base text-adm-text ' +
  'placeholder:text-adm-hint outline-none transition-[border-color,background-color,box-shadow] duration-150 ' +
  'focus:border-adm-accent focus:ring-4 focus:ring-adm-accent/30 ' +
  'disabled:cursor-not-allowed disabled:bg-adm-sunken disabled:text-adm-hint'

// A <select>: the chevron sits on the end edge (see select.admin-select in globals.css), so the text gets the
// start padding and clears the chevron with pe-10 in both directions.
export const ADMIN_SELECT = `${ADMIN_INPUT} admin-select cursor-pointer appearance-none ps-3.5 pe-10`

export const ADMIN_LABEL = 'block mb-1.5 text-sm font-semibold text-adm-text'

export const ADMIN_HINT = 'mt-1.5 text-[13px] leading-snug text-adm-muted'

const BUTTON_BASE =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold whitespace-nowrap ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.98] [-webkit-tap-highlight-color:transparent] ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adm-accent ' +
  'disabled:cursor-not-allowed disabled:opacity-70'

export const PRIMARY_BUTTON = `${BUTTON_BASE} bg-adm-accent text-adm-on-accent shadow-sm shadow-adm-accent/25 hover:bg-adm-accent-hover active:bg-adm-accent-press`

export const SECONDARY_BUTTON = `${BUTTON_BASE} border border-adm-line/90 bg-adm-surface text-adm-text shadow-sm hover:bg-adm-raised hover:border-adm-line-strong active:bg-adm-raised`

export const TERTIARY_BUTTON = `${BUTTON_BASE} bg-transparent px-2 text-adm-accent hover:underline active:bg-adm-accent-soft`

export const DANGER_BUTTON = `${BUTTON_BASE} border border-adm-danger-line bg-adm-surface text-adm-danger hover:bg-adm-danger-soft active:bg-adm-danger-soft`

/** Small uppercase heading over a group of cards or list rows. */
export const SECTION_HEADING = 'text-[13px] font-bold uppercase tracking-wider text-adm-muted mb-3'
