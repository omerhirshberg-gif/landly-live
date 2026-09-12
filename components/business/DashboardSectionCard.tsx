import Card from '@/components/admin/Card'

interface DashboardSectionCardProps {
  title: string
  meta?: React.ReactNode
  children: React.ReactNode
  className?: string
}

// Shared chrome for every Business Dashboard section below the stat tiles --
// same Card, same header size/weight/spacing -- so sections can't drift into
// different widths or header styles from each other the way Live Offers,
// Redemption Trend, Top Offer and Recent Activity previously had.
export default function DashboardSectionCard({ title, meta, children, className = '' }: DashboardSectionCardProps) {
  return (
    <Card className={`p-5 ${className}`}>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-black text-white uppercase tracking-wide">{title}</h2>
        {meta}
      </div>
      {children}
    </Card>
  )
}
