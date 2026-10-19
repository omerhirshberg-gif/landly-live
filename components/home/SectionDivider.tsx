// A hairline between the guest home's sections: fades in from both ends, so
// it reads the same in English and Hebrew, inside the page column. Brand blue
// at low opacity, so it stays visible over the backdrop's light sky tones
// (.home-ambient) without leaving the palette. Purely decorative. Two in a row
// (a section between them that rendered nothing) collapse to one, in
// globals.css.
export default function SectionDivider() {
  return (
    <div aria-hidden="true" className="section-divider max-w-6xl mx-auto px-4 sm:px-6">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-brand/25 to-transparent" />
    </div>
  )
}
