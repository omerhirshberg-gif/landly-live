// Adopts UIKit's scene-based life cycle on iOS. Apps built with the iOS 27
// SDK must: iOS 27 stops any app that hasn't at launch
// (_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption). Expo SDK 57
// ships the scene delegate (ExpoAppSceneDelegate, in the expo package) but its
// prebuild template doesn't use it yet; this applies the SDK 58 template's
// setup on every `expo prebuild` and EAS build:
//
//   Info.plist        UIApplicationSceneManifest -> $(PRODUCT_MODULE_NAME).SceneDelegate
//   SceneDelegate     a subclass of ExpoAppSceneDelegate, which creates the
//                     window, starts React Native in it and passes deep links
//                     and universal links on to the app delegate
//   AppDelegate       provides its React Native factory (ExpoReactNativeFactoryProvider)
//                     instead of creating a window and starting React Native itself
//
// A template this doesn't recognise fails the prebuild rather than leaving an
// app that crashes on launch. Drop this plugin when moving to SDK 58.

const fs = require('fs')
const path = require('path')
const { IOSConfig, withAppDelegate, withInfoPlist, withXcodeProject } = require('expo/config-plugins')

const SCENE_MANIFEST = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [
      {
        UISceneConfigurationName: 'Default Configuration',
        UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
      },
    ],
  },
}

const SCENE_DELEGATE_SWIFT = `internal import Expo

// Added by plugins/withSceneLifecycle.js: the scene-based life cycle iOS 27 requires.
@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  // Extension point for config plugins.
}
`

const CLASS_LINE = /class AppDelegate: ExpoAppDelegate(?!, ExpoReactNativeFactoryProvider)\s*\{/
// The SDK 57 template's own window and React Native start.
const WINDOW_START = /#if os\(iOS\) \|\| os\(tvOS\)\s*\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*\n\s*factory\.startReactNative\([\s\S]*?\)\s*\n#endif\s*\n/
const HANDED_OVER =
  '    // The window is created and React Native is started by SceneDelegate under the\n' +
  '    // scene-based life cycle (required by the iOS 27 SDK; plugins/withSceneLifecycle.js).\n'

/** AppDelegate.swift with the scene delegate in charge of the window. Idempotent. */
function applySceneAppDelegate(contents) {
  const adopted = /class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider\s*\{/.test(contents)
  let next = contents
  if (!adopted) {
    if (!CLASS_LINE.test(next)) throw new Error('withSceneLifecycle: AppDelegate.swift no longer declares `class AppDelegate: ExpoAppDelegate {`')
    next = next.replace(CLASS_LINE, 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {')
  }
  if (WINDOW_START.test(next)) next = next.replace(WINDOW_START, HANDED_OVER)
  else if (!next.includes(HANDED_OVER)) {
    throw new Error("withSceneLifecycle: AppDelegate.swift's window and startReactNative block has changed; update the plugin")
  }
  return next
}

/** Info.plist with the scene manifest. */
function applySceneManifest(infoPlist) {
  return { ...infoPlist, UIApplicationSceneManifest: SCENE_MANIFEST }
}

function withSceneLifecycle(config) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults = applySceneManifest(cfg.modResults)
    return cfg
  })
  config = withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') throw new Error('withSceneLifecycle: expected a Swift AppDelegate')
    cfg.modResults.contents = applySceneAppDelegate(cfg.modResults.contents)
    return cfg
  })
  config = withXcodeProject(config, (cfg) => {
    const { platformProjectRoot, projectRoot } = cfg.modRequest
    const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot)
    fs.writeFileSync(path.join(platformProjectRoot, projectName, 'SceneDelegate.swift'), SCENE_DELEGATE_SWIFT)
    const filepath = `${projectName}/SceneDelegate.swift`
    if (!cfg.modResults.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath, groupName: projectName, project: cfg.modResults })
    }
    return cfg
  })
  return config
}

module.exports = withSceneLifecycle
module.exports.applySceneAppDelegate = applySceneAppDelegate
module.exports.applySceneManifest = applySceneManifest
module.exports.SCENE_DELEGATE_SWIFT = SCENE_DELEGATE_SWIFT
