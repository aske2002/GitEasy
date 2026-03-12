#!/usr/bin/env bash
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 0.5.0
#
# This script:
#   1. Bumps package.json version
#   2. Commits the change
#   3. Creates a git tag
#   4. Pushes commit + tag → triggers GitHub Actions build & publish

set -e

VERSION="$1"

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.5.0"
  exit 1
fi

# Strip leading 'v' if provided
VERSION="${VERSION#v}"

echo "→ Bumping version to $VERSION"
npm version "$VERSION" --no-git-tag-version

echo "→ Committing version bump"
git add package.json
git commit -m "chore: bump version to $VERSION"

echo "→ Creating tag v$VERSION"
git tag "v$VERSION"

echo "→ Pushing commit and tag"
git push && git push origin "v$VERSION"

echo ""
echo "✓ Released v$VERSION — GitHub Actions will build and publish to GitHub Releases."
