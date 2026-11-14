// The iOS-style red "1" on the Profile entry of the web navigation (navbar
// avatar, mobile menu card) while the member's phone isn't verified. #FF3B30
// with a white 1.5px ring so it reads on any surface; the number is
// decorative, the accessible name comes from the control it sits on.
export default function PhoneBadge({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FF3B30] px-1 text-[11px] font-bold leading-none text-white ring-[1.5px] ring-white ${className}`}
    >
      1
    </span>
  )
}
