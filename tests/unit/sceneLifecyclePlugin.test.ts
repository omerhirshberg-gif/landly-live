import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { nativeSceneLifecycleStatus } from '../../scripts/lib/appleOAuth.mjs'

// landly-mobile/plugins/withSceneLifecycle.js: iOS 27 stops an app built with
// its SDK at launch unless it adopts UIKit's scene life cycle.
const require = createRequire(import.meta.url)
const plugin = require('../../landly-mobile/plugins/withSceneLifecycle.js') as {
  applySceneAppDelegate: (contents: string) => string
  applySceneManifest: (plist: Record<string, unknown>) => Record<string, unknown>
  SCENE_DELEGATE_SWIFT: string
}

// The Expo SDK 57 prebuild template's AppDelegate.swift (start of the file).
const SDK57_APP_DELEGATE = `internal import Expo
import React
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`

describe('withSceneLifecycle plugin', () => {
  it('hands the window and React Native start to the scene delegate', () => {
    const out = plugin.applySceneAppDelegate(SDK57_APP_DELEGATE)
    expect(out).toMatch(/class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider \{/)
    expect(out).not.toMatch(/startReactNative|UIWindow\(frame/)
    // The factory the scene delegate starts is still created here.
    expect(out).toMatch(/reactNativeFactory = factory/)
    expect(out).toMatch(/return super\.application\(application, didFinishLaunchingWithOptions: launchOptions\)/)
    // A second prebuild pass changes nothing.
    expect(plugin.applySceneAppDelegate(out)).toBe(out)
  })

  it('fails the prebuild on a template it does not recognise', () => {
    expect(() => plugin.applySceneAppDelegate('class AppDelegate: UIResponder {}')).toThrow(/withSceneLifecycle/)
    const changedStart = SDK57_APP_DELEGATE.replace('window = UIWindow(frame: UIScreen.main.bounds)', 'window = makeWindow()')
    expect(() => plugin.applySceneAppDelegate(changedStart)).toThrow(/startReactNative block has changed/)
  })

  it('declares one scene, delegated to SceneDelegate, and keeps the other keys', () => {
    const plist = plugin.applySceneManifest({ CFBundleDisplayName: 'Landly' })
    expect(plist.CFBundleDisplayName).toBe('Landly')
    expect(plist.UIApplicationSceneManifest).toEqual({
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          { UISceneConfigurationName: 'Default Configuration', UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate' },
        ],
      },
    })
    expect(plugin.SCENE_DELEGATE_SWIFT).toMatch(/@objc\(SceneDelegate\)\s*\nclass SceneDelegate: ExpoAppSceneDelegate \{/)
  })

  it('is registered in app.json, after the Apple sign-in plugin', () => {
    const plugins = JSON.parse(readFileSync('landly-mobile/app.json', 'utf8')).expo.plugins as unknown[]
    expect(plugins).toContain('./plugins/withSceneLifecycle')
    expect(plugins.indexOf('./plugins/withSceneLifecycle')).toBeGreaterThan(plugins.indexOf('expo-apple-authentication'))
  })

  it("relies on Expo's own scene delegate, which ships with the installed expo package", () => {
    const sceneDelegate = readFileSync('landly-mobile/node_modules/expo/ios/AppDelegates/ExpoAppSceneDelegate.swift', 'utf8')
    expect(sceneDelegate).toMatch(/open class ExpoAppSceneDelegate: UIResponder, UIWindowSceneDelegate/)
  })
})

describe('check:apple UIScene row', () => {
  const infoPlist = `<dict>
  <key>UIApplicationSceneManifest</key>
  <dict>
    <key>UIApplicationSupportsMultipleScenes</key>
    <false/>
    <key>UISceneConfigurations</key>
    <dict>
      <key>UIWindowSceneSessionRoleApplication</key>
      <array>
        <dict>
          <key>UISceneConfigurationName</key>
          <string>Default Configuration</string>
          <key>UISceneDelegateClassName</key>
          <string>$(PRODUCT_MODULE_NAME).SceneDelegate</string>
        </dict>
      </array>
    </dict>
  </dict>
</dict>`
  const pbxproj = '\t\tA1B2C3 /* SceneDelegate.swift in Sources */ = {isa = PBXBuildFile; fileRef = D4E5F6 /* SceneDelegate.swift */; };'
  const good = {
    infoPlist,
    pbxproj,
    appDelegate: plugin.applySceneAppDelegate(SDK57_APP_DELEGATE),
    sceneDelegate: plugin.SCENE_DELEGATE_SWIFT,
  }

  it('passes a project the plugin set up', () => {
    expect(nativeSceneLifecycleStatus(good)).toBe('ok')
  })

  it('flags a project generated without it (the launch crash)', () => {
    expect(nativeSceneLifecycleStatus({ ...good, infoPlist: '<dict/>' })).toBe('stale-build')
    expect(nativeSceneLifecycleStatus({ ...good, pbxproj: '' })).toBe('stale-build')
    expect(nativeSceneLifecycleStatus({ ...good, sceneDelegate: null })).toBe('stale-build')
    expect(nativeSceneLifecycleStatus({ ...good, appDelegate: SDK57_APP_DELEGATE })).toBe('stale-build')
    expect(nativeSceneLifecycleStatus({ infoPlist: null, pbxproj: null, appDelegate: null, sceneDelegate: null })).toBe('no-native-project')
  })
})
