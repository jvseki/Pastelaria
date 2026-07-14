#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo ">> Atualizando codigo..."
git pull --ff-only origin main

echo ">> Rebuild e restart dos containers..."
docker compose up -d --build

echo ">> Status:"
docker compose ps
