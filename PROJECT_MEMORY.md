# MEMÓRIA VIVA & ESTADO ATUAL DO PROJETO ZAPTROLL
> **Objetivo**: Garantir que o desenvolvedor e a IA nunca percam o ritmo ou histórico de desenvolvimento entre sessões de chat.

---

## 📍 Sessão Atual (22/10/2026) — 🚀 ZAPTROLL FLOW STUDIO & CORREÇÃO COMPLETA ZAPO

1. **Zaptroll Flow Studio (Construtor Visual de Fluxos WhatsApp)**:
   - Substituição do antigo painel de payloads pelo **Flow Studio completo** inspirado no WA Flow Builder e Typebot.
   - **Canvas Visual Interativo (`FlowCanvas.tsx`)**: nós estilizados com cores por categoria, conexões Bézier SVG dinâmicas, pan, zoom (40% a 200%), arrastar/soltar, duplicar e excluir nós.
   - **Biblioteca com 11 Blocos Tipados**:
     - *Gatilho Palavra-chave (`trigger_keyword`)*
     - *Mensagem de Texto com Interpolação `{{var}}` (`message_text`)*
     - *Mídia Imagem / Vídeo (`message_media`)*
     - *Botões Interativos com saídas individuais (`interactive_buttons`)*
     - *Formulário Web Hospedado via CTA URL (`hosted_page_button`)*
     - *Captura de Dados com validação (`data_capture`)*
     - *Condição / Desvio Lógico com ramificações Sim/Não (`condition`)*
     - *Espera / Atraso configurável (`wait_delay`)*
     - *Requisição HTTP Segura com Escudo SSRF (`http_request`)*
     - *Cobrança Pix Dinâmica (`pix_charge`)*
     - *Jogo Web DOOM / Arena RPG (`game_launcher`)*
     - *Encerrar Fluxo (`end_flow`)*
   - **Inspetor Lateral (`NodePropertiesPanel.tsx`)**: edição em tempo real de schemas, botões, variáveis, condições e chaves Pix.
   - **Simulador Interativo em Tempo Real (`FlowSimulatorModal.tsx`)**: sandbox de conversa com clique direto nos botões, inspetor de variáveis ao vivo, logs e realce visual dos nós ativos no canvas.
   - **Galeria de Modelos Prontos (`TemplateSelectorModal.tsx`)**: 5 templates pré-configurados prontos para uso (Boas-vindas, Pedido com Formulário Hospedado, Checkout Pix, Arena RPG, Jogo Retrô DOOM).
   - **Matriz de Diagnóstico Zapo (`FlowDiagnosticsModal.tsx`)**: status real por recurso, limitações conhecidas no Android/iOS/Web e planos alternativos transparentes.

2. **Páginas Web Hospedadas Responsivas (`/r/...`)**:
   - **Formulário Seguro (`/r/form/:publicId` - `HostedFormView.tsx`)**: renderização dinâmica de campos (texto, e-mail, telefone, número, textarea), validação client-side e envio para `/api/flows/public/form/:publicId/submit`, que retoma a conversa no WhatsApp automaticamente.
   - **DOOM Sector Retrô Arcade (`/r/jogos/:gameId` - `RetroGameView.tsx`)**: jogo 60fps em HTML5 Canvas, controles por toque na tela (D-Pad virtual + botão FIRE) para mobile e teclado (WASD + Espaço) no desktop, áudio sintetizado em tempo real via Web Audio API.

3. **Motor de Execução de Fluxos (`FlowEngine.ts`)**:
   - Máquina de estados multi-turn persistida com isolamento por conexão e JID do usuário.
   - Modelos Sequelize: `Flow`, `FlowVersion`, `FlowSession`, `FlowExecutionEvent` e `FormSubmission`.
   - **Segurança SSRF Rígida (`SafeHttpClient.ts`)**: bloqueio de IPs privados (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x, CGNAT), metadados de nuvem e validação de DNS rebinding.

4. **Correção das Mensagens Temporárias (AutoDestruct)**:
   - Migrado para o modelo PostgreSQL `AutoDestructTask.ts` com estados auditáveis: `scheduled`, `processing`, `request_sent`, `confirmed`, `retrying`, `failed`, `cancelled`.
   - Recuperação paginada no startup, backoff exponencial com jitter e isolamento multi-conexão verificado.

5. **Publicação de Status / Stories com Vídeo**:
   - Adicionado `sendStatusVideo` e `sendGroupStatusVideo` (`groupStatusMessageV2`) no `ZapoMessageAdapter.ts` e `StatusService.ts`.
   - Limite de 16MB, validação de MIME type real e proteção SSRF em mídias remotas.

6. **Validação e Testes**:
   - **Backend:** 83/83 testes unitários passando em 9 arquivos de teste (`npm run test` com exit code 0; `tsc` com 0 erros).
   - **Frontend:** Build de produção Vite gerado com sucesso em 2.45s (`dist/` compilado, `tsc --noEmit` sem erros).

7. **Deploy em Produção Concluído (`77.37.41.172`)**:
   - Sincronização e recompilação concluída com sucesso via Docker Compose.
   - Banco de dados PostgreSQL sincronizou todos os novos modelos (`AutoDestructTask`, `Flow`, `FlowVersion`, `FlowSession`, `FlowExecutionEvent`, `FormSubmission`).
   - Sessão WhatsApp restaurada e conectada automaticamente.
   - Servidor respondendo `HTTP/2 200 OK` em **[https://zaptroll.multivus.com.br](https://zaptroll.multivus.com.br)**.

---

## 📍 Sessão Anterior (22/10/2026 - Manhã) — Deploy Inicial da Arena RPG
- Deploy em produção (`77.37.41.172`) da Arena RPG e cartas colecionáveis.

