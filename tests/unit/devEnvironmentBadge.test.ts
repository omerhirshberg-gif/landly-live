import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import DevEnvironmentBadge from '@/components/layout/DevEnvironmentBadge'

const render = () => renderToStaticMarkup(createElement(DevEnvironmentBadge))

afterEach(() => vi.unstubAllEnvs())

describe('web dev environment badge', () => {
  it('names the Firebase project during next dev, without catching clicks or screen readers', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'landly-dev')
    const html = render()
    expect(html.replace(/<!-- -->/g, '')).toContain('DEV · landly-dev')
    expect(html).toContain('pointer-events-none')
    expect(html).toContain('aria-hidden="true"')
  })

  it.each(['production', 'test'])('renders nothing in %s', (env) => {
    vi.stubEnv('NODE_ENV', env)
    expect(render()).toBe('')
  })
})
