import { Deal } from '@/lib/data/deals'

export default function DealCard({ deal }: { deal: Deal }) {
  return (
    <div className="deal-card">
      <img src={deal.img} alt={deal.alt} />
      <div className="card-body">
        <span className="deal-badge">{deal.badge}</span>
        <div className="deal-name">{deal.name}</div>
        <div className="deal-loc">{deal.loc}</div>
      </div>
    </div>
  )
}
