# 🚀 Zaptroll — WhatsApp Developer Platform & Testing Lab

Plataforma Web (PWA) moderna, gratuita e independente do Whaticket para desenvolvedores conectarem números do WhatsApp e testarem recursos convencionais e avançados da biblioteca **[Zapo](https://zapo.to)** (`zapo-js` v1.10.0+), com PostgreSQL, Docker Compose e interface inspirada no **WhatsApp para iOS**.

---

## 📱 Recursos e Capacidades

- **Experiência Visual WhatsApp iOS:**
  - Interface minimalista com balões de mensagem estilizados (`#d9fdd3` para enviadas com checkmarks de entrega/leitura).
  - Padrão de fundo oficial WhatsApp.
  - Navegação inferior fluida no mobile (Conversas, Contatos, Grupos, Conexões e Admin).
  - Painel adaptável de 2 colunas para desktop.
  - Suporte a PWA instalável com manifest, service worker e isolamento seguro de cache.

- **Conexões WhatsApp Independentes:**
  - Gerenciador de conexões multiusuário com isolamento estrito.
  - Pareamento em tempo real via **QR Code** com rotação automática.
  - Pareamento via **Código de 8 dígitos** (`client.auth.requestPairingCode(phone)`).
  - Persistência das credenciais no PostgreSQL com `@zapo-js/store-postgres`.
  - Recuperação automática de conexões ativas após reinício do container.

- **Menu de Recursos Avançados (+ / <>) no Campo de Mensagem:**
  1. **Botões WhatsApp Business:** Configuração de cabeçalho, corpo, rodapé e até 3 botões de resposta rápida com pré-visualização visual em tempo real.
  2. **Lista e Menu de Opções:** Menu expansível com seções e linhas (títulos, descrições e identificadores) com preview interativo.
  3. **Webview (CTA URL):** Envio de botões nativos com link externo seguro (HTTPS e proteção contra SSRF).
  4. **Carrossel / Multi-Ação:** Cards e botões nativos com simulação visual horizontal.
  5. **Mensagens Temporárias (Efêmeras):**
     - Alternância de duração para a conversa inteira (24 horas, 7 dias, 90 dias ou desativar).
     - Mensagem efêmera individual por tempo em segundos.
     - Envio de teste experimental (`afterReadDuration`) com aviso técnico de compatibilidade de protocolo.
  6. **Código Bruto (Raw JSON / Proto Send):** Editor de código estruturado, modelos pré-definidos (Localização GPS, Cartão PIX Business, Contatos vCard) e inspetor de resposta e erro da API em tempo real.
  7. **Exclusão de Mensagens (Revoke):** Revogação para todos os participantes (`type: 'revoke'`) com diálogo de confirmação.

- **Painel Administrativo (`/admin`):**
  - Métricas da plataforma (usuários, conexões ativas, mensagens, sessões em memória).
  - Gestão de usuários, ativação, suspensão e ajuste de cotas de conexões e rate limits.
  - Histórico de auditoria de operações administrativas.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Socket.IO Client.
- **Backend:** Node.js 22, Express, TypeScript, Sequelize, PostgreSQL, Socket.IO, Zod, Helmet.
- **WhatsApp Engine:** `zapo-js` (1.10.0), `@zapo-js/store-postgres` (1.2.0), Pino.
- **Infraestrutura:** Docker, Docker Compose, Nginx.

---

## ⚡ Instalação Rápida com Docker Compose

### 1. Clonar o repositório e configurar variáveis
```bash
cp .env.example .env
```

### 2. Iniciar os serviços
```bash
docker compose up -d --build
```

Os seguintes serviços estarão disponíveis:
- **Frontend / PWA:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:3001/api](http://localhost:3001/api)
- **Healthcheck:** [http://localhost:3001/health](http://localhost:3001/health)

### 3. Primeiro Acesso
- O cadastro público é aberto e gratuito para qualquer usuário.
- O primeiro administrador é provisionado automaticamente com os dados definidos no `.env`:
  - **E-mail:** `admin@zaptroll.local`
  - **Senha:** `Admin@SecurePass2026!` *(Recomenda-se alterar em produção)*

---

## 💻 Executando em Modo Desenvolvimento Local

Caso prefira rodar fora do Docker:

### Requisitos:
- Node.js 20+ ou 22+
- PostgreSQL rodando localmente (ou `DB_DIALECT=sqlite` para testes rápidos em arquivo)

### Backend:
```bash
cd backend
npm install
npm run dev
```

### Frontend:
```bash
cd frontend
npm install
npm run dev
```
Acesse [http://localhost:3000](http://localhost:3000).

---

## 🧪 Executando os Testes Automatizados

O backend conta com suíte de testes com **Vitest**:
```bash
cd backend
npm test
```

---

## 📦 Backup e Restauração do Banco de Dados

### Criar backup:
```bash
./scripts/backup.sh
```
O arquivo SQL será salvo em `./backups/zaptroll_db_YYYYMMDD_HHMMSS.sql`.

### Restaurar backup:
```bash
./scripts/restore.sh ./backups/zaptroll_db_YYYYMMDD_HHMMSS.sql
```

---

## 🔍 Diagnóstico e Resolução de Problemas

- **Verificar logs do backend:**
  ```bash
  docker compose logs -f backend
  ```
- **Verificar status do PostgreSQL:**
  ```bash
  docker compose ps
  ```
- **Reiniciar os containers mantendo os dados persistidos:**
  ```bash
  docker compose restart
  ```
- **Aviso sobre mensagens temporárias após leitura (`afterReadDuration`):**
  O protocolo oficial do WhatsApp define expirações em nível de conversa (`EPHEMERAL_SETTING`) ou por mensagem (`expirationSeconds`). Parâmetros proprietários como `afterReadDuration` são enviados no payload de contexto para fins de teste e desenvolvimento, mas clientes padrão do WhatsApp podem não disparar o timer até que a mensagem atinja o TTL global.

---

## 📄 Licença
Distribuído sob licença MIT. Plataforma livre para uso e testes de desenvolvedores.
