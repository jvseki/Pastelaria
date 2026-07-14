#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

OUT_DIR="${1:-$ROOT/backups}"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="$OUT_DIR/pastelaria_${STAMP}.sql"

mkdir -p "$OUT_DIR"

if ! docker compose ps --status running db 2>/dev/null | grep -q db; then
  echo "Erro: container db nao esta rodando. Execute: docker compose up -d"
  exit 1
fi

docker compose exec -T db pg_dump -U postgres --clean --if-exists pastelaria > "$OUT_FILE"
echo "Backup salvo em: $OUT_FILE"
