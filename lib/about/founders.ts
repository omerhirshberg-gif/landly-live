import type { TranslationKey } from '@/lib/i18n/translations'

// Landly's co-founders, Omer first, for the About page (components/about/AboutPage.tsx)
// and the Organization structured data (lib/seo/jsonLd.ts). `name` is the
// Latin spelling search engines get; the page shows `nameKey`, which is the
// same name except in Hebrew. Set `photo` to an image URL once there is one;
// until then the card shows the initials. `linkedin` adds a LinkedIn button
// to the card.
export interface Founder {
  id: string
  name: string
  nameKey: TranslationKey
  initials: string
  roleKey: TranslationKey
  bioKey: TranslationKey
  photo: string | null
  linkedin: string | null
}

export const FOUNDERS: readonly Founder[] = [
  { id: 'omer', name: 'Omer Hirshberg', nameKey: 'about_name_omer', initials: 'OH', roleKey: 'about_role_cofounder', bioKey: 'about_bio_omer', photo: '/images/team/omer-hirshberg.jpg', linkedin: 'https://www.linkedin.com/in/omerhirshberg' },
  { id: 'amit', name: 'Amit Bar-David', nameKey: 'about_name_amit', initials: 'AB', roleKey: 'about_role_cofounder_cto', bioKey: 'about_bio_amit', photo: null, linkedin: 'https://www.linkedin.com/in/amit-bar-david-a934a034b' },
]
