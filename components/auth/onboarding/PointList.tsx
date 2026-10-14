import { ONB_ICONS, type OnbIcon } from '@/lib/brand/onboardingIcons'

// Icon + one line, for the welcome card's promises and the notifications
// card's benefits (mobile: auth/onboarding/PointList.tsx).
export default function PointList({ points, className = '' }: { points: { icon: OnbIcon; label: string }[]; className?: string }) {
  return (
    <ul className={`grid gap-2.5 ${className}`}>
      {points.map((point) => (
        <li key={point.icon} className="flex items-center gap-3 text-[15px] leading-5 font-semibold text-slate-700">
          <span aria-hidden="true" className="h-8 w-8 shrink-0 rounded-full bg-brandLight flex items-center justify-center">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#0038b8" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
              <path d={ONB_ICONS[point.icon]} />
            </svg>
          </span>
          {point.label}
        </li>
      ))}
    </ul>
  )
}
