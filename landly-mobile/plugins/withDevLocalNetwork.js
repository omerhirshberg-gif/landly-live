// The local-network prompt text (NSLocalNetworkUsageDescription) belongs to development builds only: Expo Go-style
// local runs and the EAS `development` profile, where the app reaches the Metro / `next dev` server over the LAN. A store
// binary (preview, testflight, production) never carries it.
//
// It is a plugin, not an app.json infoPlist entry, on purpose: the EAS CLI resolves the app config on the developer's
// machine (no EAS_BUILD_PROFILE) and the EAS builder resolves it again with the profile set, and "Configure
// expo-updates" fails the build when the two runtime versions differ. An infoPlist entry removed per profile made the
// configs differ (and, under the old `fingerprint` policy, the hashes). The plugin entry is static, so the resolved
// config is the same everywhere, and the profile is read only while the native project is generated (prebuild).

const { withInfoPlist } = require('expo/config-plugins')

const DESCRIPTION = 'GoLandly connects to the development server on your local network while the app is being developed.'

/** Local runs (no profile) and the development profile keep the prompt text; every store profile drops it. */
const keepsLocalNetworkText = (profile) => profile === undefined || profile === 'development'

/** Pure: the Info.plist for `profile`. */
function applyLocalNetworkText(infoPlist, profile) {
  const { NSLocalNetworkUsageDescription: _existing, ...rest } = infoPlist
  return keepsLocalNetworkText(profile) ? { ...rest, NSLocalNetworkUsageDescription: DESCRIPTION } : rest
}

module.exports = (config) =>
  withInfoPlist(config, (c) => {
    c.modResults = applyLocalNetworkText(c.modResults, process.env.EAS_BUILD_PROFILE || undefined)
    return c
  })
module.exports.applyLocalNetworkText = applyLocalNetworkText
module.exports.keepsLocalNetworkText = keepsLocalNetworkText
module.exports.DESCRIPTION = DESCRIPTION
