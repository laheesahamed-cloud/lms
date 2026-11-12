#!/bin/bash
# Build the xyndrome Flutter app for iPhone (release) and install it — without CocoaPods.
# Usage:  bash mobile/build_ios_release.sh            (finds your iPhone automatically)
#         bash mobile/build_ios_release.sh <device-id> (use a specific device)
set -e

FLUTTER="$HOME/development/flutter/bin/flutter"
# Set API_BASE_URL to build against another server (for example a local one);
# otherwise the app is built for the live server.
API="${API_BASE_URL:-https://xyndrome.lk/api}"
BUNDLE="app.xyndrome.lk"
cd "$(dirname "$0")"          # -> mobile/

echo "== 1. Keep CocoaPods out of the way (all iOS plugins are Swift Packages)"
if [ -f ios/Podfile ]; then
  mv ios/Podfile ios/Podfile.bak
  echo "   moved ios/Podfile -> ios/Podfile.bak"
fi
mkdir -p ios/Pods
[ -f ios/Podfile.lock ] && cp ios/Podfile.lock ios/Pods/Manifest.lock
echo "   ok"

echo "== 2. Xcode.app must be closed (a parallel Xcode build ships the app without plugins)"
if pgrep -f "Xcode.app/Contents/MacOS/Xcode" >/dev/null; then
  echo "   Xcode.app is open. Quit it, then run this again."; exit 1
fi
echo "   ok"

echo "== 3. Find the iPhone"
DEVICE="$1"
if [ -z "$DEVICE" ]; then
  DEVICE=$(xcrun devicectl list devices 2>/dev/null | grep -i "iphone" | grep -iE "connected|available" \
           | grep -oE "[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}" | head -1)
fi
if [ -z "$DEVICE" ]; then
  echo "   No iPhone found. Plug it in, unlock it, then run:  xcrun devicectl list devices"; exit 1
fi
echo "   using $DEVICE"

echo "== 4. Build (release only — debug builds get killed at launch on iOS 26.5)"
"$FLUTTER" build ios --release --dart-define=API_BASE_URL="$API"

APP="build/ios/iphoneos/Runner.app"
[ -d "$APP" ] || APP="build/ios/Release-iphoneos/Runner.app"
[ -d "$APP" ] || { echo "   Runner.app not found after build"; exit 1; }
echo "   built $APP"

echo "== 5. Install (retries once: error 3002 usually means the phone was locked)"
xcrun devicectl device install app --device "$DEVICE" "$APP" \
  || { echo "   retrying install in 5s — unlock the phone"; sleep 5; xcrun devicectl device install app --device "$DEVICE" "$APP"; }

echo "== 6. Launch"
xcrun devicectl device process launch --device "$DEVICE" "$BUNDLE"
echo "Done."

# If something still goes wrong:
#  - "CocoaPods not installed or not in valid state" -> ios/Podfile came back; this script moves it again.
#  - "sandbox is not in sync with the Podfile.lock"  -> step 1 fixes it (copies Podfile.lock to Pods/Manifest.lock).
#  - White screen after install                       -> Xcode.app was building at the same time; close it, rebuild.
#  - Don't run `flutter clean` as a first fix; it made things worse before.
