// The perforation across a pass (the app: TicketTear.tsx): a dashed hairline
// between two semicircular bites out of the card's side edges. The bites are
// discs in the page's own colour laid over the edge, so no mask is needed; they
// sit on the start and end edges, so Hebrew mirrors them. The card must not
// clip (overflow-visible), and `--canvas` is the page colour behind it.
export default function TicketTear() {
  return (
    <div aria-hidden="true" className="relative h-[18px]">
      <span className="absolute inset-x-[17px] top-1/2 border-t border-dashed border-slate-200" />
      <span className="absolute -start-[9px] top-0 h-[18px] w-[18px] rounded-full bg-[var(--canvas)]" />
      <span className="absolute -end-[9px] top-0 h-[18px] w-[18px] rounded-full bg-[var(--canvas)]" />
    </div>
  )
}
