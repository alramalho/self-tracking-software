#!/usr/bin/env bash
set -euo pipefail

HOST="${REDIS_HOST:-127.0.0.1}"
PORT="${REDIS_PORT:-6379}"

if command -v nc >/dev/null 2>&1 && nc -z "$HOST" "$PORT" >/dev/null 2>&1; then
  echo "Redis is already reachable at $HOST:$PORT"
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Redis is not reachable at $HOST:$PORT and Docker is not installed." >&2
  exit 1
fi

echo "Redis is not reachable at $HOST:$PORT. Starting local Redis container..."
docker compose up -d redis

for _ in $(seq 1 20); do
  if command -v nc >/dev/null 2>&1 && nc -z "$HOST" "$PORT" >/dev/null 2>&1; then
    echo "Redis is ready at $HOST:$PORT"
    exit 0
  fi
  sleep 1
done

echo "Redis did not become reachable at $HOST:$PORT" >&2
docker compose ps redis >&2 || true
exit 1
