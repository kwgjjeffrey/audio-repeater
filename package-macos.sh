#!/usr/bin/env bash
# Local macOS packaging script — produces a .dmg in ./release/
set -euo pipefail
cd "$(dirname "$0")"

echo "→ Cleaning previous build artifacts..."
rm -rf out

echo "→ Building with electron-vite..."
npm run build

echo "→ Packaging with electron-builder (mac)..."
npx electron-builder --mac

echo ""
echo "✓ Done! Installer:"
ls -lh release/*.dmg 2>/dev/null || echo "  (no .dmg found — check errors above)"
