import { describe, expect, it } from 'vitest'
import { validateNewsletterContent } from '@/lib/email/newsletterEmail'
import { en } from '@/lib/admin/translations/en'
import { he } from '@/lib/admin/translations/he'
import { NEWSLETTER_LANGS } from '@/lib/newsletter/unsubscribeCopy'
import { TEMPLATE_IDS, templateContent, templateLang } from '@/lib/newsletter/templates'

const READY = TEMPLATE_IDS.filter((id) => id !== 'blank')

describe('newsletter templates', () => {
  it.each(READY.flatMap((id) => NEWSLETTER_LANGS.map((lang) => [id, lang] as const)))('%s in %s is a complete, sendable campaign', (id, lang) => {
    const t = templateContent(id, lang)
    const checked = validateNewsletterContent(t)
    expect(checked.ok, JSON.stringify(checked)).toBe(true)
    expect(t.body).toContain('{firstName}')
    expect(t.ctaUrl.startsWith('https://golandly.com')).toBe(true)
    // No decorative emoji in any template.
    expect(`${t.subject}${t.headline}${t.body}${t.ctaLabel}`).not.toMatch(/\p{Extended_Pictographic}/u)
  })

  it('points each button where the brief says', () => {
    expect(templateContent('perks', 'en').ctaUrl).toBe('https://golandly.com/categories')
    expect(templateContent('community', 'he').ctaUrl).toBe('https://golandly.com')
    expect(templateContent('welcome', 'fr').body).toMatch(/Apple Wallet/)
  })

  it('has a blank template that clears every field', () => {
    for (const lang of NEWSLETTER_LANGS) expect(templateContent('blank', lang)).toEqual({ subject: '', headline: '', body: '', ctaLabel: '', ctaUrl: '' })
  })

  it('is written in the audience language, else the admin’s own', () => {
    expect(templateLang('ru', 'en')).toBe('ru')
    expect(templateLang('all', 'he')).toBe('he')
    expect(templateContent('perks', templateLang('all', 'he')).subject).toMatch(/[א-ת]/)
  })

  it('every template card has an English and a Hebrew title and description', () => {
    for (const id of TEMPLATE_IDS) {
      for (const key of [`newsletter.template.${id}`, `newsletter.template.${id}.desc`] as const) {
        expect(en[key as keyof typeof en], key).toBeTruthy()
        expect(he[key as keyof typeof he], key).toBeTruthy()
      }
    }
  })

  it('uses the plain-language Hebrew form labels', () => {
    expect(he['newsletter.subject']).toBe('נושא המייל (מה שהנמען רואה בתיבת הדואר)')
    expect(he['newsletter.headline']).toBe('כותרת ראשית בתוך המייל')
    expect(he['newsletter.body']).toBe('תוכן ההודעה (ניתן לשלב {firstName} לשם פרטי)')
    expect(he['newsletter.ctaLabel']).toBe('טקסט לכפתור במייל (אופציונלי)')
    expect(he['newsletter.ctaUrl']).toBe('קישור שהכפתור פותח (אופציונלי)')
  })
})
