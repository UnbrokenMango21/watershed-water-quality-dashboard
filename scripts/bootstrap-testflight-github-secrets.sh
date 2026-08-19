#!/usr/bin/env bash
set -euo pipefail

REPO="UnbrokenMango21/watershed-water-quality-dashboard"
INDIVIDUAL_KEY_ID_TO_REJECT="IPDY81DL8P2Z"
KNOWN_APP_MANAGER_KEY_ID_TO_REJECT="3FKRFL73Y8"

usage() {
  cat <<'EOF'
Usage:
  scripts/bootstrap-testflight-github-secrets.sh /path/to/AuthKey_<TEAM_KEY_ID>.p8 <TEAM_KEY_ID>

This stores an App Store Connect TEAM API key in GitHub Actions encrypted
repository secrets. It never commits or uploads the private key as repository
content.

This TestFlight workflow REQUIRES a Team API key with Admin authority because
its distribution export uses Apple's cloud-managed signing assets. An App
Manager key can authenticate and may create a development-signed archive, but
it is insufficient for the distribution cloud-signing step.

Use a Team Key from App Store Connect > Users and Access > Integrations >
App Store Connect API > Team Keys and confirm that its Access role is Admin.
Do not use an Individual API Key.

The .p8 file does not encode the App Store Connect role, so this helper cannot
prove an arbitrary key's role locally. It rejects Team keys already known to be
insufficient for this repository, but you must still select/confirm an Admin
Team key in App Store Connect before bootstrapping it.
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
  echo "Refusing key $KEY_ID: this is the previously supplied Individual API key." >&2
  echo "Use an App Store Connect Team API key with Admin access." >&2
  exit 1
fi

if [ "$KEY_ID" = "$KNOWN_APP_MANAGER_KEY_ID_TO_REJECT" ]; then
  echo "Refusing key $KEY_ID: this Team key has App Manager access." >&2
  echo "The TestFlight distribution export requires an Admin Team API key." >&2
  exit 1
fi

if ! [[ "$KEY_ID" =~ ^[A-Z0-9]{10}$ ]]; then
  echo "Unexpected Team Key ID format: $KEY_ID" >&2
  echo "Expected a 10-character App Store Connect Team Key ID." >&2
  exit 1
fi

if ! openssl pkey -in "$KEY_FILE" -noout >/dev/null 2>&1; then
  echo "The supplied file is not a readable private key." >&2
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
echo "IMPORTANT: Confirm this Team key's App Store Connect Access role is Admin."
read -r -p "Type ADMIN to continue: " ROLE_CONFIRMATION
if [ "$ROLE_CONFIRMATION" != "ADMIN" ]; then
  echo "Aborted. No GitHub secrets were changed." >&2
  exit 1
fi

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
