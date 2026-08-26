const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod } = require("expo/config-plugins");

/**
 * Writes targets/watch/Info.plist before @bacons/apple-targets links the
 * target. The companion bundle identifier is the iOS app's, which differs per
 * variant (dev / preview / production), so the plist cannot be checked in.
 */
module.exports = function withWatchCompanionInfoPlist(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const companionBundleIdentifier = config.ios?.bundleIdentifier;
      if (!companionBundleIdentifier) {
        throw new Error("withWatchCompanionInfoPlist: ios.bundleIdentifier is required.");
      }
      const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>$(DEVELOPMENT_LANGUAGE)</string>
  <key>CFBundleDisplayName</key>
  <string>${escapeXml(config.name ?? "T3 Code")}</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
  <key>CFBundleShortVersionString</key>
  <string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key>
  <string>$(CURRENT_PROJECT_VERSION)</string>
  <key>UISupportedInterfaceOrientations</key>
  <array>
    <string>UIInterfaceOrientationPortrait</string>
    <string>UIInterfaceOrientationPortraitUpsideDown</string>
  </array>
  <key>WKApplication</key>
  <true/>
  <key>WKCompanionAppBundleIdentifier</key>
  <string>${escapeXml(companionBundleIdentifier)}</string>
  <key>WKRunsIndependentlyOfCompanionApp</key>
  <false/>
</dict>
</plist>
`;
      const target = path.join(config.modRequest.projectRoot, "targets", "watch", "Info.plist");
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, plist);
      return config;
    },
  ]);
};

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
