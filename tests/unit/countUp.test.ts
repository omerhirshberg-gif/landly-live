import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CountUp, { countUpFrame } from '@/components/ui/CountUp'

describe('count-up easing', () => {
  it('starts at 0, eases out, and lands exactly on the value', () => {
    expect(countUpFrame(48, 0)).toBe(0)
    expect(countUpFrame(48, 1)).toBe(48)
    expect(countUpFrame(48, 1.4)).toBe(48)
    expect(countUpFrame(48, -1)).toBe(0)
    // Ease-out: more than half way at the half-way mark.
    expect(countUpFrame(100, 0.5)).toBeGreaterThan(50)
  })

  it('only ever shows whole numbers that never go down', () => {
    let last = -1
    for (let p = 0; p <= 1; p += 0.05) {
      const n = countUpFrame(12, p)
      expect(Number.isInteger(n)).toBe(true)
      expect(n).toBeGreaterThanOrEqual(last)
      last = n
    }
  })
})

describe('count-up markup', () => {
  it('renders the real number on the server, with its width held and one copy for screen readers', () => {
    const html = renderToStaticMarkup(createElement(CountUp, { value: 48, className: 'text-brand' }))
    expect(html).toBe(
      '<span class="inline-grid tabular-nums text-brand">' +
        '<span aria-hidden="true" class="invisible col-start-1 row-start-1">48</span>' +
        '<span aria-hidden="true" class="col-start-1 row-start-1">48</span>' +
        '<span class="sr-only">48</span></span>',
    )
  })

  it('formats with the given formatter', () => {
    const html = renderToStaticMarkup(createElement(CountUp, { value: 5, format: (n: number) => `${n}+` }))
    expect(html.match(/>5\+</g)).toHaveLength(3)
  })
})
