# MEMÓRIA VIVA & ESTADO ATUAL DO PROJETO ZAPTROLL
> **Objetivo**: Garantir que o desenvolvedor e a IA nunca percam o ritmo ou histórico de desenvolvimento entre sessões de chat.

---

## 📍 Sessão Atual (22/10/2026) — 🚀 ZAPTROLL FLOW STUDIO, MULTI-FLUXOS, IMPORT/EXPORT & SUÍTE MESTRE DE TESTES
 
2. **Aba Primária "Fluxos" e Visão de Lista de Fluxos (`FlowsListView`)**:
   - **Navegação Primária Destacada**:
     - Adicionada a aba `Fluxos` (ícone `Sparkles`) diretamente na barra de navegação principal do menu lateral (`MainLayout.tsx`) e na barra inferior mobile (`BottomTabBar.tsx`), eliminando a necessidade de buscar por botões escondidos.
     - Botão de ação rápida `⚡ Criar Fluxo` mantido no topo do menu lateral para abertura direta do canvas.
   - **Visão Central de Gestão (`FlowsListView.tsx`)**:
     - Dashboard com contadores de fluxos ativos/publicados, barra de busca por título e gatilhos de mensagem, e filtro rápido (Todos, Publicados, Rascunhos).
     - Cards detalhados com gatilhos configurados, data de atualização e ações diretas:
       - 1-clique para Ativar / Pausar atendimento no WhatsApp (`handleTogglePublish`).
       - Botão `Editar no Canvas` que abre o Flow Studio já focado no fluxo selecionado (`initialFlowId`).
       - Botão `Testar no Simulador` para homologar o percurso sem precisar de celular.
       - Ações de duplicar fluxo e exclusão segura.
   - **Auto-Seeding e Ativação Imediata**:
     - Atualizado `FlowController.list` para semear e marcar como `published` automaticamente a **Suíte Completa de Testes (`full_demo_suite`)** com todos os 11 blocos para qualquer usuário que não possua fluxos criados.
     - Auto-recuperação (self-heal) em `FlowEngine.findTriggeredFlow` para vincular automaticamente a versão publicada caso `publishedVersionId` esteja nulo.


2. **Alinhamento do Catálogo de Blocos (Frontend & Backend)**:
   - Contrato unificado em `backend/src/modules/flows/types/index.ts` e `frontend/src/types/flows.ts`.
   - Suporte nativo completo no `FlowEngine.ts` para todos os 11 blocos do editor:
     - `trigger_keyword`
     - `message_text`
     - `message_media`
     - `interactive_buttons` (com roteamento por `buttonId` e fallback para texto visível `displayText`)
     - `hosted_page_button` (CTA URL para formulário hospedado)
     - `data_capture` (com validações de texto, número, e-mail e telefone)
     - `condition` (operadores `equals`, `not_equals`, `contains`, `greater_than`, `less_than`, `exists`, com portas de saída `yes` e `no`)
     - `wait_delay` (atraso não-bloqueante simulado e real)
     - `http_request` (com proteção SSRF contra IPs privados e metadados de nuvem)
     - `pix_charge` (geração de payload Pix copia-e-cola e chave)
     - `game_launcher` (CTA URL direto para o DOOM Arcade ou Arena RPG)
     - `end_flow`
   - Compatibilidade retroativa mantida para aliases anteriores (`logic_condition`, `capture_*`, `commercial_pix_payment`, `logic_end`).
   - Bloqueio e registro de erro auditável caso nós desconhecidos sejam encontrados (sem descarte silencioso).

2. **Auditoria e Refatoração de Mensagens Temporárias (AutoDestruct)**:
   - Status honesto: substituído o status enganoso `confirmed` por `server_ack` no `AutoDestructTask.ts` e `AutoDestructService.ts`. O ACK do servidor WhatsApp confirma recebimento do pedido de revogação, mas não garante que aparelhos offline já tenham apagado a mensagem.
   - Persistência imediata antes do timer em memória, prevenindo perda de tarefas se o servidor reiniciar imediatamente após o envio.
   - Ticker de recuperação periódica em segundo plano (`startPeriodicRecovery(60000)`) além da recuperação inicial no startup.
   - Cobertura de 10 testes dedicados em `backend/tests/autodestruct.test.ts`.

3. **Páginas Web Hospedadas vs. Experiência no WhatsApp**:
   - Diferenciação clara: o WhatsApp não possui WebView nativa embutida na bolha de conversa. O Zaptroll envia botões CTA URL interativos que abrem em navegador responsivo externo/in-app do aparelho:
     - `/r/form/:publicId` (`HostedFormView.tsx`): Formulário responsivo com campos dinâmicos, validação e retomada imediata do fluxo via webhook interno.
     - `/r/jogos/:gameId` (`RetroGameView.tsx`): DOOM Arcade Canvas 60fps com touch controls e sintetizador de som Web Audio API.

4. **Stories com Vídeo e Status**:
   - `StatusService.ts` e `ZapoMessageAdapter.ts` suportam vídeo MP4/H.264 até 16MB via `sendStatusVideo` e `sendGroupStatusVideo`.
   - Testes unitários cobrem parâmetros, MIME type e SSRF (`status_video.test.ts`). Validação manual em aparelho real documentada na checklist.

5. **Testes Ponta a Ponta (E2E) e Resiliência**:
   - Criado `backend/tests/flow_journey_e2e.test.ts`:
     - Teste 1: Jornada completa de 10 nós (`trigger` -> `message_text` -> `interactive_buttons` -> `data_capture` -> `condition` -> `hosted_page_button` -> `http_request` -> `pix_charge` -> `game_launcher` -> `end_flow`).
     - Teste 2: Retomada e continuidade de sessão após reinicialização do backend / persistência de variáveis e histórico.
     - Teste 3: Isolamento estrito de sessões entre diferentes números de WhatsApp e conexões simultâneas.
   - Total de 91 testes passando (100% de sucesso) em 10 suítes de teste no backend. Frontend compilando sem erros em 1.97s.

6. **Deploy em Produção Atualizado (`77.37.41.172`)**:
   - Sincronização via rsync e recompilação Docker Compose do backend e frontend.
   - URL de produção: **[https://zaptroll.multivus.com.br](https://zaptroll.multivus.com.br)**.

---

## 📍 Sessão Anterior (22/10/2026 - Manhã) — Deploy Inicial da Arena RPG
- Deploy em produção (`77.37.41.172`) da Arena RPG e cartas colecionáveis.

