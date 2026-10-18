import Link from 'next/link'

interface CardProps {
  href?: string
  /** Apply the hover-lift treatment even when the card itself isn't a link (e.g. a card containing its own button/link). */
  hover?: boolean
  className?: string
  children: React.ReactNode
}

export default function Card({ href, hover, className = '', children }: CardProps) {
  const classes = `rounded-2xl border border-slate-200/80 bg-white shadow-sm ${
    href || hover
      ? 'transition-[box-shadow,border-color] duration-150 hover:border-[#CBD5E1] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0038B8]'
      : ''
  } ${className}`

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    )
  }
  return <div className={classes}>{children}</div>
}

/** Placeholder cards while a list loads. */
export function CardSkeletons({ count = 3, className = 'h-32' }: { count?: number; className?: string }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ${className}`}
        >
          <div className="h-4 w-2/3 rounded-md bg-[#F1F5F9] motion-safe:animate-pulse" />
          <div className="mt-3 h-3 w-1/3 rounded-md bg-[#F1F5F9] motion-safe:animate-pulse" />
        </div>
      ))}
    </>
  )
}
