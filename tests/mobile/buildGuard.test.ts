import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { guardProblems, assertBuildEnvironment } = require('../../landly-mobile/config/buildGuard.js')

const PROD_API = 'https://www.golandly.com'
const DEV_API = 'https://landly-dev.vercel.app'

describe('EAS build environment guard', () => {
  it('enforces nothing for a local run', () => {
    expect(guardProblems({ profile: undefined, projectId: 'landly-dev', apiBaseUrl: undefined })).toEqual([])
  })

  it('accepts matching environments', () => {
    expect(guardProblems({ profile: 'production', projectId: 'landly-be752', apiBaseUrl: PROD_API })).toEqual([])
    expect(guardProblems({ profile: 'production', projectId: 'landly-be752', apiBaseUrl: 'https://golandly.com/' })).toEqual([])
    expect(guardProblems({ profile: 'preview', projectId: 'landly-dev', apiBaseUrl: DEV_API })).toEqual([])
    expect(guardProblems({ profile: 'testflight', projectId: 'landly-dev', apiBaseUrl: DEV_API })).toEqual([])
    expect(guardProblems({ profile: 'development', projectId: 'landly-dev', apiBaseUrl: undefined })).toEqual([])
  })

  it('rejects a DEV project in production and a PROD project in DEV profiles', () => {
    expect(guardProblems({ profile: 'production', projectId: 'landly-dev', apiBaseUrl: PROD_API })).toHaveLength(1)
    expect(guardProblems({ profile: 'production', projectId: undefined, apiBaseUrl: PROD_API })).toHaveLength(1)
    for (const profile of ['development', 'preview', 'testflight']) {
      expect(guardProblems({ profile, projectId: 'landly-be752', apiBaseUrl: DEV_API }).length).toBeGreaterThan(0)
    }
  })

  it('rejects a wrong API origin', () => {
    expect(guardProblems({ profile: 'production', projectId: 'landly-be752', apiBaseUrl: 'http://localhost:3000' })).toHaveLength(1)
    expect(guardProblems({ profile: 'production', projectId: 'landly-be752', apiBaseUrl: undefined })).toHaveLength(1)
    for (const api of [undefined, '', 'http://localhost:3000', 'https://localhost', 'https://192.168.1.5', PROD_API, 'https://golandly.com', 'http://landly-dev.vercel.app']) {
      expect(guardProblems({ profile: 'testflight', projectId: 'landly-dev', apiBaseUrl: api }).length).toBeGreaterThan(0)
    }
  })

  it('keeps local, LAN and DEV origins allowed in development but rejects the PROD origin', () => {
    for (const api of [undefined, '', 'http://localhost:3000', 'http://192.168.1.5:3000', 'http://10.0.0.2:3000', DEV_API]) {
      expect(guardProblems({ profile: 'development', projectId: 'landly-dev', apiBaseUrl: api })).toEqual([])
    }
    for (const api of [PROD_API, 'https://golandly.com', 'https://golandly.com/', 'HTTPS://WWW.GOLANDLY.COM/api', 'http://www.golandly.com:443', 'https://user@www.golandly.com']) {
      expect(guardProblems({ profile: 'development', projectId: 'landly-dev', apiBaseUrl: api }).length).toBeGreaterThan(0)
    }
    expect(() => assertBuildEnvironment({ profile: 'development', projectId: 'landly-dev', apiBaseUrl: PROD_API })).toThrow(/PROD web app/)
  })

  it('rejects an unknown profile and throws from assertBuildEnvironment', () => {
    expect(guardProblems({ profile: 'staging', projectId: 'landly-dev', apiBaseUrl: DEV_API }).length).toBeGreaterThan(0)
    expect(() => assertBuildEnvironment({ profile: 'production', projectId: 'landly-dev', apiBaseUrl: PROD_API })).toThrow(/landly-be752/)
  })
})

describe('app.config.js', () => {
  const load = (env: Record<string, string>) => {
    const saved = { ...process.env }
    Object.assign(process.env, env)
    try {
      const path = require.resolve('../../landly-mobile/app.config.js')
      delete require.cache[path]
      const app = require('../../landly-mobile/app.json').expo
      return require(path)({ config: app })
    } finally {
      for (const k of Object.keys(env)) delete process.env[k]
      Object.assign(process.env, saved)
    }
  }
  const prod = { EAS_BUILD_PROFILE: 'production', EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'landly-be752', EXPO_PUBLIC_API_BASE_URL: PROD_API }

  it('strips the dev-server network string from store builds and keeps it for development', () => {
    expect(load(prod).ios.infoPlist.NSLocalNetworkUsageDescription).toBeUndefined()
    const dev = load({ EAS_BUILD_PROFILE: 'development', EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'landly-dev' })
    expect(dev.ios.infoPlist.NSLocalNetworkUsageDescription).toBeTruthy()
  })

  it('fails a development config pointing at the PROD API', () => {
    expect(() => load({ EAS_BUILD_PROFILE: 'development', EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'landly-dev', EXPO_PUBLIC_API_BASE_URL: PROD_API })).toThrow(/PROD web app/)
  })

  it('fails a production config carrying the DEV project', () => {
    expect(() => load({ ...prod, EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'landly-dev' })).toThrow(/landly-be752/)
  })
})
