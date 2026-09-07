#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HTML="$ROOT/exports/zabkova-kak-prodavali.html"
PDF_EXPORT="$ROOT/exports/zabkova-kak-prodavali.pdf"
PDF_PUBLIC="$ROOT/public/training/zabkova-kak-prodavali.pdf"
CHROME="${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

if [[ ! -f "$HTML" ]]; then
  echo "Missing $HTML" >&2
  exit 1
fi
if [[ ! -x "$CHROME" ]]; then
  echo "Chrome not found at $CHROME" >&2
  exit 1
fi

mkdir -p "$(dirname "$PDF_PUBLIC")"
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
  --virtual-time-budget=8000 \
  --print-to-pdf="$PDF_EXPORT" \
  "file://$HTML"
cp "$PDF_EXPORT" "$PDF_PUBLIC"
echo "Wrote $PDF_EXPORT"
echo "Wrote $PDF_PUBLIC"
