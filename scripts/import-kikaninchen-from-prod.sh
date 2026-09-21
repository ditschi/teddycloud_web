#!/usr/bin/env bash
# Copy the Kikaninchen TAF out of a running production TeddyCloud container.
# Run this on the homeserver. Production files are only read, never rewritten.
#
# Usage:
#   ./scripts/import-kikaninchen-from-prod.sh
#   TEDDYCLOUD_CONTAINER=teddycloud DEST=./kikaninchen.taf ./scripts/import-kikaninchen-from-prod.sh
set -euo pipefail

DEST="${DEST:-$PWD/kikaninchen.taf}"
CONTAINER="${TEDDYCLOUD_CONTAINER:-}"

if [[ -z "$CONTAINER" ]]; then
    CONTAINER="$(docker ps --format '{{.Names}}' | grep -Ei 'teddy' | head -n 1 || true)"
fi
if [[ -z "$CONTAINER" ]]; then
    echo "No TeddyCloud container found. Set TEDDYCLOUD_CONTAINER=... and retry." >&2
    echo "Running containers:" >&2
    docker ps --format '  {{.Names}}\t{{.Image}}\t{{.Status}}' >&2
    exit 1
fi

echo "Using container: $CONTAINER"

mapfile -t hits < <(docker exec "$CONTAINER" sh -c '
    find /teddycloud/data/library /teddycloud/data/content -type f \( \
        -iname "*kika*" -o -iname "*kaninchen*" -o -iname "*kikaninchen*" \
    \) 2>/dev/null
    grep -ril -i kikaninchen /teddycloud/config /teddycloud/data 2>/dev/null || true
')

if [[ ${#hits[@]} -eq 0 ]]; then
    echo "No path matched *kika* / *kikaninchen*." >&2
    echo "Listing library (first 50 files) so you can pick a name:" >&2
    docker exec "$CONTAINER" sh -c 'find /teddycloud/data/library -type f | head -n 50' >&2
    exit 1
fi

echo "Matches:"
printf '  %s\n' "${hits[@]}"

taf=""
for path in "${hits[@]}"; do
    case "$path" in
        *.taf|*.TAF) taf="$path"; break ;;
    esac
done
if [[ -z "$taf" ]]; then
    echo "Found JSON/text matches but no .taf. Open those files in the container and copy the TAF path listed there." >&2
    exit 1
fi

echo "Copying $taf -> $DEST"
mkdir -p "$(dirname "$DEST")"
docker cp "$CONTAINER:$taf" "$DEST"
ls -lh "$DEST"
echo "Done. Copy this file into the test sandbox library, not into the production volume."
