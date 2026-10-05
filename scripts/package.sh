#!/bin/sh
# Builds dist/quiet.zip for a GitHub release: just the extension, fallback list included.
# Usage: sh scripts/package.sh   (then attach dist/quiet.zip to the release)
set -e
cd "$(dirname "$0")/.."
npm run -s build-rules
rm -rf dist && mkdir -p dist/quiet
cp -R manifest.json background.js lists.js achievements.js config.js allowlist.txt LICENSE README.md \
  popup content icons rules dist/quiet/
(cd dist && zip -qrX quiet.zip quiet -x '*.DS_Store' && rm -rf quiet)
echo "dist/quiet.zip ($(node -p "require('./manifest.json').version"))"
