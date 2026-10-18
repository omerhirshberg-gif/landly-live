// A hairline between the guest home's sections: fades in from both ends, so
// it reads the same in English and Hebrew, inside the page column. sky-400 at
// low opacity rather than sky-200, which is the backdrop's own colour mid-page
// (.home-ambient) and would vanish there. Purely decorative. Two in a row
// (a section between them that rendered nothing) collapse to one, in
// globals.css.
export default function SectionDivider() {
  return (
    <div aria-hidden="true" className="section-divider max-w-6xl mx-auto px-4 sm:px-6">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />
    </div>
  )
}
