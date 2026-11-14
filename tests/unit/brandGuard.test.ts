import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

// The product is "GoLandly", always in Latin script. Technical identifiers keep
// the lower-case `landly` (Firebase projects, bundle ids, storage keys, the
// `landly-mobile/` folder, `landly://`), so this guard looks only for the old
// capitalised brand and for the Hebrew transliteration.
const OLD_BRAND = /(?<!Go)Landly|לנדלי/

// Files and lines allowed to keep the old spelling.
const SKIP_FILES = new Set([
  'CLAUDE.md', // project guidelines, not product copy
  'AGENTS.md',
  'tests/unit/brandGuard.test.ts',
  // Pinned byte for byte by passAnimationIntegrity.test.ts; two code comments only.
  'components/home/PassShowcase.tsx',
])
const SKIP_PREFIX = ['landly-mobile/ios/', 'strix_runs/', '.agents/', 'node_modules/']
const SKIP_LINE = [
  /ios\/Landly/, // the Xcode target folder keeps its name
  /Landly\.(xcodeproj|xcworkspace|entitlements)/,
  /Landly\.test/, // fixture mailbox domain
  /LandlyMark/, // component identifier
  /X-Landly-Pass-Mock/, // internal mock-pass header
]

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean)

describe('brand guard', () => {
  it('keeps the old spelling out of tracked and new source files', () => {
    const files = [...new Set([...git('ls-files'), ...git('ls-files', '--others', '--exclude-standard')])]
    const hits: string[] = []
    for (const f of files) {
      if (SKIP_FILES.has(f) || SKIP_PREFIX.some((p) => f.startsWith(p)) || !existsSync(f)) continue
      if (/\.(png|jpe?g|webp|ico|woff2?|ttf|pdf|xlsx|mp4|lock)$/i.test(f) || f.endsWith('package-lock.json')) continue
      let text: string
      try {
        text = readFileSync(f, 'utf8')
      } catch {
        continue
      }
      text.split('\n').forEach((line, i) => {
        if (OLD_BRAND.test(line) && !SKIP_LINE.some((re) => re.test(line))) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`)
      })
    }
    expect(hits).toEqual([])
  })

  it('writes the wordmark as GoLandly', () => {
    expect(readFileSync('scripts/generate-wordmark-path.py', 'utf8')).toContain("TEXT = 'GoLandly'")
    expect(readFileSync('app/layout.tsx', 'utf8')).toContain("template: '%s | GoLandly'")
    expect(readFileSync('app/manifest.ts', 'utf8')).toMatch(/short_name: 'GoLandly'/)
    expect(readFileSync('landly-mobile/app.json', 'utf8')).toMatch(/"name": "GoLandly"/)
  })
})
