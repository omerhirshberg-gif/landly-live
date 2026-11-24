import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { guardProblems, assertBuildEnvironment, resolveProfile, isEasUpdateCommand, UPDATE_PROFILES } = require('../../landly-mobile/config/buildGuard.js')
const pkg = require('../../landly-mobile/package.json')
const easJson = require('../../landly-mobile/eas.json')
const appJson = require('../../landly-mobile/app.json')
const { applyLocalNetworkText, keepsLocalNetworkText, DESCRIPTION } = require('../../landly-mobile/plugins/withDevLocalNetwork.js')

const PROD_API = 'https://www.golandly.com'
const DEV_API = 'https://landly-dev.vercel.app'

describe('Google client ID guard', () => {
  const base = { profile: 'testflight', projectId: 'landly-dev', apiBaseUrl: DEV_API, messagingSenderId: '840081012057' }
  const ios = '840081012057-15s0b8b1ocv1uuv1n9t78k29tdk0b3l6.apps.googleusercontent.com'
  const web = '840081012057-g74k9lcrema2t6nescpgoooq2kfou6i9.apps.googleusercontent.com'

  it('accepts IDs from the profile project', () => {
    expect(guardProblems({ ...base, googleClientIds: { ios, web } })).toEqual([])
    expect(guardProblems({ ...base, googleClientIds: { ios: undefined, web: undefined } })).toEqual([])
  })
  it('rejects a quoted, malformed or foreign-project ID, and identical iOS and web IDs', () => {
    expect(guardProblems({ ...base, googleClientIds: { ios: `"${ios}"`, web } })).toHaveLength(1)
    expect(guardProblems({ ...base, googleClientIds: { ios: 'not-an-id', web } })).toHaveLength(1)
    expect(guardProblems({ ...base, googleClientIds: { ios: ios.replace('840081012057', '431260649496'), web } })).toHaveLength(1)
    expect(guardProblems({ ...base, googleClientIds: { ios: web, web } })).toHaveLength(1)
  })
})

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

  it('leaves the dev-server network string to the withDevLocalNetwork plugin, so the resolved config never depends on the profile', () => {
    expect(load(prod).ios.infoPlist.NSLocalNetworkUsageDescription).toBeUndefined()
    const dev = load({ EAS_BUILD_PROFILE: 'development', EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'landly-dev' })
    expect(dev.ios.infoPlist.NSLocalNetworkUsageDescription).toBeUndefined()
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

// Regression: the EAS builds of 2026-11-24 failed in "Configure expo-updates" ("Runtime version calculated on local machine
// not equal to runtime version calculated during build"). The EAS CLI computes the runtime version on the developer's
// machine (no EAS_BUILD_PROFILE) and the builder computes it again with the profile set, so the resolved app config
// must be identical in both places, and the runtime version must not depend on the filesystem (`appVersion` policy:
// the same `version` string everywhere, where `fingerprint` hashed node_modules and diverged).
describe('runtime version and config stay identical between the local machine and the EAS builder', () => {
  const FIREBASE = {
    dev: { PROJECT_ID: 'landly-dev', API_KEY: 'k', AUTH_DOMAIN: 'landly-dev.firebaseapp.com', STORAGE_BUCKET: 'b', MESSAGING_SENDER_ID: '1', APP_ID: 'a' },
    prod: { PROJECT_ID: 'landly-be752', API_KEY: 'k', AUTH_DOMAIN: 'landly-be752.firebaseapp.com', STORAGE_BUCKET: 'b', MESSAGING_SENDER_ID: '1', APP_ID: 'a' },
  }
  const MANAGED = ['EAS_BUILD_PROFILE', 'LANDLY_UPDATE_PROFILE', 'EAS_PROJECT_ID', 'EAS_OWNER', 'EXPO_PUBLIC_API_BASE_URL', 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', ...Object.keys(FIREBASE.dev).map((k) => `EXPO_PUBLIC_FIREBASE_${k}`)]

  /** Evaluates app.config.js with exactly this environment (a fresh module each time). */
  function resolveConfig(env: Record<string, string | undefined>) {
    const saved = Object.fromEntries(MANAGED.map((k) => [k, process.env[k]]))
    for (const k of MANAGED) delete process.env[k]
    for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v
    const file = require.resolve('../../landly-mobile/app.config.js')
    delete require.cache[file]
    try {
      return require(file)({ config: structuredClone(appJson.expo) })
    } finally {
      delete require.cache[file]
      for (const k of MANAGED) delete process.env[k]
      for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v
    }
  }
  const projectEnv = (fb: Record<string, string>, api: string) => ({
    EAS_PROJECT_ID: '4bc2ad80-c0e8-4694-92d9-4dff1b57e93e',
    EXPO_PUBLIC_API_BASE_URL: api,
    ...Object.fromEntries(Object.entries(fb).map(([k, v]) => [`EXPO_PUBLIC_FIREBASE_${k}`, v])),
  })

  it.each([
    ['testflight', FIREBASE.dev, DEV_API],
    ['preview', FIREBASE.dev, DEV_API],
    ['development', FIREBASE.dev, DEV_API],
    ['production', FIREBASE.prod, PROD_API],
  ])('resolves %s to the same config on the developer machine and on the builder', (profile, fb, api) => {
    const env = projectEnv(fb, api)
    const local = resolveConfig(env)
    const builder = resolveConfig({ ...env, EAS_BUILD_PROFILE: profile })
    expect(builder).toEqual(local)
    expect(builder.ios.infoPlist.NSLocalNetworkUsageDescription).toBeUndefined()
  })

  it('resolves the update profile to the same config as the build profile', () => {
    expect(resolveConfig({ ...projectEnv(FIREBASE.dev, DEV_API), LANDLY_UPDATE_PROFILE: 'testflight' })).toEqual(resolveConfig({ ...projectEnv(FIREBASE.dev, DEV_API), EAS_BUILD_PROFILE: 'testflight' }))
    expect(resolveConfig({ ...projectEnv(FIREBASE.prod, PROD_API), LANDLY_UPDATE_PROFILE: 'production' })).toEqual(resolveConfig({ ...projectEnv(FIREBASE.prod, PROD_API), EAS_BUILD_PROFILE: 'production' }))
  })

  it('uses the appVersion runtime policy, the same for every profile, with isolation by channel and branch', () => {
    expect(appJson.expo.runtimeVersion).toEqual({ policy: 'appVersion' })
    expect(appJson.expo.version).toMatch(/^\d+\.\d+\.\d+$/)
    for (const [profile, fb, api] of [['testflight', FIREBASE.dev, DEV_API], ['production', FIREBASE.prod, PROD_API]] as const) {
      const config = resolveConfig({ ...projectEnv(fb, api), EAS_BUILD_PROFILE: profile })
      expect(config.runtimeVersion).toEqual({ policy: 'appVersion' })
      expect(config.version).toBe(appJson.expo.version)
      expect(config.extra.firebase.projectId).toBe(fb.PROJECT_ID)
    }
    expect(easJson.build.testflight.channel).toBe('testflight')
    expect(easJson.build.production.channel).toBe('production')
  })

  it('keeps updates disabled with no EAS project id, and enabled with one', () => {
    expect(resolveConfig({ ...projectEnv(FIREBASE.dev, DEV_API), EAS_PROJECT_ID: undefined }).updates).toEqual({ enabled: false })
    const enabled = resolveConfig(projectEnv(FIREBASE.dev, DEV_API)).updates
    expect(enabled).toEqual(expect.objectContaining({ enabled: true, checkAutomatically: 'ON_LOAD', fallbackToCacheTimeout: 0, url: expect.stringMatching(/^https:\/\/u\.expo\.dev\//) }))
  })

  it('keeps the dev-only local-network text out of app.json and applies it only to local and development runs', () => {
    expect(appJson.expo.ios.infoPlist.NSLocalNetworkUsageDescription).toBeUndefined()
    expect(appJson.expo.plugins).toContain('./plugins/withDevLocalNetwork')
    expect(applyLocalNetworkText({}, undefined).NSLocalNetworkUsageDescription).toBe(DESCRIPTION)
    expect(applyLocalNetworkText({}, 'development').NSLocalNetworkUsageDescription).toBe(DESCRIPTION)
    for (const profile of ['preview', 'testflight', 'production']) {
      expect(keepsLocalNetworkText(profile)).toBe(false)
      expect(applyLocalNetworkText({ NSLocalNetworkUsageDescription: DESCRIPTION, Other: 1 }, profile)).toEqual({ Other: 1 })
    }
  })

  it('ignores local native build output inside node_modules when fingerprinting', () => {
    const ignore = readFileSync(new URL('../../landly-mobile/.fingerprintignore', import.meta.url), 'utf8')
    expect(ignore).toContain('node_modules/**/android/build/**')
    expect(ignore).toContain('node_modules/**/ios/Pods/**')
  })
})
