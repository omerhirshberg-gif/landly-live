import { describe, expect, it } from 'vitest'
import { snapIndex } from '@/lib/useSnapIndex'

// The What's Inside row on a 375px phone: 200px cards, 12px gaps, 20px of
// padding at each end, so 876px of content scrolls 501px.
const CARD = 200
const STEP = CARD + 12
const PAD = 20
const VIEW = 375
const SCROLL_WIDTH = PAD * 2 + CARD * 4 + 12 * 3
const MAX = SCROLL_WIDTH - VIEW

// Each card's centre on the viewport axis once the row has scrolled `scrolled` px from its start edge.
const ltrCentres = (scrolled: number) => [0, 1, 2, 3].map((i) => PAD + CARD / 2 + i * STEP - scrolled)
// In Hebrew the first card sits at the right edge and the row scrolls leftwards: scrollLeft runs 0 → -501.
const rtlCentres = (scrollLeft: number) => [0, 1, 2, 3].map((i) => VIEW - PAD - CARD / 2 - i * STEP - scrollLeft)

const at = (centres: number[], scrollLeft: number) =>
  snapIndex({ scrolled: Math.abs(scrollLeft), clientWidth: VIEW, scrollWidth: SCROLL_WIDTH, viewCentre: VIEW / 2, itemCentres: centres })

describe('snapIndex in Hebrew (negative scrollLeft)', () => {
  // Where a swipe settles each card on the row's centre (snap-center).
  const centred = [1, 2].map((i) => PAD + CARD / 2 + i * STEP - VIEW / 2)

  it('lights the dot of the card centred in the row as the row scrolls right to left', () => {
    expect(at(rtlCentres(0), 0)).toBe(0)
    for (const [i, offset] of centred.entries()) expect(at(rtlCentres(-offset), -offset)).toBe(i + 1)
    expect(at(rtlCentres(-MAX), -MAX)).toBe(3)
  })

  it('agrees with the left-to-right row at every resting place', () => {
    for (const offset of [0, ...centred, MAX]) expect(at(rtlCentres(-offset), -offset)).toBe(at(ltrCentres(offset), offset))
  })

  it('follows the nearer card mid-swipe, not the sign of the offset', () => {
    // A third of the way from card 1 to card 2: still card 1; two thirds: card 2.
    const third = centred[0] + STEP / 3
    const twoThirds = centred[0] + (2 * STEP) / 3
    expect(at(rtlCentres(-third), -third)).toBe(1)
    expect(at(rtlCentres(-twoThirds), -twoThirds)).toBe(2)
  })
})
