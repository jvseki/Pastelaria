#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

SQL_FILE="${1:-}"

if [[ -z "$SQL_FILE" ]]; then
  SQL_FILE="$(ls -1t "$ROOT"/backups/pastelaria_*.sql 2>/dev/null | head -1 || true)"
  if [[ -z "$SQL_FILE" ]]; then
    SQL_FILE="$(ls -1t /opt/pastelaria-migration-*/pastelaria_*.sql 2>/dev/null | head -1 || true)"
  fi
fi

if [[ -z "$SQL_FILE" || ! -f "$SQL_FILE" ]]; then
  echo "Uso: $0 [arquivo.sql]"
  echo "Nenhum backup encontrado automaticamente."
  exit 1
fi

if ! docker compose ps --status running db 2>/dev/null | grep -q db; then
  echo "Erro: container db nao esta rodando. Execute: docker compose up -d"
  exit 1
fi

echo ">> Restaurando: $SQL_FILE"
docker compose exec -T db psql -U postgres -d pastelaria < "$SQL_FILE"
echo ">> Restore concluido."
