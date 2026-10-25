import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Static proof that admin uploads can only reach Firebase through the
// guarded Admin SDK in lib/firebase/admin.ts, on the same origin as the page.

const root = join(__dirname, '..', '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(join(root, path)).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

const read = (path: string) => readFileSync(join(root, path), 'utf8')
const adminRoutes = sourceFiles('app/api/admin').filter((path) => path.endsWith('route.ts'))
const adminPages = [...sourceFiles('app/admin'), ...sourceFiles('components/admin'), ...sourceFiles('lib/admin')]

describe('admin upload isolation', () => {
  it('finds the admin routes', () => {
    expect(adminRoutes.map((path) => relative('app/api/admin', path))).toEqual(
      expect.arrayContaining(['businesses/route.ts', 'offers/route.ts', 'offers/[offerId]/route.ts']),
    )
  })

  it.each(adminRoutes)('%s reaches Firestore/Auth only through lib/firebase/admin', (path) => {
    const source = read(path)
    expect(source).not.toMatch(/from 'firebase-admin\/(app|auth)'/)
    expect(source).not.toMatch(/from 'firebase\//)
    expect(source).not.toMatch(/getFirestore\(|getAuth\(|initializeApp\(/)
    expect(source).not.toMatch(/landly-be752|landly-dev/)
    if (/getAdmin(Db|Auth)\(/.test(source)) expect(source).toMatch(/from '@\/lib\/firebase\/admin'/)
  })

  it('initializes Firebase only in the guarded config modules', () => {
    const allowed = ['lib/firebase/admin.ts', 'lib/firebase/config.ts', 'lib/firebase/config.web.ts', 'lib/firebase/config.native.ts']
    const initializers = [...sourceFiles('app'), ...sourceFiles('lib'), ...sourceFiles('components')].filter((path) =>
      /\binitializeApp\(/.test(read(path)),
    )
    expect(initializers.sort()).toEqual(allowed.sort())
  })

  it('names no Firebase project outside envGuard', () => {
    const offenders = [...sourceFiles('app'), ...sourceFiles('lib'), ...sourceFiles('components')].filter(
      (path) => path !== 'lib/firebase/envGuard.ts' && /landly-be752|landly-dev/.test(read(path)),
    )
    expect(offenders).toEqual([])
  })

  it.each(adminPages)('%s writes nothing to Firestore or Storage from the browser', (path) => {
    const source = read(path)
    expect(source).not.toMatch(/from 'firebase\/(firestore|storage)'/)
    expect(source).not.toMatch(/\b(setDoc|addDoc|updateDoc|deleteDoc|writeBatch|runTransaction|uploadBytes)\(/)
  })

  it.each(adminPages)('%s calls only same-origin admin API routes', (path) => {
    for (const [, url] of read(path).matchAll(/\b(?:adminFetch|fetch)\(\s*[`'"]([^`'"]*)/g)) {
      expect(url).toMatch(/^\/api\/admin\//)
    }
  })
})
