# MEMÓRIA VIVA & ESTADO ATUAL DO PROJETO ZAPTROLL
> **Objetivo**: Garantir que o desenvolvedor e a IA nunca percam o ritmo ou histórico de desenvolvimento entre sessões de chat.

---

## 📍 Sessão Atual (22/10/2026) — ✅ DEPLOY EM PRODUÇÃO CONCLUÍDO

1. **Deploy em Produção (`77.37.41.172`)**:
   - Código sincronizado e containers `zaptroll_backend` e `zaptroll_frontend` recompilados e reiniciados com sucesso.
   - Aplicação online respondendo `200 OK` em: **[https://zaptroll.multivus.com.br](https://zaptroll.multivus.com.br)**.

2. **Novidades Entregues no Deploy**:
   - **RPG Arena Web 2.5D:** 16 ilustrações oficiais de cartas colecionáveis WebP, componente [`RpgCombatCard.tsx`](frontend/src/components/rpg/RpgCombatCard.tsx) e modal de inspeção de cartas em tela cheia.
   - **Vídeo nos Status WhatsApp:** Suporte a upload e postagem de status com vídeo (`videoUrl`, `videoBase64`, `videoMimetype`, `seconds`) no [`advanced.controller.ts`](backend/src/modules/advanced/advanced.controller.ts) e [`StatusService.ts`](backend/src/modules/advanced/StatusService.ts).
   - **Repositório Oficial em Primeiro Lugar:** Card do Dev Tools e documentação destacando **[`https://github.com/Yran-Olv/zaptroll.git`](https://github.com/Yran-Olv/zaptroll.git)** em primeiro lugar, com créditos compactos para `zapo-interactive-examples` e `zapo-js`.
   - **Layout da Sidebar:** Abas e botões rápidos redistribuídos para evitar que qualquer aba seja cortada ou fique invisível.
   - **Mídias de Visualização Única:** Interceptação automática e download permanente de arquivos temporários.

3. **Configuração Global de Persistência de Chat na IDE**:
   - Ajustadas as preferências globais do Antigravity IDE (`~/.config/AntigravityIDE/User/settings.json`) para restaurar automaticamente a última sessão ativa (`chat.restoreLastPanelSession: true`), exibir a lista de conversas lado a lado (`chat.viewSessions.enabled: true`, `chat.viewSessions.orientation: "sideBySide"`) e carregar regra de continuidade global (`~/.gemini/config/rules/continuity.md`).

---

## 📍 Sessão Anterior (19/10/2026)

### 1. 🃏 Artes & Sistema Visual das 16 Cartas do RPG (WebView 2.5D)
- Geradas 16 ilustrações em alta resolução estilo card game satírico em WebP em `frontend/public/rpg/cards/`:
  - **Força:** *Soco Demagógico, Chute de Comício, Investida da Bancada, Golpe Constitucional, Ataque Combinado de Chapa*.
  - **Defesa:** *Bloqueio Regimental, Esquiva com Foro Privilegiado, Contra-Ataque de CPI, Fundo Partidário Protetor*.
  - **Estratégia:** *Disparo de Fake News, Pedido de Vista Suspensivo, Instalação de CPI, Acordo Suprapartidário, Convocação de Suplente*.
  - **Utilidade/Blefe:** *Finta do Mandato, Deboche em Rede Nacional*.
- Componente [`RpgCombatCard.tsx`](frontend/src/components/rpg/RpgCombatCard.tsx) e modal de inspeção em tela cheia na arena.
- Backend alimentando cartas em [`RpgSeedService.ts`](backend/src/modules/rpg/services/RpgSeedService.ts) e [`rpg.controller.ts`](backend/src/modules/rpg/controllers/rpg.controller.ts).

### 2. 🖥️ Layout da Sidebar & Abas Superlotadas
- Grids independentes para ferramentas rápidas (`Dev Tools`, `Status`, `Memes`, `RPG`) e abas principais (`Conversas`, `Contatos`, `Grupos`, `Sessões`, `Admin`).

### 3. 👁️ Mídias de Visualização Única (View-Once)
- Download e persistência de arquivos de visualização única do WhatsApp.

### 4. 🥊 Narração do RPG no WhatsApp em Tempo Real
- Edição in-place das mensagens no WhatsApp (`zapo.sendMessageEdit`) e links curtos com Base62.

---

## ⚠️ Estado dos Arquivos Locais (Prontos para Commit / Deploy)
- `backend/src/modules/advanced/advanced.controller.ts`
- `backend/src/modules/rpg/controllers/rpg.controller.ts`
- `backend/src/modules/rpg/models/RpgCard.ts`
- `backend/src/modules/rpg/services/RpgSeedService.ts`
- `frontend/src/components/connections/ConnectionsView.tsx`
- `frontend/src/components/dev/DevToolsModal.tsx`
- `frontend/src/components/groups/GroupsView.tsx`
- `frontend/src/components/layout/MainLayout.tsx`
- `frontend/src/components/rpg/RpgArenaView.tsx`
- `frontend/src/components/rpg/RpgCombatCard.tsx`
- `frontend/public/rpg/cards/` (16 arquivos .webp)
- `README.md`
- `PROJECT_MEMORY.md`
- `.agents/rules/project-continuity.md`
- `GEMINI.md`
