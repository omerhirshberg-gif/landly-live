import Link from 'next/link'

interface CardProps {
  href?: string
  /** Apply the hover-lift/border-brighten treatment even when the card itself isn't a link (e.g. a card containing its own button/link). */
  hover?: boolean
  className?: string
  children: React.ReactNode
}

export default function Card({ href, hover, className = '', children }: CardProps) {
  const classes = `rounded-2xl border border-white/10 bg-slate-900 shadow-sm ${
    href || hover ? 'transition-all duration-150 hover:border-white/20 hover:shadow-lg hover:-translate-y-0.5' : ''
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
