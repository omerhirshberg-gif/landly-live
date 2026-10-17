import { redirect } from 'next/navigation'
import { categoryHref, parseCategoryFilter } from '@/lib/perks/perksFilter'

// A category is now a chip on /categories (?cat=…), filtered and sorted
// there. This route only keeps old links, bookmarks and shares working;
// /categories/new and /categories/bestsellers are their own static routes
// and never reach it. Temporary (307), so the old shape stays free to reuse.
export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: raw } = await params
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    // Malformed escape: falls through to the plain catalog.
  }
  const category = parseCategoryFilter(decoded)
  redirect(category === 'all' ? '/categories' : categoryHref(category))
}
