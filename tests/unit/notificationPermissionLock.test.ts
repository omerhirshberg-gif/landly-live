import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// The OS / browser notification prompt appears only from a tap on the
// onboarding's "Enable Notifications" button: never on launch, sign-in or
// when a step mounts. This keeps it so: the request calls live in the two
// notificationPermission modules, and those are used only from the Enable
// handler of each OnboardingWizard.

const ROOT = path.resolve(__dirname, '../..')
const SOURCE_DIRS = ['app', 'components', 'lib', 'landly-mobile/src']
const SKIP = new Set(['node_modules', '.next', 'dist', 'ios', 'android'])

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

const files = SOURCE_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)))
const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join('/')
const read = (file: string) => readFileSync(file, 'utf8')
// Comments don't count: strip them before looking for calls.
const code = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const PERMISSION_MODULES = [
  'components/auth/onboarding/notificationPermission.ts',
  'landly-mobile/src/lib/notificationPermission.ts',
  'landly-mobile/src/lib/notificationPermission.web.ts',
]
const WIZARDS = ['components/auth/onboarding/OnboardingWizard.tsx', 'landly-mobile/src/auth/onboarding/OnboardingWizard.tsx']

describe('notification permission is asked only on tap', () => {
  it('requests the permission only inside the notificationPermission modules', () => {
    const offenders = files.filter((file) => /requestPermissionsAsync|Notification\.requestPermission\s*\(/.test(code(file))).map(rel)
    expect(offenders.sort()).toEqual([...PERMISSION_MODULES].sort())
  })

  it('imports those modules only from the two onboarding wizards', () => {
    const importers = files
      .filter((file) => !PERMISSION_MODULES.includes(rel(file)) && /notificationPermission['"]/.test(code(file)))
      .map(rel)
    expect(importers.sort()).toEqual([...WIZARDS].sort())
  })

  it.each(WIZARDS)('%s calls it once, inside the Enable handler, never in an effect', (wizard) => {
    const src = code(path.join(ROOT, wizard))
    expect(src.match(/requestNotificationPermission\(/g)).toHaveLength(1)
    const handler = src.match(/const handleEnable = async \(\) => \{[\s\S]*?\n  \}\n/)?.[0] ?? ''
    expect(handler).toContain('requestNotificationPermission()')
    // "Maybe later" asks nothing.
    const later = src.match(/const handleLater = async \(\) => \{[\s\S]*?\n  \}\n/)?.[0] ?? ''
    expect(later).not.toContain('requestNotificationPermission')
    for (const effect of src.match(/useEffect\([\s\S]*?\n  \}, \[[^\]]*\]\)/g) ?? []) {
      expect(effect).not.toContain('requestNotificationPermission')
    }
  })

  it('wires the Enable and Maybe-later buttons to those handlers', () => {
    expect(read(path.join(ROOT, 'components/auth/onboarding/OnboardingWizard.tsx'))).toContain('onEnable={handleEnable} onLater={handleLater}')
    expect(read(path.join(ROOT, 'landly-mobile/src/auth/onboarding/OnboardingWizard.tsx'))).toContain('onEnable={handleEnable} onLater={handleLater}')
  })
})
