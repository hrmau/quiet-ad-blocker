#!/bin/sh
# Builds the release zips, fallback list included:
#   dist/quiet.zip        - GitHub release: a quiet/ folder to unzip and load unpacked
#   dist/quiet-store.zip  - Chrome Web Store upload: manifest.json at the zip root
# Usage: npm run package   (bump the version in manifest.json first)
set -e
cd "$(dirname "$0")/.."
npm run -s build-rules
rm -rf dist && mkdir -p dist/quiet
cp -R manifest.json background.js lists.js achievements.js config.js allowlist.txt LICENSE README.md \
  popup content icons rules dist/quiet/
(cd dist && zip -qrX quiet.zip quiet -x '*.DS_Store')
(cd dist/quiet && zip -qrX ../quiet-store.zip . -x '*.DS_Store' -x README.md)
rm -rf dist/quiet
echo "dist/quiet.zip, dist/quiet-store.zip ($(node -p "require('./manifest.json').version"))"
