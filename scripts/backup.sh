#!/usr/bin/env bash
set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/zaptroll_db_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

echo "📦 Criando backup do banco de dados Zaptroll PostgreSQL..."

docker compose exec -T postgres pg_dump -U zaptroll_user -d zaptroll_db > "$BACKUP_FILE"

echo "✅ Backup concluído com sucesso: $BACKUP_FILE"
