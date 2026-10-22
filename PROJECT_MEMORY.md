# MEMÓRIA VIVA & ESTADO ATUAL DO PROJETO ZAPTROLL
> **Objetivo**: Garantir que o desenvolvedor e a IA nunca percam o ritmo ou histórico de desenvolvimento entre sessões de chat.

---

## 📍 Sessão Atual (22/10/2026) — 🚀 ORGANIZADOR AUTOMÁTICO DE FLUXOS (AUTO-LAYOUT), SETAS VISÍVEIS & LINHAS SUAVES
1. **Organizador Automático de Fluxos (Auto-Layout DAG / Árvore)**:
   - **Motor de Posicionamento Inteligente (`flowLayoutUtils.ts`)**:
     - Algoritmo baseado em DAG / BFS que calcula a profundidade de cada nó e organiza o fluxo em colunas horizontais limpas (espaçamento de 120px).
     - Roteamento de ramos paralelos: quando um nó possui múltiplos botões ou desvios condicionais, cada ramo é alocado em trilhas verticais separadas (ex: Ramo A na trilha superior `y: 40`, Ramo B na trilha inferior `y: 280`), eliminando o problema de blocos misturados e fios atravessando cartas.
     - Convergência inteligente: nós de junção (como Delay e Fim) calculam a média das posições Y de seus nós pais e são centralizados perfeitamente entre os ramos.
     - Resolução de colisões 2D: algoritmo que detecta sobreposições na mesma coluna e afasta os nós automaticamente com folga mínima de 160px.
   - **Acesso Rápido no Flow Studio (`FlowStudioModal.tsx` & `FlowCanvas.tsx`)**:
     - Botão `Organizar` no cabeçalho superior com ícone `Workflow` em destaque roxo cyberpunk.
     - Botão complementar `Organizar` na barra de ferramentas flutuante do canvas (ao lado de zoom e centralizar).
     - Suporte a Undo/Redo (`Ctrl+Z` / `Ctrl+Y`) para que o usuário possa experimentar a organização automática e desfazer se desejar.

2. **Correção das Linhas de Conexão Tortas e Setas Ocultas**:
   - **Tangentes Horizontais Naturais**:
     - Anteriormente, conexões verticais sofriam distorção na curva de Bézier, fazendo a linha mergulhar de cima para baixo de forma torta no topo do conector.
     - Atualizado `calculatePath` no `FlowCanvas.tsx` para garantir tangentes horizontais estritas tanto no ponto de saída (`sx + controlDist, sy`) quanto no ponto de entrada (`tx - controlDist, ty`). Mesmo em desvios verticais ou reversos, a curva contorna com suavidade e entra perfeitamente na horizontal pela esquerda do nó.
   - **Setas Perfeitamente Visíveis**:
     - O conector de entrada HTML (handle circular de 24px com fundo escuro e borda) ficava sobreposto ao SVG e ocultava completamente o marcador da seta desenhado no centro (`tx = targetNode.position.x`).
     - Corrigido o ponto alvo para a borda externa do handle (`tx = targetNode.position.x - 2`), mantendo o centro vertical exato (`ty = position.y + 48`).
     - Marcadores SVG redefinidos com `refX="8"`, `markerWidth="7-8"` e `orient="auto"` com cores neon (`#39ff14` ativo e `#64748b` inativo), garantindo visualização nítida de todas as setas.

3. **Suíte Demonstrativa Atualizada em Trilhas Paralelas (`templates/index.ts`)**:
   - O modelo `full_demo_suite` agora nasce com suas 11 funções perfeitamente distribuídas em trilhas paralelas:
     - Gatilho (`x: 60, y: 150`) -> Boas-vindas (`x: 420, y: 150`) -> Menu de Seleção (`x: 780, y: 150`).
     - Trilha Superior (Botão 1): Captura (`1160, 40`) -> Condição (`1540, 40`) -> Formulário Web (`1920, 40`) -> HTTP Webhook (`2300, 40`).
     - Trilha Inferior (Botão 2): Pix Dinâmico (`1160, 280`) -> Jogo Retrô DOOM (`1540, 280`).
     - Ponto de Convergência: Atraso (`2680, 160`) -> Fim do Atendimento (`3040, 160`).

---

## 📍 Sessão Anterior (22/10/2026) — 🚀 ZAPTROLL FLOW STUDIO, MULTI-FLUXOS, IMPORT/EXPORT & SUÍTE MESTRE DE TESTES
 
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

3. **Experiência WebView In-App no WhatsApp (Sem Sair do App)**:
   - **Correção da Abertura Externa**:
     - Anteriormente, botões `cta_url` eram enviados apenas com `display_text` e `url`, fazendo com que o cliente móvel do WhatsApp acionasse o navegador externo padrão do sistema operacional (Chrome / Safari).
     - Atualizado `ZapoMessageAdapter.sendWebview`, `sendCarousel` e `FlowEngine.ts` para injetar os parâmetros nativos do protocolo de interação:
       - `webview_presentation: 'full' | 'tall' | 'compact'` (força a renderização em modal/bottom-sheet interno do WhatsApp).
       - `webview_interaction: true` (habilita interação total do usuário, digitação em inputs e execução de scripts dentro do webview).
       - `merchant_url: data.url` (garante o contexto de domínio verificado do comerciante).
   - **Controle no Editor e UX**:
     - Adicionado seletor no painel de propriedades (`NodePropertiesPanel.tsx`) permitindo escolher entre `📱 Tela Cheia (full)`, `📄 Aba Alta (tall)` ou `📑 Compacto (compact)`.
     - `HostedFormView.tsx` atualizado com botão de ação direta "Concluir e Retornar ao WhatsApp" após a submissão dos dados.

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

