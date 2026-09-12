import Card from './Card'

const ACCENT_CLASSES = {
  blue: 'bg-brand/10 border-brand/30 text-brand',
  amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  violet: 'bg-violet-500/10 border-violet-500/30 text-violet-400',
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
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <div
          className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${ACCENT_CLASSES[accent]}`}
        >
          <i className={`fa-solid ${icon}`} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-black text-white leading-none">{value ?? '…'}</div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-1">{label}</div>
        </div>
      </div>
      {value === 0 && emptyHint && <div className="text-xs text-slate-500 mt-3">{emptyHint}</div>}
    </Card>
  )
}
