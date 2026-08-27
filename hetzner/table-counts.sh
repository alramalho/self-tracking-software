#!/bin/sh
set -eu

connection_url=${1:?usage: table-counts.sh postgresql-url}

psql "$connection_url" -Atqc \
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename" \
  | while IFS= read -r table_name; do
      row_count=$(psql "$connection_url" -Atqc \
        "SELECT count(*) FROM public.\"$table_name\"")
      printf '%s,%s\n' "$table_name" "$row_count"
    done
