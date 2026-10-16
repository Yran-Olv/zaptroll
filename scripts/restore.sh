#!/usr/bin/env bash
set -e

if [ -z "$1" ]; then
  echo "Uso: ./scripts/restore.sh <caminho_do_arquivo.sql>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Arquivo não encontrado: $BACKUP_FILE"
  exit 1
fi

echo "⚠️  Restaurando banco de dados Zaptroll a partir de $BACKUP_FILE..."

docker compose exec -T postgres psql -U zaptroll_user -d zaptroll_db < "$BACKUP_FILE"

echo "✅ Restauração concluída com sucesso!"
