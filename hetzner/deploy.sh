#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE="hetzner/.env.prod"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found. Copy hetzner/.env.example and fill in." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${HETZNER_HOST:?HETZNER_HOST not set in $ENV_FILE}"
: "${GITHUB_DEPLOY_TOKEN:?GITHUB_DEPLOY_TOKEN not set in $ENV_FILE}"

HOST="$HETZNER_HOST"
USER="root"
REPO="https://${GITHUB_DEPLOY_TOKEN}@github.com/alramalho/self-tracking-software.git"
REMOTE_DIR="/root/tracking-so"
SSH_KEY="$HOME/.ssh/hetzner"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no"

# --- Pre-flight: uncommitted changes ---
if [ -n "$(git status --porcelain)" ]; then
  echo "==> Uncommitted changes detected:"
  git status --short
  echo ""
  read -p "Commit all changes before deploying? [y/N] " REPLY
  if [[ "$REPLY" =~ ^[Yy]$ ]]; then
    read -p "Commit message: " MSG
    git add -A
    git commit -m "$MSG"
  else
    read -p "Deploy anyway with uncommitted changes? [y/N] " REPLY2
    if [[ ! "$REPLY2" =~ ^[Yy]$ ]]; then
      echo "Aborted."
      exit 0
    fi
  fi
fi

# --- Pre-flight: sync with origin/main ---
echo "==> Fetching origin/main..."
git fetch --quiet origin main

REMOTE_AHEAD=$(git log HEAD..origin/main --oneline 2>/dev/null || true)
if [ -n "$REMOTE_AHEAD" ]; then
  echo "==> origin/main has commits not on local HEAD:"
  echo "$REMOTE_AHEAD"
  read -p "Pull --ff-only before deploying? [Y/n] " REPLY
  if [[ ! "$REPLY" =~ ^[Nn]$ ]]; then
    git pull --ff-only origin main
  fi
fi

LOCAL_AHEAD=$(git log origin/main..HEAD --oneline 2>/dev/null || true)
if [ -n "$LOCAL_AHEAD" ]; then
  echo "==> Local commits not on origin/main:"
  echo "$LOCAL_AHEAD"
  read -p "Push to origin/main before deploying? [Y/n] " REPLY
  if [[ ! "$REPLY" =~ ^[Nn]$ ]]; then
    git push origin main
    echo "==> Waiting 5s for GitHub to propagate..."
    sleep 5
  fi
fi

# --- Upload env file ---
echo "==> Ensuring remote dir exists..."
ssh $SSH_OPTS "$USER@$HOST" "mkdir -p $REMOTE_DIR/hetzner"

echo "==> Uploading $ENV_FILE → $REMOTE_DIR/hetzner/.env..."
scp $SSH_OPTS "$ENV_FILE" "$USER@$HOST:$REMOTE_DIR/hetzner/.env"

# --- Remote: clone/pull + build + up ---
echo "==> Connecting to $HOST..."
ssh $SSH_OPTS "$USER@$HOST" bash -s -- "$REPO" "$REMOTE_DIR" <<'REMOTE'
set -euo pipefail
REPO="$1"
DIR="$2"

if ! command -v docker &>/dev/null; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
fi

if [ ! -d "$DIR/.git" ]; then
  echo "==> Cloning repo into $DIR..."
  # Preserve any pre-existing files (like .env we just uploaded)
  TMP=$(mktemp -d)
  git clone "$REPO" "$TMP"
  mkdir -p "$DIR"
  cp -a "$TMP/." "$DIR/"
  rm -rf "$TMP"
else
  echo "==> Pulling latest in $DIR..."
  cd "$DIR"
  git fetch origin main
  git reset --hard origin/main
fi

cd "$DIR/hetzner"

echo "==> Ensuring Redis is running..."
docker compose up -d redis
for i in $(seq 1 20); do
  if docker compose exec -T redis redis-cli ping | grep -q PONG; then
    echo "==> Redis is ready"
    break
  fi
  if [ "$i" = "20" ]; then
    echo "Redis failed to become ready" >&2
    docker compose ps
    exit 1
  fi
  sleep 1
done

echo "==> Building and starting containers..."
docker compose up --build -d
docker image prune -f

echo "==> Containers:"
docker compose ps
REMOTE

# --- Smoke test ---
echo "==> Smoke testing https://api.tracking.so/health..."
for i in $(seq 1 10); do
  code=$(curl -s -o /dev/null -w "%{http_code}" https://api.tracking.so/health || true)
  echo "attempt $i: HTTP $code"
  if [[ "$code" == "200" ]]; then
    echo "==> Deploy complete!"
    exit 0
  fi
  sleep 10
done
echo "Health check failed after 10 attempts" >&2
exit 1
