/**
 * Watch face complication and Smart Stack widget for the Apple Watch app.
 * apple-targets embeds watchOS extensions in the watch app rather than the
 * iPhone app. The app group matches the watch app's, which writes the summary
 * this widget reads.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: "watch-widget",
  name: "T3CodeWatchWidget",
  displayName: config.name,
  bundleIdentifier: ".watchkitapp.widgets",
  deploymentTarget: "10.0",
  frameworks: ["SwiftUI", "WidgetKit"],
  entitlements: {
    "com.apple.security.application-groups": [`group.${config.ios.bundleIdentifier}`],
  },
});
