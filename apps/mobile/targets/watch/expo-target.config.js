const path = require("node:path");

/**
 * Apple Watch companion app. Signing, embedding ("Embed Watch Content") and
 * the build dependency on the iOS app are handled by @bacons/apple-targets;
 * the companion bundle identifier is written into Info.plist by
 * plugins/withWatchCompanionInfoPlist.cjs because it varies per app variant.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: "watch",
  name: "T3CodeWatch",
  displayName: config.name,
  bundleIdentifier: ".watchkitapp",
  deploymentTarget: "10.0",
  frameworks: ["SwiftUI", "WatchConnectivity"],
  // apple-targets resolves `icon` relative to this directory.
  ...(typeof config.icon === "string"
    ? { icon: path.relative(__dirname, path.resolve(__dirname, "..", "..", config.icon)) }
    : {}),
  colors: {
    $accent: { color: "#7565C7", darkColor: "#7565C7" },
  },
});
