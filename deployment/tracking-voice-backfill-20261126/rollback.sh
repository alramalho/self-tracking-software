#!/usr/bin/env bash
# Back to coach-catchup-20261126 (26 Nov). Code-only.
set -euo pipefail
cd /root/workspace/tracking.so/deployment
live=$(docker inspect --format "{{.Config.Image}}" tsw-backend)
[ "$live" = "local/tracking-so-backend:voice-backfill-20261126" ] || { echo "Live image is $live, not voice-backfill-20261126; refusing." >&2; exit 1; }
cp tracking-voice-backfill-20261126/backup/deployment.env .env; chmod 600 .env
docker compose up -d --no-deps backend
for i in $(seq 1 60); do curl --fail --silent https://api.tracking.so/health && echo && exit 0; sleep 2; done
echo 'Backend did not answer health after rollback' >&2; exit 1
