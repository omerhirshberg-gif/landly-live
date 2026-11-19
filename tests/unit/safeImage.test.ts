import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// A binary built before expo-image was added has no ExpoImage native module, and importing the package then throws at
// bundle evaluation. Only SafeImage may load it, lazily and behind a probe.
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? sources(path) : /\.(tsx?|js)$/.test(name) ? [path] : []
  })
}

describe('native SafeImage', () => {
  const safe = readFileSync('landly-mobile/src/components/SafeImage.tsx', 'utf8')

  it('is the only file that loads expo-image, and never with a top-level import', () => {
    const offenders = sources('landly-mobile/src').filter((f) => !f.endsWith('SafeImage.tsx') && /from 'expo-image'|require\('expo-image'\)/.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
    expect(safe).not.toMatch(/^import .* from 'expo-image'/m)
    expect(safe).toContain("require('expo-image')")
  })

  it('probes for the native module in a try/catch and falls back to React Native\'s Image', () => {
    expect(safe).toContain("requireOptionalNativeModule('ExpoImage')")
    expect(safe).toMatch(/try \{[\s\S]*require\('expo-image'\)[\s\S]*\} catch/)
    expect(safe).toContain('<RNImage')
  })

  it('maps contentFit to resizeMode and reports the load size in expo-image\'s shape', () => {
    for (const pair of ["fill: 'stretch'", "none: 'center'", "'scale-down': 'contain'", "cover: 'cover'", "contain: 'contain'"]) expect(safe).toContain(pair)
    expect(safe).toContain('e.nativeEvent.source.width')
    expect(safe).toContain("typeof source === 'string' ? { uri: source } : source")
  })

  it('serves every picture on the app: remote uris, strings and require() assets', () => {
    for (const file of ['DealMedia', 'PerkImage', 'MerchantBadge', 'CategoryPhotoRail', 'Avatar']) {
      expect(readFileSync(`landly-mobile/src/components/${file}.tsx`, 'utf8')).toContain("import Image from './SafeImage'")
    }
  })
})
