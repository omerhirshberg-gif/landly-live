import type { UsageSource } from '@/lib/usage/usageReport'

// One pill per environment: where its counters came from on this
// deployment, and why not when they couldn't be read.

const ENV = {
  prod: { label: 'Production', dot: 'bg-[#DC2626]' },
  dev: { label: 'Development', dot: 'bg-[#F59E0B]' },
} as const

const VIA = { local: 'this deployment', 'peer-reader': 'read-only reader', 'peer-export': 'production export' } as const

const STATUS = {
  ok: { text: 'live', tone: 'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]', icon: 'fa-circle-check' },
  unconfigured: { text: 'not configured', tone: 'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]', icon: 'fa-plug-circle-xmark' },
  unavailable: { text: 'unavailable', tone: 'border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]', icon: 'fa-triangle-exclamation' },
  mismatch: { text: 'project mismatch', tone: 'border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]', icon: 'fa-ban' },
} as const

export default function SourceStatus({ sources }: { sources: UsageSource[] }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Data sources">
      {sources.map((source) => {
        const status = STATUS[source.status]
        return (
          <li
            key={source.env}
            title={source.message}
            className={`inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${status.tone}`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${ENV[source.env].dot}`} aria-hidden="true" />
            <span className="min-w-0 truncate">
              {ENV[source.env].label} <bdi dir="ltr" className="text-[#64748B]">{source.projectId}</bdi> · {status.text}
              {source.status === 'ok' && <span className="text-[#64748B]"> via {VIA[source.via]}</span>}
            </span>
            <i className={`fa-solid ${status.icon} shrink-0`} aria-hidden="true" />
          </li>
        )
      })}
    </ul>
  )
}
