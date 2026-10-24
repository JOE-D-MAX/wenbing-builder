#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then
  echo 'Usage: sh deploy/restore-empty-volume.sh backups/your-backup.tar.gz' >&2
  exit 1
fi
archive="$1"
tar -tzf "$archive" >/dev/null
compose() { docker compose --env-file deploy/.env -f deploy/compose.yaml "$@"; }
# Never stop an existing live service while attempting a restore.
if [ -n "$(compose ps --status running --services app)" ]; then
  echo 'Restore refused: app is running. Use a fresh deployment with an empty volume.' >&2
  exit 1
fi
# Restore only into an empty volume. Existing customer data is never overwritten.
compose run --rm --no-deps -T --entrypoint sh app -c '
  if [ -n "$(find /data -mindepth 1 -maxdepth 1 -print -quit)" ]; then
    echo "Restore refused: /data is not empty. Use a fresh deployment volume." >&2
    exit 1
  fi
  tar -xzf - -C /data
' < "$archive"
compose up -d app
echo 'Restore finished. Check the app health before allowing customer traffic.'
