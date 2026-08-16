#!/usr/bin/env bash
set -euo pipefail

REPO="UnbrokenMango21/watershed-water-quality-dashboard"
INDIVIDUAL_KEY_ID_TO_REJECT="IPDY81DL8P2Z"

usage() {
  cat <<'EOF'
Usage:
  scripts/bootstrap-testflight-github-secrets.sh /path/to/AuthKey_<TEAM_KEY_ID>.p8 <TEAM_KEY_ID>

This stores an App Store Connect TEAM API key in GitHub Actions encrypted
repository secrets. It never commits or uploads the private key as repository
content.

Use a Team Key from App Store Connect > Users and Access > Integrations >
App Store Connect API > Team Keys. Prefer an Admin Team Key for CI signing.
Do not use an Individual API Key; individual keys cannot use Apple's
Provisioning endpoints required by headless automatic signing.
EOF
}

if [ "$#" -ne 2 ]; then
  usage
  exit 2
fi

KEY_FILE="$1"
KEY_ID="$2"

[ -f "$KEY_FILE" ] || { echo "Key file not found: $KEY_FILE" >&2; exit 1; }

if [ "$KEY_ID" = "$INDIVIDUAL_KEY_ID_TO_REJECT" ]; then
  echo "Refusing key $KEY_ID: this is the previously supplied individual API key." >&2
  echo "Use an App Store Connect Team Key for provisioning/signing CI." >&2
  exit 1
fi

if ! [[ "$KEY_ID" =~ ^[A-Z0-9]{10}$ ]]; then
  echo "Unexpected Team Key ID format: $KEY_ID" >&2
  echo "Expected a 10-character App Store Connect Team Key ID." >&2
  exit 1
fi

if ! grep -qE 'BEGIN (EC )?PRIVATE KEY' "$KEY_FILE"; then
  echo "The supplied file does not look like an Apple .p8 private key." >&2
  exit 1
fi

command -v gh >/dev/null 2>&1 || {
  echo "GitHub CLI (gh) is required. Install it with: brew install gh" >&2
  exit 1
}

if ! gh auth status -h github.com >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Starting GitHub login..."
  gh auth login -h github.com -p https -w
fi

echo "Repository: $REPO"
echo "Team Key ID: $KEY_ID"
echo "Private key: $KEY_FILE"
echo

echo "Storing encrypted repository secrets..."
gh secret set ASC_TEAM_KEY_ID --repo "$REPO" --body "$KEY_ID"
gh secret set ASC_TEAM_PRIVATE_KEY --repo "$REPO" < "$KEY_FILE"

echo
echo "Configured secrets:"
gh secret list --repo "$REPO" | grep -E '^ASC_TEAM_(KEY_ID|PRIVATE_KEY)[[:space:]]' || true

echo
cat <<'EOF'
Bootstrap complete.

The private key was sent only to GitHub's Actions secret API and was not added
to git. Future TestFlight releases are triggered by an owner-only command on
GitHub issue #26 in this exact form:

  !testflight <release-ref> <40-character-sha> <version> <build>

The workflow pins the commit, bundle ID, version, build number, Apple team,
Xcode 26.6, and iOS 26+ SDK before it signs or uploads anything.
EOF
