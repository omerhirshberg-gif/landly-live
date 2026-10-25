import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ChatTranscript from '@/components/admin/support/ChatTranscript'
import ReplyComposer, { sendsOnEnter } from '@/components/admin/support/ReplyComposer'
import { groupTranscript, parseInteractive, type TranscriptMessage } from '@/components/admin/support/transcript'

let seq = 0
const at = (minute: number, day = 25) => new Date(Date.UTC(2026, 9, day, 10, minute)).toISOString()
const msg = (over: Partial<TranscriptMessage> & Pick<TranscriptMessage, 'direction' | 'author'>): TranscriptMessage => ({
  id: `m${++seq}`,
  kind: 'text',
  text: 'x',
  at: at(seq),
  ...over,
})
const member = (text: string, over: Partial<TranscriptMessage> = {}) => msg({ direction: 'in', author: 'member', text, ...over })
const tap = (text: string, over: Partial<TranscriptMessage> = {}) => msg({ direction: 'in', author: 'member', kind: 'button', text, ...over })
const bot = (text: string, over: Partial<TranscriptMessage> = {}) => msg({ direction: 'out', author: 'bot', kind: 'interactive', text, ...over })
const team = (text: string, over: Partial<TranscriptMessage> = {}) => msg({ direction: 'out', author: 'admin', text, ...over })

describe('groupTranscript', () => {
  it('folds each run of bot sends and member taps into one item, keeping what people wrote as bubbles', () => {
    const items = groupTranscript([
      member('hi'),
      bot('Menu\n[🛍️ Existing order] [🏷️ New order]'),
      tap('🛍️ Existing order'),
      bot('Sure!\n[🎫 My voucher & QR]'),
      tap('🏪 Issue at the business'),
      bot('Sorry about that!\n[All set, thanks 👍] [Talk to Team 💬] [Main Menu 🔙]'),
      member('The café refused my QR'),
      team('On it — calling them now'),
    ])
    expect(items.map((item) => item.type)).toEqual(['message', 'automation', 'message', 'message'])
    const run = items[1]
    if (run.type !== 'automation') throw new Error('expected a run')
    expect(run.steps).toHaveLength(5)
    expect(run.lastChoice).toBe('🏪 Issue at the business')
    expect(run.failed).toBe(0)
    expect(run.at).toBe(run.steps.at(-1)!.at)
  })

  it('counts failed bot sends, keeps the language pick in the run, and never spans two days', () => {
    const items = groupTranscript([
      bot('Pick a language', { at: at(1, 24) }),
      msg({ direction: 'in', author: 'member', kind: 'language', text: '🇮🇱 עברית', at: at(2, 24) }),
      bot('Menu', { at: at(3, 24), error: 'Meta refused it' }),
      bot('Menu again', { at: at(1, 25) }),
    ])
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ type: 'automation', failed: 1, lastChoice: '🇮🇱 עברית' })
    expect(items[1]).toMatchObject({ type: 'automation', failed: 0, lastChoice: null })
  })

  it('keeps a member photo and the team\'s resolve sign-off as bubbles', () => {
    const items = groupTranscript([member('(image)', { kind: 'media' }), team('Great to hear!\n[🔙 Main Menu]', { kind: 'interactive' })])
    expect(items.map((item) => item.type)).toEqual(['message', 'message'])
  })
})

describe('parseInteractive', () => {
  it('splits buttons, rows and a link card back out of the logged text', () => {
    expect(parseInteractive('Did that help?\n[All set] [Talk to Team 💬]')).toEqual({ body: 'Did that help?', choices: ['All set', 'Talk to Team 💬'], link: null })
    expect(parseInteractive('Tap below.\n[Explore perks] https://landly.test/categories')).toEqual({
      body: 'Tap below.',
      choices: ['Explore perks'],
      link: 'https://landly.test/categories',
    })
  })

  it('leaves what a person typed alone, brackets and all', () => {
    expect(parseInteractive('Line one\nLine two')).toEqual({ body: 'Line one\nLine two', choices: [], link: null })
    expect(parseInteractive('my code is [1234] ok')).toEqual({ body: 'my code is [1234] ok', choices: [], link: null })
  })
})

describe('ChatTranscript', () => {
  const render = (messages: TranscriptMessage[]) => renderToStaticMarkup(createElement(ChatTranscript, { waId: '972501234567', messages, now: Date.parse(at(59)) }))

  it('draws the member in a white card, the team in Landly blue, and the bot as one native <details> summary', () => {
    const html = render([member('hi'), bot('Menu\n[A] [B]'), tap('A'), bot('Answer\n[All set]'), team('Hello from the team')])
    expect(html).toContain('border border-[#E2E8F0] bg-white text-[#0F172A]')
    expect(html).toContain('bg-[#0038B8] text-white')
    expect(html.match(/<details/g)).toHaveLength(1)
    expect(html).toMatch(/<summary[^>]*>[\s\S]*Bot<\/span> · 2 automated messages · Chose: <span[^>]*>A<\/span>/)
    expect(html).toContain('<bdi dir="ltr" class="tabular-nums">')
    // No per-bubble author or debug labels.
    expect(html).not.toContain('>Team<')
    expect(html).not.toContain('>Simulated<')
  })

  it('marks a reply on its way with a clock, and a test environment once at the top', () => {
    const html = render([member('hi'), team('Sending…', { pending: true, simulated: true })])
    expect(html).toContain('aria-label="Sending"')
    expect(html).toContain('fa-clock')
    expect(html.match(/Test environment/g)).toHaveLength(1)
  })
})

describe('ReplyComposer Enter key', () => {
  const key = (over: Partial<Parameters<typeof sendsOnEnter>[0]> = {}) => ({
    key: 'Enter',
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    isComposing: false,
    keyCode: 13,
    ...over,
  })

  it('sends on Enter and adds a line on Shift+Enter with a physical keyboard', () => {
    expect(sendsOnEnter(key(), false)).toBe(true)
    expect(sendsOnEnter(key({ shiftKey: true }), false)).toBe(false)
    expect(sendsOnEnter(key({ key: 'a' }), false)).toBe(false)
  })

  it('never sends while an IME is composing a word', () => {
    expect(sendsOnEnter(key({ isComposing: true }), false)).toBe(false)
    expect(sendsOnEnter(key({ keyCode: 229 }), false)).toBe(false)
  })

  it('adds a line on a touch keyboard\'s Enter, as in WhatsApp\'s mobile app, but ⌘/Ctrl+Enter still sends', () => {
    expect(sendsOnEnter(key(), true)).toBe(false)
    expect(sendsOnEnter(key({ metaKey: true }), true)).toBe(true)
    expect(sendsOnEnter(key({ ctrlKey: true }), true)).toBe(true)
  })

  it('tells desktop users Enter sends and Shift+Enter adds a line', () => {
    const html = renderToStaticMarkup(
      createElement(ReplyComposer, { value: '', onChange: () => {}, onSend: () => {}, sending: false, windowOpen: true, lastInboundAt: null, now: 0 })
    )
    expect(html).toMatch(/<kbd[^>]*>Enter<\/kbd> to send · <kbd[^>]*>Shift<\/kbd> \+ <kbd[^>]*>Enter<\/kbd> for new line/)
    expect(html).toContain('enterKeyHint="send"')
  })
})
