import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AdminEnvironmentBadge, { adminEnvironment } from '@/components/admin/AdminEnvironmentBadge'

const render = () => renderToStaticMarkup(createElement(AdminEnvironmentBadge)).replace(/<!-- -->/g, '')

afterEach(() => vi.unstubAllEnvs())

describe('adminEnvironment', () => {
  it('names production and development by their projects', () => {
    expect(adminEnvironment('landly-be752')).toEqual({ tone: 'prod', label: 'PROD', projectId: 'landly-be752' })
    expect(adminEnvironment('landly-dev')).toEqual({ tone: 'dev', label: 'DEV', projectId: 'landly-dev' })
  })

  it('never calls an unknown or missing project DEV or PROD', () => {
    expect(adminEnvironment('someone-else').tone).toBe('other')
    expect(adminEnvironment(undefined)).toEqual({ tone: 'other', label: '?', projectId: 'no project' })
  })
})

describe('admin environment badge', () => {
  it('shows PROD (landly-be752) in production builds too', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'landly-be752')
    const html = render()
    expect(html).toContain('PROD')
    expect(html).toContain('(landly-be752)')
    expect(html).toContain('title="Firebase project: landly-be752"')
  })

  it('shows DEV (landly-dev), with the project id hidden on phones', () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'landly-dev')
    const html = render()
    expect(html).toContain('DEV')
    expect(html).toMatch(/class="hidden [^"]*sm:inline">\(landly-dev\)/)
  })
})
