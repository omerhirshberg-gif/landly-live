// Google's native sign-in SDK is Android-only here: iOS keeps the browser flow
// (src/auth/googleSignIn.ts), so the package is left out of iOS autolinking and
// the iOS project needs no pod, entitlement or Info.plist change for it.
module.exports = {
  dependencies: {
    '@react-native-google-signin/google-signin': { platforms: { ios: null } },
  },
}
