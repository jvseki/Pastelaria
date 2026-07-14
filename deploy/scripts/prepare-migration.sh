#!/usr/bin/env bash
set -euo pipefail

# Roda no servidor ATUAL (Hostinger) para gerar pacote de migracao ao VKNP.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

STAMP="$(date +%Y%m%d_%H%M%S)"
BUNDLE_DIR="/opt/pastelaria-migration-${STAMP}"
ARCHIVE="/opt/pastelaria-migration-${STAMP}.tar.gz"

mkdir -p "$BUNDLE_DIR"

echo ">> Gerando backup do PostgreSQL..."
bash "$ROOT/deploy/scripts/backup-db.sh" "$BUNDLE_DIR"

if [[ -f "$ROOT/.env" ]]; then
  cp "$ROOT/.env" "$BUNDLE_DIR/.env"
  echo ">> .env copiado para o pacote."
else
  echo "Aviso: .env nao encontrado. Configure manualmente no VKNP."
fi

cp "$ROOT/deploy/scripts/setup-vknp.sh" "$BUNDLE_DIR/"
cp "$ROOT/deploy/scripts/restore-db.sh" "$BUNDLE_DIR/"
cp "$ROOT/DEPLOY_VKNP.md" "$BUNDLE_DIR/"

cat > "$BUNDLE_DIR/LEIA-ME.txt" <<EOF
Pacote de migracao Pastelaria -> VKNP
Gerado em: $(date -Iseconds)
Servidor origem: $(hostname) ($(curl -4 -s ifconfig.me 2>/dev/null || echo "IP desconhecido"))

No servidor VKNP:
1. Copie este arquivo .tar.gz para o VKNP (scp)
2. Extraia: tar -xzf $(basename "$ARCHIVE") -C /opt
3. Siga as instrucoes em DEPLOY_VKNP.md
EOF

tar -czf "$ARCHIVE" -C "$(dirname "$BUNDLE_DIR")" "$(basename "$BUNDLE_DIR")"

echo ""
echo "Pacote pronto:"
echo "  Pasta:   $BUNDLE_DIR"
echo "  Arquivo: $ARCHIVE"
echo ""
echo "Copie para o VKNP:"
echo "  scp $ARCHIVE root@IP_DO_VKNP:/opt/"
