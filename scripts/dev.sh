#!/usr/bin/env bash
# Project-scoped environment; never changes the user's shell defaults.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
if [[ -z "${JAVA_HOME:-}" && -x '/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/java' ]]; then
  export JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home'
fi
export PATH="${JAVA_HOME:+$JAVA_HOME/bin:}$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
# Use the existing project-compatible mise runtime when a GUI inherited another Node.
if [[ -x "$HOME/.local/share/mise/installs/node/22/bin/node" ]]; then
  export PATH="$HOME/.local/share/mise/installs/node/22/bin:$PATH"
fi
if [[ "$(node -p 'process.versions.node.split(".")[0]')" != 22 ]]; then
  printf 'Node 22 is required. Select a project-scoped Node 22 runtime before continuing.\n' >&2
  exit 1
fi
# Python 3.14 hangs in this project's provisioning unittest on this Mac.
if [[ -x "$HOME/.local/share/mise/installs/python/3.13.15/bin/python3" ]]; then
  export PATH="$HOME/.local/share/mise/installs/python/3.13.15/bin:$PATH"
fi
command="${1:-doctor}"
if [[ $# -gt 0 ]]; then shift; fi
case "$command" in
  doctor)
    printf 'Repository: %s\n' "$ROOT"
    git status --short --branch
    node --version
    java -version
    printf 'Android SDK: %s\n' "$ANDROID_HOME"
    xcodebuild -version
    ;;
  contracts)
    npm run test:contracts
    npm run test:publication
    python3 -m unittest discover -s tests/publication -p '*_test.py'
    ;;
  web-checks)
    npm test --prefix public-dashboard
    npm run typecheck --prefix web
    npm run build --prefix web
    npm run typecheck --prefix public-dashboard
    npm run build --prefix public-dashboard
    ;;
  emulators)
    ./node_modules/.bin/firebase emulators:exec --project central-pa-watershed-dev --only firestore,storage 'node tests/firestore-rules/run-tests.cjs && node tests/firestore-rules/run-storage-tests.cjs && node tests/validation-firestore/run-tests.cjs && npm run test:review'
    ./node_modules/.bin/firebase emulators:exec --project central-pa-watershed-dev --only firestore,functions 'npm run test:trigger'
    ;;
  android)
    cd 'Phone App/Android App'
    exec ./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug "$@"
    ;;
  ios)
    destination="${IOS_DESTINATION:-platform=iOS Simulator,name=iPhone 18 Pro}"
    cd 'Phone App/iPhone App/PAWatershedWatch'
    exec xcodebuild test -project PAWatershedWatch.xcodeproj -scheme PAWatershedWatch -destination "$destination" CODE_SIGNING_ALLOWED=NO "$@"
    ;;
  firebase-mcp)
    exec node scripts/firebase-mcp-readonly.mjs
    ;;
  codex|claude) exec "$command" "$@" ;;
  *) printf 'Usage: scripts/dev.sh {doctor|contracts|web-checks|emulators|android|ios|firebase-mcp|codex|claude}\n' >&2; exit 2 ;;
esac
