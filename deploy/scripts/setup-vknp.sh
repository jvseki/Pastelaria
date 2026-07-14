#!/usr/bin/env bash
set -euo pipefail

# Bootstrap inicial no servidor VKNP (Ubuntu/Debian).
# Uso: bash setup-vknp.sh [IP_ou_dominio]

set -x

PUBLIC_URL="${1:-}"
REPO_URL="${REPO_URL:-git@github.com:jvseki/Pastelaria.git}"
APP_DIR="${APP_DIR:-/opt/Pastelaria}"

apt-get update
apt-get install -y git curl ufw

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y docker-compose-plugin || true
fi

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  if [[ -f .env.vknp.example ]]; then
    cp .env.vknp.example .env
  else
    cp .env.example .env
  fi
fi

if [[ -n "$PUBLIC_URL" ]]; then
  sed -i "s|http://SEU_IP_VKNP|${PUBLIC_URL}|g" .env
  sed -i "s|http://SEU_IP_OU_DOMINIO|${PUBLIC_URL}|g" .env
fi

chmod +x deploy/scripts/*.sh

docker compose up -d --build

echo ""
echo "Setup concluido. Acesse: ${PUBLIC_URL:-http://$(curl -4 -s ifconfig.me)}"
echo "Proximo passo: restaurar banco com deploy/scripts/restore-db.sh"
