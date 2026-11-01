import { describe, expect, it } from 'vitest'
import { GET } from '@/app/whatsapp/route'
import { WHATSAPP_COMMUNITY_URL } from '@/lib/prelaunch/links'

describe('GET /whatsapp', () => {
  it('sends the visitor to the community invite, uncached and unindexed', async () => {
    const response = GET()
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(WHATSAPP_COMMUNITY_URL)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex')
    expect(await response.text()).toBe('')
  })
  it('takes nothing from the request, so a tracker\'s parameters never reach WhatsApp', () => {
    expect(GET.length).toBe(0)
  })
  it('points at the official invite by default', () => {
    expect(WHATSAPP_COMMUNITY_URL).toBe(process.env.NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL || 'https://chat.whatsapp.com/GC9Ais2kDVYKwRQ9rHVYKM')
  })
})
