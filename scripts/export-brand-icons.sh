#!/usr/bin/env bash
# Regenerate favicon + PWA + companion icons from public/brand masters.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRAND="$ROOT/public/brand"
PUB="$ROOT/public"
TMP="$ROOT/scripts/brand-tmp"
mkdir -p "$TMP"

need() { command -v "$1" >/dev/null || { echo "missing $1"; exit 1; }; }
need rsvg-convert
need magick

echo "→ web PNGs"
rsvg-convert -w 512 -h 512 "$BRAND/mark-dark.svg" -o "$PUB/icon-512.png"
rsvg-convert -w 192 -h 192 "$BRAND/mark-dark.svg" -o "$PUB/icon-192.png"
rsvg-convert -w 512 -h 512 "$BRAND/mark-maskable.svg" -o "$PUB/icon-512-maskable.png"
rsvg-convert -w 512 -h 512 "$BRAND/mark-circle.svg" -o "$PUB/discord-server-icon.png"
cp "$BRAND/mark-circle.svg" "$PUB/discord-server-icon.svg"

echo "→ favicon.ico (16 + 32 + 48)"
rsvg-convert -w 16 -h 16 "$PUB/favicon.svg" -o "$TMP/favicon-16.png"
rsvg-convert -w 32 -h 32 "$PUB/favicon.svg" -o "$TMP/favicon-32.png"
rsvg-convert -w 48 -h 48 "$PUB/favicon.svg" -o "$TMP/favicon-48.png"
magick "$TMP/favicon-16.png" "$TMP/favicon-32.png" "$TMP/favicon-48.png" "$PUB/favicon.ico"

# Optional: push into sibling companion checkouts when present
DESKTOP="${THERMALTRACE_DESKTOP:-$ROOT/../thermaltrace-desktop}"
BAY="${THERMALTRACE_BAY_BUDDY:-$ROOT/../bay-buddy}"
ANDROID="${THERMALTRACE_ANDROID:-$ROOT/../thermaltrace-android}"

if [[ -d "$DESKTOP/src-tauri" ]]; then
  echo "→ thermaltrace-desktop icons via tauri icon"
  rsvg-convert -w 1024 -h 1024 "$BRAND/mark-dark.svg" -o "$TMP/tauri-source-1024.png"
  (cd "$DESKTOP" && npx --yes @tauri-apps/cli icon "$TMP/tauri-source-1024.png")
  rm -rf "$DESKTOP/src-tauri/icons/android" "$DESKTOP/src-tauri/icons/ios"
fi

if [[ -d "$BAY/src-tauri" ]]; then
  echo "→ bay-buddy icons via tauri icon"
  rsvg-convert -w 1024 -h 1024 "$BRAND/mark-dark.svg" -o "$TMP/tauri-source-1024.png"
  (cd "$BAY" && npx --yes @tauri-apps/cli icon "$TMP/tauri-source-1024.png")
  rm -rf "$BAY/src-tauri/icons/android" "$BAY/src-tauri/icons/ios"
fi

if [[ -d "$ANDROID/app/src/main/res" ]]; then
  echo "→ android mipmaps"
  # Legacy full icons
  declare -A LEGACY=( [mdpi]=48 [hdpi]=72 [xhdpi]=96 [xxhdpi]=144 [xxxhdpi]=192 )
  for dens in "${!LEGACY[@]}"; do
    s="${LEGACY[$dens]}"
    rsvg-convert -w "$s" -h "$s" "$BRAND/mark-dark.svg" -o "$ANDROID/app/src/main/res/mipmap-$dens/ic_launcher.png"
    rsvg-convert -w "$s" -h "$s" "$BRAND/mark-circle.svg" -o "$ANDROID/app/src/main/res/mipmap-$dens/ic_launcher_round.png"
  done
  # Adaptive foreground (108dp * density)
  declare -A FG=( [mdpi]=108 [hdpi]=162 [xhdpi]=216 [xxhdpi]=324 [xxxhdpi]=432 )
  for dens in "${!FG[@]}"; do
    s="${FG[$dens]}"
    rsvg-convert -w "$s" -h "$s" --background-color=none "$BRAND/mark-fg.svg" \
      -o "$ANDROID/app/src/main/res/mipmap-$dens/ic_launcher_foreground.png"
  done
  if [[ -d "$ANDROID/play/assets" ]]; then
    rsvg-convert -w 512 -h 512 "$BRAND/mark-dark.svg" -o "$ANDROID/play/assets/icon-512.png"
  fi
fi

echo "done"
