import CategoryIcon from '@/components/ui/CategoryIcon'
import StatusBadge from './StatusBadge'

/** A business or offer category, its line icon first, so it reads at a glance. */
export default function CategoryBadge({ category, className = '' }: { category: string; className?: string }) {
  return (
    <StatusBadge tone="blue" className={`max-w-full ${className}`}>
      <CategoryIcon category={category} className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      <bdi className="truncate" dir="auto">
        {category}
      </bdi>
    </StatusBadge>
  )
}
