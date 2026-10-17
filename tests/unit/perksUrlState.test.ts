import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({
  usePathname: () => '/categories',
  useSearchParams: () => new URLSearchParams('cat=Restaurants+and+Cafes'),
}))

const { usePerksUrlState } = await import('@/components/perks/usePerksUrlState')

// Grab the hook's setters from one server render.
function captureHook() {
  let state!: ReturnType<typeof usePerksUrlState>
  function Probe() {
    state = usePerksUrlState()
    return null
  }
  renderToStaticMarkup(createElement(Probe))
  return state
}

function stubWindow(search: string) {
  const replaceState = vi.fn()
  // Next's own entries carry `__NA`; passing one back makes its patched
  // replaceState skip the useSearchParams sync.
  vi.stubGlobal('window', { location: { search }, history: { state: { __NA: true }, replaceState } })
  return replaceState
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('usePerksUrlState', () => {
  it('reads the selected category from the URL', () => {
    expect(captureHook().category).toBe('Restaurants and Cafes')
  })

  it('writes with a null state so Next syncs useSearchParams (chip selection never freezes)', () => {
    const { setCategory } = captureHook()
    const replaceState = stubWindow('?cat=Restaurants+and+Cafes')
    setCategory('Beach and Sea')
    expect(replaceState).toHaveBeenCalledTimes(1)
    const [data, , url] = replaceState.mock.calls[0]
    expect(data).toBeNull()
    expect(url).toBe('/categories?cat=Beach+and+Sea')
  })

  it('drops the param when going back to All', () => {
    const { setCategory } = captureHook()
    const replaceState = stubWindow('?cat=Beach+and+Sea&sort=savings')
    setCategory('all')
    expect(replaceState.mock.calls[0][2]).toBe('/categories?sort=savings')
  })
})
