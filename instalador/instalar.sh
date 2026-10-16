#!/usr/bin/env bash
# ==============================================================================
# ZAPTROLL MEME LAB — INSTALADOR INTERATIVO PARA VPS (UBUNTU / DEBIAN)
# ==============================================================================
# Uso interativo:
#   sudo bash instalador/instalar.sh
# ==============================================================================

set -euo pipefail

# Cores e Estilos
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

if [[ "${EUID}" -ne 0 ]]; then
  echo -e "${RED}[ERRO] Execute o instalador como root: sudo bash instalador/instalar.sh${NC}" >&2
  exit 1
fi

if [[ ! -f /etc/os-release ]] || ! grep -qEi 'ubuntu|debian' /etc/os-release; then
  echo -e "${RED}[ERRO] Este instalador foi desenvolvido para sistemas Ubuntu/Debian.${NC}" >&2
  exit 1
fi

SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Modo Interativo vs Automação
INTERACTIVE=1
if [[ "${1:-}" == "--yes" || "${1:-}" == "-y" || "${NON_INTERACTIVE:-0}" == "1" ]]; then
  INTERACTIVE=0
fi

# Funções Auxiliares
ask() {
  local prompt="$1" default="${2:-}" env_override="${3:-}" value
  if [[ "$INTERACTIVE" == "0" ]]; then
    if [[ -n "$env_override" && -n "${!env_override:-}" ]]; then
      printf '%s\n' "${!env_override}"
    else
      printf '%s\n' "$default"
    fi
    return 0
  fi

  if [[ -n "$default" ]]; then
    read -r -p "$(echo -e "${CYAN}${prompt}${NC} [${YELLOW}${default}${NC}]: ")" value
    printf '%s\n' "${value:-$default}"
  else
    read -r -p "$(echo -e "${CYAN}${prompt}${NC}: ")" value
    printf '%s\n' "$value"
  fi
}

valid_domain() {
  [[ "$1" =~ ^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[A-Za-z]{2,}$ ]]
}

# Verificação rigorosa se a porta está em uso
port_busy() {
  local port="$1"
  # 1. ss check
  if ss -ltnH 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:|\\])${port}$"; then
    return 0
  fi
  # 2. lsof check
  if command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    return 0
  fi
  # 3. Docker proxy / container mappings check
  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Ports}}' 2>/dev/null | grep -Eq "(^|:|\->)${port}/"; then
    return 0
  fi
  return 1
}

# Obter processo que está usando a porta
get_port_process() {
  local port="$1"
  local info
  info="$(ss -ltnpH 2>/dev/null | awk -v port="$port" '$4 ~ ":" port "$" {print $NF}' | tr -d '\n' || true)"
  if [[ -n "$info" ]]; then
    printf '%s' "$info"
  else
    printf 'Serviço em execução no sistema/Docker'
  fi
}

# Sugerir a próxima porta livre a partir de um valor base
suggest_port() {
  local port="$1"
  while port_busy "$port"; do
    port=$((port + 1))
    if (( port > 65535 )); then
      echo -e "${RED}[ERRO] Nenhuma porta livre encontrada até 65535.${NC}" >&2
      exit 1
    fi
  done
  printf '%s\n' "$port"
}

# Pergunta uma porta e NUNCA aceita uma porta já em uso!
ask_port() {
  local prompt="$1" base_suggestion="$2" value suggestion
  suggestion="$(suggest_port "$base_suggestion")"

  while true; do
    value="$(ask "$prompt" "$suggestion")"

    # Validação de formato numérico
    if [[ ! "$value" =~ ^[0-9]+$ ]] || (( value < 1 || value > 65535 )); then
      echo -e "${RED}[!] Porta inválida! Digite um número entre 1 e 65535.${NC}" >&2
      continue
    fi

    # REGRA CRÍTICA: NUNCA PERMITIR PORTA OCUPADA!
    if port_busy "$value"; then
      local proc
      proc="$(get_port_process "$value")"
      echo -e "${RED}[BLOQUEADO] A porta ${BOLD}${value}${NC}${RED} JÁ ESTÁ EM USO! (${proc})${NC}" >&2
      echo -e "${YELLOW}Por segurança, portas em uso não podem ser selecionadas.${NC}" >&2
      suggestion="$(suggest_port $((value + 1)))"
      echo -e "${GREEN}Próxima porta livre recomendada: ${BOLD}${suggestion}${NC}" >&2
      continue
    fi

    # Porta livre e válida!
    printf '%s\n' "$value"
    return 0
  done
}

