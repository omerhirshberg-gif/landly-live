import { describe, expect, it } from 'vitest'
import { resolveRaayonitComingSoon, resolveRaayonitDisplay } from '@/lib/flags/featureFlags'

describe('Raayonit display gate', () => {
  it('is ON by default on every project, production included', () => {
    expect(resolveRaayonitDisplay({ env: undefined, doc: undefined, projectId: 'landly-be752' })).toBe(true)
    expect(resolveRaayonitDisplay({ env: undefined, doc: undefined, projectId: 'landly-dev' })).toBe(true)
    expect(resolveRaayonitDisplay({ env: undefined, doc: undefined, projectId: undefined })).toBe(true)
  })
  it('the Firestore flag overrides the default in both directions', () => {
    expect(resolveRaayonitDisplay({ env: undefined, doc: true, projectId: 'landly-be752' })).toBe(true)
    expect(resolveRaayonitDisplay({ env: undefined, doc: false, projectId: 'landly-dev' })).toBe(false)
  })
  it('the env var wins over the document', () => {
    expect(resolveRaayonitDisplay({ env: '0', doc: true, projectId: 'landly-dev' })).toBe(false)
    expect(resolveRaayonitDisplay({ env: 'true', doc: false, projectId: 'landly-be752' })).toBe(true)
  })
  it('ignores garbage and keeps the default', () => {
    expect(resolveRaayonitDisplay({ env: 'maybe', doc: 'x', projectId: 'landly-be752' })).toBe(true)
  })
})

describe('Raayonit launch-pending (coming soon) mode', () => {
  it('is OFF by default, so a normal project behaves as before', () => {
    expect(resolveRaayonitComingSoon({ env: undefined, doc: undefined })).toBe(false)
    expect(resolveRaayonitComingSoon({ env: 'maybe', doc: 'x' })).toBe(false)
  })
  it('the Firestore flag turns it on and off, and the env var wins over it', () => {
    expect(resolveRaayonitComingSoon({ env: undefined, doc: true })).toBe(true)
    expect(resolveRaayonitComingSoon({ env: undefined, doc: false })).toBe(false)
    expect(resolveRaayonitComingSoon({ env: '0', doc: true })).toBe(false)
    expect(resolveRaayonitComingSoon({ env: 'true', doc: false })).toBe(true)
  })
})
