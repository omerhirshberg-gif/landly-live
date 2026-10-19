// The hairline between a page's sections, the same on every page (the guest
// home set the pattern): it fades in from both ends, so it reads the same in
// English and Hebrew, inside the page column. Brand blue at low opacity, so
// it stays visible on the canvas's blue-washed top without leaving the
// palette; never a solid border. Purely decorative. Pages whose sections pad
// themselves (the home, /about) use it bare; elsewhere `className` gives it
// its spacing (e.g. "my-8 sm:my-10"). Two in a row (a section between them
// that rendered nothing) collapse to one, in globals.css.
export default function SectionDivider({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`section-divider max-w-6xl mx-auto px-4 sm:px-6${className ? ` ${className}` : ''}`}>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-brand/25 to-transparent" />
    </div>
  )
}