# Banner Meme Lab
clear 2>/dev/null || true
cat << "EOF"
==============================================================================
   ___________ _____ _____ _____ _____ _     _     
  |___  /  _  |  _  |_   _|_   _|  _  | |   | |    
     / /| | | | |_| | | |   | | | | | | |   | |    
    / / | |_| |  __/  | |   | | | |_| | |___| |___ 
   /_/  \___,_|_|     \_/   \_/ \___,_|_____|_____|
               MEME & TROLL LAB v2.0
==============================================================================
EOF
echo -e "${GREEN}${BOLD}Iniciando configuração de produção do Zaptroll...${NC}\n"

# 1. Usuário do sistema
APP_USER="$(ask "Usuário do sistema para o Zaptroll" "deploy")"
if [[ ! "$APP_USER" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]]; then
  echo -e "${RED}[ERRO] Nome de usuário inválido.${NC}" >&2
  exit 1
fi

# 2. Pasta de instalação
DEFAULT_DIR="/home/${APP_USER}/zaptroll"
INSTALL_DIR="$(ask "Pasta de instalação" "$DEFAULT_DIR")"
INSTALL_DIR="${INSTALL_DIR%/}"
if [[ "$INSTALL_DIR" != /* ]]; then
  echo -e "${RED}[ERRO] A pasta precisa ser um caminho absoluto (ex.: /home/deploy/zaptroll).${NC}" >&2
  exit 1
fi

# 3. Domínio
DOMAIN=""
while [[ -z "$DOMAIN" ]]; do
  DOMAIN="$(ask "Domínio apontado para esta VPS (ex.: zaptroll.multivus.com.br)" "zaptroll.multivus.com.br")"
  DOMAIN="${DOMAIN,,}"
  if ! valid_domain "$DOMAIN"; then
    echo -e "${RED}[ERRO] Formato de domínio inválido!${NC}" >&2
    DOMAIN=""
    continue
  fi
done

# Verificação de DNS
echo -e "\n${BLUE}Verificando apontamento DNS de ${BOLD}${DOMAIN}${NC}..."
RESOLVED_IPS="$(getent ahosts "$DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u || true)"
SERVER_IP="$(curl -s --max-time 4 https://api.ipify.org || hostname -I | awk '{print $1}')"

if [[ -n "$RESOLVED_IPS" ]]; then
  echo -e "${GREEN}✓ Domínio resolvendo para: ${RESOLVED_IPS//$'\n'/, }${NC}"
  if echo "$RESOLVED_IPS" | grep -q "$SERVER_IP"; then
    echo -e "${GREEN}✓ IP do servidor (${SERVER_IP}) bate diretamente com o DNS.${NC}"
  else
    echo -e "${YELLOW}ℹ O IP difere ou está passando por proxy/Cloudflare (${RESOLVED_IPS//$'\n'/, }). Isso é normal em CDNs com proxy ativo.${NC}"
  fi
else
  echo -e "${YELLOW}[AVISO] O DNS ainda não parece estar propagado localmente.${NC}"
fi

# 4. E-mail do Administrador / Certbot
LE_EMAIL="$(ask "E-mail de contato para o certificado SSL" "admin@${DOMAIN}")"

# 5. Seleção rigorosa de Portas
echo -e "\n${PURPLE}${BOLD}[SELEÇÃO DE PORTAS INTERNAS]${NC}"
echo -e "O Nginx da VPS encaminhará as requisições do domínio para a porta interna do Zaptroll."
echo -e "O instalador verifica ativamente todas as portas e ${RED}${BOLD}NUNCA permite portas já usadas${NC}.\n"

# Sugere a partir de 18182 (porta padrão da linha multivus na VPS)
WEB_PORT="$(ask_port "Porta interna do frontend/painel (127.0.0.1)" 18182)"

# 6. Credenciais de Super Administrador
ADMIN_EMAIL="admin@zaptroll.local"
ADMIN_PASSWORD=""
if [[ -f "$INSTALL_DIR/.env" ]]; then
  echo -e "\n${YELLOW}Já existe uma instalação anterior em ${INSTALL_DIR}. Preservando credenciais e chaves.${NC}"
  ADMIN_EMAIL="$(grep -E '^FIRST_ADMIN_EMAIL=' "$INSTALL_DIR/.env" | head -1 | cut -d= -f2- || echo "admin@zaptroll.local")"
else
  ADMIN_EMAIL="$(ask "E-mail de login do primeiro administrador" "admin@${DOMAIN}" "ADMIN_EMAIL")"
  if [[ "$INTERACTIVE" == "0" ]]; then
    ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@Zaptroll2026!}"
  else
    while true; do
      read -r -s -p "$(echo -e "${CYAN}Senha do primeiro administrador (mínimo 8 caracteres)${NC}: ")" ADMIN_PASSWORD
      echo
      if ((${#ADMIN_PASSWORD} >= 8)); then
        break
      fi
      echo -e "${RED}A senha precisa ter pelo menos 8 caracteres.${NC}" >&2
    done
  fi
fi

# Resumo e Confirmação
echo -e "\n${BOLD}==============================================================================${NC}"
echo -e "${BOLD}RESUMO DA INSTALAÇÃO:${NC}"
echo -e "  Usuário:     ${GREEN}${APP_USER}${NC}"
echo -e "  Pasta:       ${GREEN}${INSTALL_DIR}${NC}"
echo -e "  Domínio:     ${GREEN}https://${DOMAIN}${NC}"
echo -e "  Porta Local: ${GREEN}127.0.0.1:${WEB_PORT}${NC}"
echo -e "  Admin:       ${GREEN}${ADMIN_EMAIL}${NC}"
echo -e "${BOLD}==============================================================================${NC}"

CONFIRM="$(ask "Deseja prosseguir com a instalação agora? (sim/nao)" "sim")"
if [[ "$CONFIRM" != "sim" && "$CONFIRM" != "s" ]]; then
  echo -e "${YELLOW}Instalação cancelada pelo usuário.${NC}"
  exit 0
fi

# 7. Instalação de Dependências do Sistema
echo -e "\n${BLUE}1/6. Atualizando pacotes e instalando dependências...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg nginx certbot python3-certbot-nginx rsync openssl

if ! command -v docker >/dev/null 2>&1; then
  echo -e "${BLUE}Instalando Docker Engine...${NC}"
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

# Criar usuário do sistema se não existir
if id "$APP_USER" >/dev/null 2>&1; then
  echo -e "Usuário ${APP_USER} já existe."
else
  useradd --create-home --shell /bin/bash "$APP_USER"
  echo -e "Usuário ${APP_USER} criado."
fi
usermod -aG docker "$APP_USER" || true

# 8. Sincronização dos arquivos do projeto
echo -e "\n${BLUE}2/6. Sincronizando arquivos do Zaptroll para ${INSTALL_DIR}...${NC}"
mkdir -p "$INSTALL_DIR" /var/www/certbot

if [[ "$(realpath "$SOURCE")" != "$(realpath "$INSTALL_DIR")" ]]; then
  rsync -a --delete \
    --exclude node_modules \
    --exclude dist \
    --exclude .git \
    --exclude .env \
    --exclude .instalador.env \
    "$SOURCE"/ "$INSTALL_DIR"/
fi

# 9. Configuração do arquivo de Ambiente (.env)
echo -e "\n${BLUE}3/6. Gerando credenciais seguras e arquivo de ambiente...${NC}"
if [[ ! -f "$INSTALL_DIR/.env" ]]; then
  JWT_SECRET="$(openssl rand -hex 32)"
  DB_PASSWORD="$(openssl rand -hex 24)"

  umask 077
  cat > "$INSTALL_DIR/.env" <<EOF
# ==========================================
# ZAPTROLL - PRODUÇÃO
# ==========================================
NODE_ENV=production
PORT=3001
WEB_BIND=127.0.0.1
WEB_PORT=${WEB_PORT}
FRONTEND_PORT=${WEB_PORT}
APP_URL=https://${DOMAIN}

# Banco de Dados PostgreSQL Interno Docker
DATABASE_URL=postgres://zaptroll_user:${DB_PASSWORD}@postgres:5432/zaptroll_db
DB_HOST=postgres
DB_PORT=5432
DB_USER=zaptroll_user
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=zaptroll_db

# Segurança e Sessão
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=10

# Primeiro Administrador
FIRST_ADMIN_NAME=Admin Zaptroll
FIRST_ADMIN_EMAIL=${ADMIN_EMAIL}
FIRST_ADMIN_PASSWORD=${ADMIN_PASSWORD}

# Limites e Quotas
DEFAULT_MAX_CONNECTIONS_PER_USER=10
DEFAULT_RATE_LIMIT_PER_MINUTE=1000

# WhatsApp Engine (Zapo)
ZAPO_STORE_PREFIX=wa_
CACHE_CLEANUP_INTERVAL_MS=60000

# CORS
CORS_ORIGIN=https://${DOMAIN},http://${DOMAIN}
EOF
  umask 022
else
  # Atualiza porta e domínio se mudou
  sed -i "s/^WEB_PORT=.*/WEB_PORT=${WEB_PORT}/" "$INSTALL_DIR/.env" || echo "WEB_PORT=${WEB_PORT}" >> "$INSTALL_DIR/.env"
  sed -i "s|^APP_URL=.*|APP_URL=https://${DOMAIN}|" "$INSTALL_DIR/.env" || true
  sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=https://${DOMAIN},http://${DOMAIN}|" "$INSTALL_DIR/.env" || true
fi

# Salvar metadados do instalador
umask 077
cat > "$INSTALL_DIR/.instalador.env" <<EOF
APP_USER=${APP_USER}
INSTALL_DIR=${INSTALL_DIR}
DOMAIN=${DOMAIN}
WEB_PORT=${WEB_PORT}
LE_EMAIL=${LE_EMAIL}
EOF
umask 022

chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR"
chmod 600 "$INSTALL_DIR/.env" "$INSTALL_DIR/.instalador.env"

# 10. Construção e Execução dos Contêineres Docker
echo -e "\n${BLUE}4/6. Construindo e subindo contêineres Docker...${NC}"
cd "$INSTALL_DIR"
docker compose down --remove-orphans 2>/dev/null || true
docker compose up -d --build

# Aguardar inicialização do banco e restaurar backup se existir
if [[ -f "$INSTALL_DIR/backup.sql" && ! -f "$INSTALL_DIR/.db_restored" ]]; then
  echo -e "${BLUE}Aguardando PostgreSQL para restaurar backup.sql...${NC}"
  for j in {1..25}; do
    if docker exec zaptroll_postgres pg_isready -U zaptroll_user -d zaptroll_db >/dev/null 2>&1; then
      sleep 2
      docker exec -i zaptroll_postgres psql -U zaptroll_user -d zaptroll_db < "$INSTALL_DIR/backup.sql" >/dev/null 2>&1 || true
      touch "$INSTALL_DIR/.db_restored"
      echo -e "${GREEN}✓ Banco de dados inicial restaurado com sucesso!${NC}"
      docker restart zaptroll_backend >/dev/null 2>&1 || true
      break
    fi
    sleep 2
  done
fi

if [[ -d "$INSTALL_DIR/media_initial" && ! -f "$INSTALL_DIR/.media_restored" ]]; then
  echo -e "${BLUE}Restaurando arquivos de mídia para o volume Docker...${NC}"
  docker cp "$INSTALL_DIR/media_initial/." zaptroll_backend:/app/uploads/media/ >/dev/null 2>&1 || true
  touch "$INSTALL_DIR/.media_restored"
  echo -e "${GREEN}✓ Arquivos de mídia restaurados!${NC}"
fi

# Aguardar saúde dos contêineres
echo -e "${BLUE}Aguardando inicialização dos serviços...${NC}"
for i in {1..30}; do
  if curl -s -f "http://127.0.0.1:${WEB_PORT}/" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend e proxy interno respondendo em 127.0.0.1:${WEB_PORT}!${NC}"
    break
  fi
  sleep 2
done

# 11. Configuração do Nginx da VPS com WebSockets e SSL
echo -e "\n${BLUE}5/6. Configurando Nginx e WebSockets para ${DOMAIN}...${NC}"
NGINX_SITE="/etc/nginx/sites-available/${DOMAIN}.conf"
NGINX_LINK="/etc/nginx/sites-enabled/${DOMAIN}.conf"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"

configure_nginx() {
  local with_ssl=0
  if [[ -f "${CERT_DIR}/fullchain.pem" && -f "${CERT_DIR}/privkey.pem" ]]; then
    with_ssl=1
  fi

  if [[ "$with_ssl" == "1" ]]; then
    cat > "$NGINX_SITE" <<EOF
# Configuração Nginx para Zaptroll Meme Lab (HTTPS + HTTP Redirect)
server {
    listen [::]:443 ssl;
    listen 443 ssl;
    server_name ${DOMAIN};

    ssl_certificate ${CERT_DIR}/fullchain.pem;
    ssl_certificate_key ${CERT_DIR}/privkey.pem;
$( [[ -f /etc/letsencrypt/options-ssl-nginx.conf ]] && echo "    include /etc/letsencrypt/options-ssl-nginx.conf;" )
$( [[ -f /etc/letsencrypt/ssl-dhparams.pem ]] && echo "    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;" )

    client_max_body_size 100M;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://127.0.0.1:${WEB_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}
EOF
  else
    cat > "$NGINX_SITE" <<EOF
# Configuração Nginx para Zaptroll Meme Lab (HTTP Inicial)
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 100M;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://127.0.0.1:${WEB_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
EOF
  fi

  ln -sfn "$NGINX_SITE" "$NGINX_LINK"
  nginx -t
  systemctl reload nginx
}

configure_nginx

# 12. Emissão do Certificado SSL com Certbot
echo -e "\n${BLUE}6/6. Emitindo e configurando Certificado SSL Let's Encrypt...${NC}"

if [[ ! -f "${CERT_DIR}/fullchain.pem" ]]; then
  echo -e "Solicitando certificado SSL para ${DOMAIN}..."
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$LE_EMAIL" --redirect || {
    echo -e "${YELLOW}[AVISO] O certbot automático encontrou uma restrição (comum quando o domínio está com proxy Cloudflare ativo).${NC}"
    echo -e "${YELLOW}Tentando método webroot standalone...${NC}"
    certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" --non-interactive --agree-tos -m "$LE_EMAIL" || true
  }
  # Reaplicar configuração do Nginx com SSL se o certificado foi gerado
  configure_nginx
fi

if [[ -f "${CERT_DIR}/fullchain.pem" ]]; then
  echo -e "${GREEN}✓ Certificado SSL ativo com sucesso!${NC}"
else
  echo -e "${YELLOW}ℹ O site está operando via HTTP. Se o seu domínio estiver no Cloudflare com SSL Flexível/Full, ele já abrirá com cadeado seguro.${NC}"
fi

# Ajustar firewall se UFW estiver ativo
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
fi

# Sucesso!
echo -e "\n${GREEN}${BOLD}==============================================================================${NC}"
echo -e "${GREEN}${BOLD}🚀 ZAPTROLL INSTALADO COM SUCESSO EM PRODUÇÃO!${NC}"
echo -e "${BOLD}==============================================================================${NC}"
echo -e "  🌐 URL:               ${CYAN}https://${DOMAIN}${NC}"
echo -e "  👤 Usuário Admin:     ${GREEN}${ADMIN_EMAIL}${NC}"
echo -e "  🔌 Porta Interna:     ${YELLOW}127.0.0.1:${WEB_PORT}${NC}"
echo -e "  📁 Diretório:         ${GREEN}${INSTALL_DIR}${NC}"
echo -e "${BOLD}==============================================================================${NC}\n"
exit 0
