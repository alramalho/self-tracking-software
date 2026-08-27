#!/bin/sh
set -eu

deploy_dir=/root/tracking-so-hetzner
database_env="$deploy_dir/database-local.env"

if [ -s "$database_env" ]; then
  exit 0
fi

db_password=$(openssl rand -hex 32)

if docker exec platform-postgres psql -U postgres -d postgres -Atqc \
  "SELECT 1 FROM pg_roles WHERE rolname = 'tracking_app'" | grep -qx 1; then
  docker exec platform-postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "ALTER ROLE tracking_app PASSWORD '$db_password'"
else
  docker exec platform-postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE ROLE tracking_app LOGIN PASSWORD '$db_password'"
fi

if ! docker exec platform-postgres psql -U postgres -d postgres -Atqc \
  "SELECT 1 FROM pg_database WHERE datname = 'tracking'" | grep -qx 1; then
  docker exec platform-postgres createdb -U postgres -O tracking_app tracking
fi

docker exec platform-postgres psql -U postgres -d tracking -v ON_ERROR_STOP=1 \
  -c "CREATE EXTENSION IF NOT EXISTS vector"

umask 077
{
  printf 'DATABASE_URL=postgresql://tracking_app:%s@postgres:5432/tracking?schema=public\n' "$db_password"
  printf 'DIRECT_URL=postgresql://tracking_app:%s@postgres:5432/tracking?schema=public\n' "$db_password"
} > "$database_env"

chmod 600 "$database_env"
