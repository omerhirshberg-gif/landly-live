import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PrivacyPolicy from '@/components/legal/PrivacyPolicy'

// Google's OAuth review rejected the brand for "insufficient content" on
// /privacy; these are the disclosures it (and the stores) look for.
const html = renderToStaticMarkup(createElement(PrivacyPolicy))
const text = html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ')

describe('privacy policy', () => {
  it('identifies the company, contact and date', () => {
    expect(text).toContain('operated by Landly , Tel Aviv-Yafo')
    expect(text).not.toContain('Ltd')
    expect(text).toContain('Tel Aviv-Yafo, Israel')
    expect(html).toContain('href="mailto:team.landly@gmail.com"')
    expect(html).toMatch(/<time dateTime="\d{4}-\d{2}-\d{2}">/)
  })

  it('discloses Google user data, Limited Use and the no-sale rule', () => {
    expect(text).toMatch(/your name;.*your email address.*your profile picture/)
    expect(text).toContain(
      "Landly's use and transfer of information received from Google APIs to any other app will adhere to the Google API Services User Data Policy , including the Limited Use requirements."
    )
    expect(html).toContain('href="https://developers.google.com/terms/api-services-user-data-policy"')
    expect(text).toMatch(/never sell, rent or trade Google user data/)
    expect(text).toMatch(/data brokers/)
  })

  it('covers the data the app stores', () => {
    for (const phrase of ['Student', 'New Immigrant (Oleh Chadash)', 'Taglit', 'Traveler', 'WhatsApp', 'salted, one-way hash', 'QR code', 'Tranzila']) {
      expect(text).toContain(phrase)
    }
  })

  it('explains deletion, retention, rights and the minimum age', () => {
    expect(text).toContain('Delete my account')
    expect(text).toContain('within 30 days')
    expect(text).toContain('up to 7 years')
    expect(text).toContain('16 and over')
    expect(text).toMatch(/Protection of Privacy Law/)
    expect(text).toMatch(/GDPR/)
  })

  it('has a table of contents whose links all resolve to a section', () => {
    const anchors = [...html.matchAll(/<nav[^>]*>[\s\S]*?<\/nav>/g)][0][0].match(/href="#([^"]+)"/g)!.map((h) => h.slice(7, -1))
    expect(anchors.length).toBeGreaterThanOrEqual(15)
    for (const id of anchors) expect(html).toContain(`<section id="${id}"`)
    expect(html.match(/<h1[ >]/g)).toHaveLength(1)
  })
})
