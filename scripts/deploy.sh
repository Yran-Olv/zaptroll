#!/usr/bin/env bash
set -e

HOST="77.37.41.172"
DEST="/home/deploy/zaptroll"

echo "🚀 Sincronizando código com o servidor ${HOST}..."
rsync -avz \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'uploads' \
  --exclude 'media' \
  --exclude '*.log' \
  ./ root@${HOST}:${DEST}/

echo "🔄 Recompilando containers na VPS..."
ssh -o BatchMode=yes root@${HOST} "cd ${DEST} && docker compose build backend frontend && docker compose up -d backend frontend"

echo "✅ Deploy concluído com sucesso!"
