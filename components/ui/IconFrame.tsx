import type { LucideIcon } from 'lucide-react'

// The one icon tile: a Lucide outline at a fine 1.75 stroke, centred in a
// soft frame with a hairline, never a solid colour block. sm (40px) for
// checklists, stats, rows and the home pillars, md (44px) for cards and
// rails, lg (48px) for steps and page heads, xl (56px) for the home page's
// How It Works cards. Brand is the pale tint in royal blue; white the same on a white
// face, for a tinted panel; ink a slate one for neutral rows; success the
// emerald one for something done; danger the red one for a destructive row;
// glass a faint white one for the dark partner portal. Decorative: the text beside it says what it
// is. A directional glyph (an arrow, a plane) passes rtl:-scale-x-100 in
// iconClassName.
const SIZE = {
  sm: 'h-10 w-10 rounded-xl',
  md: 'h-11 w-11 rounded-xl',
  lg: 'h-12 w-12 rounded-xl',
  xl: 'h-14 w-14 rounded-2xl',
} as const

const GLYPH = { sm: 'h-[18px] w-[18px]', md: 'h-5 w-5', lg: 'h-6 w-6', xl: 'h-7 w-7' } as const

const TONE = {
  brand: 'border-sky-200/60 bg-brandTint text-brand',
  white: 'border-sky-200/60 bg-white text-brand',
  ink: 'border-slate-200/70 bg-slate-50 text-ink',
  success: 'border-emerald-200/70 bg-emerald-50 text-emerald-600',
  danger: 'border-red-200/70 bg-red-50 text-red-600',
  glass: 'border-white/10 bg-white/[0.04] text-sky-300',
} as const

export type IconFrameSize = keyof typeof SIZE
export type IconFrameTone = keyof typeof TONE

export default function IconFrame({
  icon: Icon,
  size = 'md',
  tone = 'brand',
  className = '',
  iconClassName = '',
}: {
  icon: LucideIcon
  size?: IconFrameSize
  tone?: IconFrameTone
  className?: string
  iconClassName?: string
}) {
  return (
    <span aria-hidden="true" className={`flex flex-shrink-0 items-center justify-center border ${SIZE[size]} ${TONE[tone]} ${className}`.trim()}>
      <Icon aria-hidden="true" focusable="false" className={`${GLYPH[size]} ${iconClassName}`.trim()} strokeWidth={1.75} />
    </span>
  )
}
