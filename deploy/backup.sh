#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
umask 077
mkdir -p backups
archive="backups/wenbing-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
partial="$archive.partial"
compose() { docker compose --env-file deploy/.env -f deploy/compose.yaml "$@"; }
if [ -e "$archive" ] || [ -e "$partial" ]; then
  echo 'A backup with this timestamp exists; try again later.' >&2
  exit 1
fi
compose stop app
resume() { compose start app >/dev/null; }
trap resume EXIT HUP INT TERM
# Stop writes before capturing the entire directory, including any SQLite WAL.
compose run --rm --no-deps -T --entrypoint tar app -C /data -czf - . > "$partial"
tar -tzf "$partial" >/dev/null
mv "$partial" "$archive"
echo "Backup saved: $archive"
