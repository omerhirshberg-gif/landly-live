import { CATEGORY_TILES } from '@/lib/categories'
import StatusBadge from './StatusBadge'

/** The category's emoji (the member app's tile glyph), or '' for one outside the list. */
export function categoryEmoji(category: string): string {
  return CATEGORY_TILES.find((tile) => tile.category === category)?.emoji ?? ''
}

/** A business or offer category, its emoji first, so it reads at a glance. */
export default function CategoryBadge({ category, className = '' }: { category: string; className?: string }) {
  const emoji = categoryEmoji(category)
  return (
    <StatusBadge tone="blue" className={`max-w-full ${className}`}>
      {emoji && (
        <span aria-hidden="true" className="text-[13px] leading-none">
          {emoji}
        </span>
      )}
      <bdi className="truncate" dir="auto">
        {category}
      </bdi>
    </StatusBadge>
  )
}
