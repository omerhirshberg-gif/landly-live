import { formatBadgeCount } from '@/lib/admin/needsReply'

// WhatsApp-style count of chats waiting for the team; nothing at all at zero.
// The number is for sighted users; screen readers get "N need a reply".
// #16A34A rather than WhatsApp's #25D366, which white text can't be read on.
export default function WhatsAppBadge({ count, className = '' }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span
      className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#16A34A] px-1.5 text-[11px] font-bold leading-none tracking-tight text-white shadow-sm tabular-nums ${className}`}
    >
      <span aria-hidden="true">{formatBadgeCount(count)}</span>
      <span className="sr-only">{`${count} need a reply`}</span>
    </span>
  )
}
