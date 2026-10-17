#!/usr/bin/env bash
# Invoked by scripts/dev.sh ios-ui inside emulators:exec, never against live services.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
test -n "${FIREBASE_AUTH_EMULATOR_HOST:-}" && test -n "${FIRESTORE_EMULATOR_HOST:-}"
destination_id="${1:?Dedicated simulator UDID is required}"
shift
export GOOGLE_CLOUD_PROJECT=central-pa-watershed-dev
export NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
export NEXT_PUBLIC_FIREBASE_API_KEY=emulator-only-key
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=central-pa-watershed-dev.firebaseapp.com
export NEXT_PUBLIC_FIREBASE_PROJECT_ID=central-pa-watershed-dev
export NEXT_PUBLIC_FIREBASE_APP_ID=emulator-only-app
qc_log="${TMPDIR:-/tmp}/pww-ios-ui-qc.log"
printf 'QC Console log: %s\n' "$qc_log"
qc_pid=''
cleanup() {
  if [[ -n "$qc_pid" ]]; then
    kill "$qc_pid" 2>/dev/null || true
    wait "$qc_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT
node scripts/seed_test_sites.mjs --apply
node scripts/provision_test_users.mjs --apply >/dev/null
npm run build --prefix web >"$qc_log" 2>&1
(cd web && exec node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3109) >>"$qc_log" 2>&1 &
qc_pid=$!
ready=false
for ((attempt=0; attempt<60; attempt++)); do
  if ! kill -0 "$qc_pid" 2>/dev/null; then
    printf 'QC server exited before becoming ready. See %s\n' "$qc_log" >&2
    exit 1
  fi
  if curl --silent --fail http://127.0.0.1:3109/review >/dev/null; then ready=true; break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  printf 'QC server did not become ready. See %s\n' "$qc_log" >&2
  exit 1
fi
cd 'Phone App/iPhone App/PAWatershedWatch'
# Ad-hoc simulator signing supplies the keychain used by Firebase Auth. It does not sign a release.
xcodebuild test -project PAWatershedWatch.xcodeproj -scheme PAWatershedWatchUITests \
  -destination "id=$destination_id" CODE_SIGN_IDENTITY=- -collect-test-diagnostics never "$@"
