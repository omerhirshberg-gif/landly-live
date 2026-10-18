import Card from './Card'

const ACCENT_CLASSES = {
  blue: 'bg-[#F0F7FF] text-[#0038B8]',
  amber: 'bg-[#FFFBEB] text-amber-700',
  emerald: 'bg-[#ECFDF5] text-emerald-700',
  violet: 'bg-violet-50 text-violet-700',
} as const

interface StatCardProps {
  label: string
  value: number | null
  icon: string
  accent?: keyof typeof ACCENT_CLASSES
  emptyHint?: string
}

export default function StatCard({ label, value, icon, accent = 'blue', emptyHint }: StatCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-[#475569]">{label}</div>
          {value === null ? (
            <div aria-label="Loading" className="mt-3 h-9 w-16 rounded-lg bg-[#F1F5F9] motion-safe:animate-pulse" />
          ) : (
            <div className="mt-2 text-4xl font-extrabold tracking-tight text-[#0B1B3D] tabular-nums">{value}</div>
          )}
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg ${ACCENT_CLASSES[accent]}`}>
          <i className={`fa-solid ${icon}`} aria-hidden="true" />
        </div>
      </div>
      {value === 0 && emptyHint && <div className="mt-3 text-xs text-[#94A3B8]">{emptyHint}</div>}
    </Card>
  )
}
