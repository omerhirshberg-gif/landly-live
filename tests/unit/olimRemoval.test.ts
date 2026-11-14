import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CUSTOMER_TYPES } from '@/lib/customerTypes'
import { TERMS_SECTIONS } from '@/lib/legal/termsSections'
import { translations, type Lang } from '@/lib/i18n/translations'

// "Making Aliyah?" (/olim) and the mentor pipeline are gone: the page, its
// components, the API and every link, route entry and policy sentence. The
// new_oleh / veteran_oleh member types stay.

const ROOT = path.resolve(__dirname, '../..')
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8')
const langs = Object.keys(translations) as Lang[]

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.next', 'dist', 'ios', 'android'].includes(name)) continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

describe('the route and pipeline are deleted', () => {
  it.each(['app/olim', 'components/olim', 'app/api/mentor', 'lib/email/sendMentorRequest.ts'])('%s no longer exists', (file) => {
    expect(existsSync(path.join(ROOT, file))).toBe(false)
  })

  it('has no mentor rate limiters left', () => {
    expect(read('lib/auth/contactFormRateLimit.ts')).not.toMatch(/mentor/i)
  })
})

describe('nothing links to /olim', () => {
  it.each(['components/layout/Navbar.tsx', 'components/layout/MobileMenu.tsx', 'components/layout/Footer.tsx', 'app/sitemap.ts', 'app/robots.ts', 'lib/seo/site.ts', 'lib/seo/jsonLd.ts', 'components/home/HowItWorks.tsx', 'components/home/ValueProps.tsx', 'lib/home/showcase.ts'])(
    '%s has no /olim or mentor reference',
    (file) => {
      expect(read(file)).not.toMatch(/\/olim|mentor|nav_olim/i)
    }
  )

  it('leaves no source file pointing at the removed route, components or keys', () => {
    const offenders = ['app', 'components', 'lib', 'landly-mobile/src']
      .flatMap((dir) => walk(path.join(ROOT, dir)))
      .filter((file) => /['"`(]\/olim|components\/olim|api\/mentor|nav_olim|olim_[a-z]+_|sendMentorRequest|MentorRequest/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(ROOT, file))
    expect(offenders).toEqual([])
  })
})

describe('the legal documents and copy', () => {
  const json = (value: unknown) => JSON.stringify(value)

  it.each(langs)('the Privacy Policy and Terms never mention a mentor (%s)', (lang) => {
    const legal = Object.entries(translations[lang]).filter(([key]) => /^(pp_|terms_)/.test(key)).map(([, value]) => value)
    expect(legal.length).toBeGreaterThan(50)
    expect(legal.join('\n')).not.toMatch(/mentor|ментор|наставник|מנטור|Making Aliyah/i)
  })

  it('keeps the policy and terms structure free of mentor keys', () => {
    expect(json(TERMS_SECTIONS)).not.toMatch(/mentor/i)
    expect(read('lib/legal/privacyPolicyContent.ts')).not.toMatch(/mentor/i)
  })

  it.each(langs)('has no obsolete olim, mentor, step4 or Community-pillar keys (%s)', (lang) => {
    const keys = Object.keys(translations[lang])
    expect(keys.filter((k) => /^(nav_olim|olim_|mentor_|step4_|vp_community_|pp_collect_mentor)/.test(k) || k === 'how_sub')).toEqual([])
  })

  it('keeps the Oleh member types, the support Aliyah topic and the Olim audience card', () => {
    expect(CUSTOMER_TYPES.map((c) => c.value)).toEqual(expect.arrayContaining(['new_oleh', 'veteran_oleh']))
    for (const lang of langs) {
      expect(translations[lang].signup_customerType_newOleh).toBeTruthy()
      expect(translations[lang].signup_customerType_veteranOleh).toBeTruthy()
      expect(translations[lang].subj_aliyah).toBeTruthy()
      expect(translations[lang].landing_aud_olim).toBeTruthy()
    }
  })
})
