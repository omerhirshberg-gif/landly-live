import Link from 'next/link'

// Explicit way back to the home page for the auth screens, which render
// without the site Navbar. Matches the back-pill style used on offer/category
// pages; `dark` is for the business portal's fixed dark theme.
export default function BackToHomeLink({
  label,
  variant = 'light',
}: {
  label: string
  variant?: 'light' | 'dark'
}) {
  const colors =
    variant === 'dark'
      ? 'text-blue-400 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
      : 'text-brand bg-brand/10 border-brand/20 hover:bg-brand/20 hover:border-brand/40'

  return (
    <div className="mb-6">
      <Link
        href="/"
        className={`tap-target inline-flex items-center gap-2 text-sm font-bold border rounded-full px-4 py-2 transition ${colors}`}
      >
        <i className="fa-solid fa-arrow-left text-xs rtl:rotate-180"></i>
        <span>{label}</span>
      </Link>
    </div>
  )
}
