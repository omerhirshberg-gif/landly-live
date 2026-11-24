import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { guardProblems, assertBuildEnvironment, resolveProfile, isEasUpdateCommand, UPDATE_PROFILES } = require('../../landly-mobile/config/buildGuard.js')
const pkg = require('../../landly-mobile/package.json')
const easJson = require('../../landly-mobile/eas.json')

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

describe('EAS Update guard', () => {
  const EAS_UPDATE = ['node', '/x/node_modules/eas-cli/bin/run', 'update', '--branch', 'production']

  it('detects the eas update command, not other commands', () => {
    expect(isEasUpdateCommand(EAS_UPDATE)).toBe(true)
    expect(isEasUpdateCommand(['node', '/x/node_modules/eas-cli/bin/run', 'build'])).toBe(false)
    expect(isEasUpdateCommand(['node', '/x/node_modules/expo/bin/cli', 'export'])).toBe(false)
  })

  it('uses the update profile when no build profile is set (update:testflight, update:production)', () => {
    expect(resolveProfile({ updateProfile: 'testflight', argv: EAS_UPDATE })).toEqual({ profile: 'testflight', problems: [] })
    expect(resolveProfile({ updateProfile: 'production', argv: EAS_UPDATE })).toEqual({ profile: 'production', problems: [] })
    expect(resolveProfile({ buildProfile: 'production', argv: [] })).toEqual({ profile: 'production', problems: [] })
  })

  it('fails closed on a missing update profile', () => {
    expect(resolveProfile({ argv: EAS_UPDATE }).problems).toHaveLength(1)
    expect(resolveProfile({ argv: ['node', 'expo', 'start'] })).toEqual({ profile: undefined, problems: [] })
  })

  it('rejects unknown, non-updatable and mismatched update profiles', () => {
    for (const updateProfile of ['staging', 'development', 'preview']) {
      expect(resolveProfile({ updateProfile, argv: EAS_UPDATE }).problems.length).toBeGreaterThan(0)
    }
    expect(resolveProfile({ buildProfile: 'testflight', updateProfile: 'production', argv: [] }).problems.length).toBeGreaterThan(0)
  })

  it('runs the environment guard for the update profile (no DEV values in a production update)', () => {
    expect(guardProblems({ profile: 'production', projectId: 'landly-dev', apiBaseUrl: PROD_API }).length).toBeGreaterThan(0)
    expect(guardProblems({ profile: 'testflight', projectId: 'landly-be752', apiBaseUrl: DEV_API }).length).toBeGreaterThan(0)
  })

  it('pairs each update script with its own profile, branch, channel and EAS environment', () => {
    for (const [profile, { branch, environment }] of Object.entries(UPDATE_PROFILES) as [string, { branch: string; environment: string }][]) {
      const script: string = pkg.scripts[`update:${profile}`]
      expect(script).toContain(`LANDLY_UPDATE_PROFILE=${profile} `)
      expect(script).toContain(`--branch ${branch} `)
      expect(script).toContain(`--environment ${environment} `)
      expect(easJson.build[profile].channel).toBe(branch)
      expect(easJson.build[profile].environment).toBe(environment)
    }
  })
})
