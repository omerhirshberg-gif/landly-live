// Lets the app import the web app's shared client code from ../lib while
// keeping its own dependency tree. The repo root isn't an npm workspace (the
// web app is on a newer React than React Native allows), so Expo's automatic
// monorepo setup doesn't apply and this wires it up by hand:
//
// - watchFolders: Metro may read files outside landly-mobile/.
// - resolveRequest: a package import from shared code (../lib) is resolved
//   as if it came from landly-mobile/, so `react`, `firebase`, etc. are this
//   app's single copies, never the web app's. Two copies of React crash at
//   runtime; two copies of Firebase would split auth state.
// - `@/` and `@shared/` aliases match tsconfig.json.
// - blockList: the web app's node_modules, build output and Next-only code
//   never enter the bundle. Server-only modules (firebase-admin, payments)
//   also fail loudly: they import `server-only`/`firebase-admin`, which this
//   app doesn't install.
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const repoRoot = path.resolve(projectRoot, '..')
const resolveFrom = path.join(projectRoot, 'package.json')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [repoRoot]

const escape = (p) => p.replace(/[/\\.]/g, (c) => `\\${c}`)
config.resolver.blockList = [
  new RegExp(`^${escape(path.join(repoRoot, 'node_modules'))}[/\\\\].*`),
  new RegExp(`^${escape(path.join(repoRoot, '.next'))}[/\\\\].*`),
  new RegExp(`^${escape(path.join(repoRoot, 'app'))}[/\\\\].*`),
  new RegExp(`^${escape(path.join(repoRoot, 'components'))}[/\\\\].*`),
]

const upstreamResolve = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstreamResolve ?? context.resolveRequest
  if (moduleName.startsWith('@shared/')) {
    return resolve(context, path.join(repoRoot, 'lib', moduleName.slice('@shared/'.length)), platform)
  }
  if (moduleName.startsWith('@/')) {
    return resolve(context, path.join(repoRoot, moduleName.slice(2)), platform)
  }
  const isPackage = !moduleName.startsWith('.') && !path.isAbsolute(moduleName)
  const fromSharedCode = !context.originModulePath.startsWith(projectRoot + path.sep)
  if (isPackage && fromSharedCode) {
    return resolve({ ...context, originModulePath: resolveFrom }, moduleName, platform)
  }
  return resolve(context, moduleName, platform)
}

module.exports = config
