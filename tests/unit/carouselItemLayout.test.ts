import { describe, expect, it } from 'vitest'
import { CAROUSEL_GAP, carouselCardWidth, carouselInitialCount, carouselItemLayout } from '../../landly-mobile/src/lib/carousel'

// The Expo carousel's windowing math (landly-mobile/src/lib/carousel.ts): every
// card's place is known up front, so the list never measures to find the next.

describe('carouselItemLayout', () => {
  const card = carouselCardWidth(390)
  const leading = 16

  it('places each card one card-plus-gap after the last, from the row start padding', () => {
    expect(carouselItemLayout(0, 5, card, CAROUSEL_GAP, leading)).toEqual({ index: 0, offset: leading, length: card + CAROUSEL_GAP })
    expect(carouselItemLayout(3, 5, card, CAROUSEL_GAP, leading)).toEqual({ index: 3, offset: leading + 3 * (card + CAROUSEL_GAP), length: card + CAROUSEL_GAP })
  })

  it('the last cell is its card alone (no separator after it)', () => {
    expect(carouselItemLayout(4, 5, card, CAROUSEL_GAP, leading).length).toBe(card)
  })

  it('offsets are contiguous: each cell starts where the previous ends', () => {
    for (let i = 1; i < 8; i++) {
      const prev = carouselItemLayout(i - 1, 8, card, CAROUSEL_GAP, leading)
      expect(carouselItemLayout(i, 8, card, CAROUSEL_GAP, leading).offset).toBe(prev.offset + prev.length)
    }
  })
})

describe('carouselInitialCount', () => {
  it('mounts the cards in view plus the one peeking in, never more than the rail holds', () => {
    const card = carouselCardWidth(390)
    expect(carouselInitialCount(390, card, 12)).toBe(3)
    expect(carouselInitialCount(390, card, 1)).toBe(1)
    expect(carouselInitialCount(0, card, 12)).toBe(1)
  })
})
