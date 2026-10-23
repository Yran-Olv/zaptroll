# MEMÓRIA VIVA & ESTADO ATUAL DO PROJETO ZAPTROLL
> **Objetivo**: Garantir que o desenvolvedor e a IA nunca percam o ritmo ou histórico de desenvolvimento entre sessões de chat.

---

## 📍 Sessão Atual (23/10/2026) — 🔑 ATIVAÇÃO DA KEY OFICIAL KORDIX TTS (ILIMITADA) & SEGURANÇA GIT
1. **Configuração Segura de Credenciais**:
   - Chave oficial adquirida configurada exclusivamente em arquivos locais e remotos `.env` (`KORDIX_API_KEY`), garantindo requisições ilimitadas.
   - Reforçada regra no `.gitignore` (`.env`, `.env.*`, `!.env.example`) impedindo qualquer vazamento acidental para repositórios Git.
   - `docker-compose.yml` atualizado apenas com o repasse referencial `${KORDIX_API_KEY:-}` e `${KORDIX_API_KEYS:-}` (sem chaves hardcoded).
   - Aplicado e validado no ambiente de produção (`77.37.41.172`), com o contêiner `zaptroll_backend` respondendo sem restrição da cota pública de 20 requisições.

2. **Otimizações de Alta Performance na Síntese (`KordixVoiceService.ts` & `VoiceCommandDispatcher.ts`)**:
   - **Cache em Memória LRU**: Armazena as últimas 120 sínteses com TTL de 24h. Solicitações de frases frequentes e memes em grupos respondem de forma **instantânea (< 100ms)** sem bater na API da Kordix nem reprocessar ffmpeg.
   - **Timeouts Seguros**: `AbortSignal.timeout(45000)` para a geração do áudio e `AbortSignal.timeout(30000)` para download na CDN, prevenindo requisições travadas caso a rede externa oscile.
   - **Tratamento Amigável de Chave Vencida**: Detecção automática de chave expirada com aviso orientando a renovação em `zone.api.br/store`.
   - **Cobertura de Testes**: 105 testes unitários passando em 11 suítes de teste (100% de sucesso).

---

## 📍 Sessão Atual (23/10/2026) — 🎥 SUPORTE A VÍDEO NATIVO NO STATUS / STORIES DE GRUPO
1. **Modal de Postar Status no Grupo com Suporte a Foto e Vídeo (`PostGroupStatusModal.tsx`)**:
   - A modal de Postar Status no Grupo agora suporta tanto **Fotos** quanto **Vídeos Nativos (Stories de Grupo - `groupStatusMessageV2`)**.
   - **Abas Inteligentes**:
     - `[📷 Foto / Banner]`: Aceita PNG, JPG, WEBP (até 10MB) com proporção recomendada 9:16.
     - `[🎥 Vídeo Nativo]`: Aceita MP4, MOV, WEBM, 3GP (até 16MB, limite oficial do WhatsApp).
   - **Player de Preview Integrado**:
     - Renderização em tempo real de `<video controls playsInline>` com auto-detecção de duração (`duration`) e tamanho (`MB`).
     - Alerta visual amigável caso o vídeo ultrapasse 30 segundos (`⚠️ Dica: Vídeos com mais de 30 segundos podem ser cortados nativamente pelo WhatsApp nos stories`).
     - Auto-switch inteligente: se o usuário selecionar um arquivo de vídeo enquanto a aba Foto estiver aberta (ou vice-versa), o modal detecta o tipo e chaveia de aba automaticamente.
   - **Legenda e Menção Fantasma**:
     - Preserva legenda contextual (0/1000 caracteres) com chips de atalho.
     - Preserva o switch de menção fantasma (todos os participantes notificados discretamente sem poluir a mídia com @).

2. **Backend Unificado (`advanced.controller.ts` & `StatusService.ts`)**:
   - O endpoint `POST /api/advanced/group-status` foi atualizado para receber `videoBase64`, `videoUrl`, `videoMimetype`, `seconds` e delegar para `StatusService.postStatus`.
   - Utiliza nativamente `ZapoMessageAdapter.sendGroupStatusVideo` (`groupStatusMessageV2` com `videoMessage`, nó `<meta is_group_status="true"/>`, `contextInfo.isGroupStatus = true` e array de menções fantasmas).
   - Registra o evento de story de vídeo no histórico do chat como `group_status_video` e emite via WebSocket (`new_message`) em tempo real.

---

## 📍 Sessão Anterior (22/10/2026) — 🎙️ SÍNTESE DE VOZES DE PERSONAGENS & FAMOSOS COM REAÇÃO WHATSAPP (&vozkordix / /voz)
1. **Engenharia Reversa & Implementação do Comando &vozkordix**:
   - **Identificação da API Kordix**:
     - Investigado o funcionamento dos bots brasileiros de WhatsApp que respondem ao comando `&vozkordix <personagem> | <texto>` (utilizado em grupos como "Laboratório Bots" `120363432289926956@g.us`).
     - Mapeada a integração oficial com a API do System Zero (`zone.api.br/api/tts-kordix`), com acesso a mais de 200 mil vozes e atalhos rápidos.
   - **Módulo Nativo de Síntese (`KordixVoiceService.ts`)**:
     - Suporte a personagens icônicos:
       - 🇧🇷 **Políticos**: Lula (`lula`, ID 782), Bolsonaro (`bolsonaro`, ID 790), Dilma (`dilma`).
       - 🧽 **Desenhos**: Bob Esponja (`bob_esponja`, ID 805), Pica-Pau (`pica_pau`, ID 173446), Mickey (`mickey_mouse`, ID 102), Chaves (`chaves`), Seu Madruga (`madruga`), Shrek (`shrek`), Homer Simpson (`homer_simpson`).
       - 💥 **Animes & Heróis**: Goku (`goku`, ID 108), Vegeta (`vegeta`, ID 935), Naruto (`naruto`), Batman (`batman`, ID 819).
       - 📺 **TV & Celebridades**: Silvio Santos (`silvio_santos`, ID 9280), Faustão (`faustao`, ID 135283), Mano Brown (`mano_brown`, ID 54606), Galvão Bueno (`galvao_bueno`), Elon Musk (`elon_musk`, ID 1), Cristiano Ronaldo (`cristiano_ronaldo`), Neymar (`neymar`).
     - Suporte dinâmico a pesquisa no catálogo completo: `&vozkordix buscar <termo>` ou `/voz buscar <termo>`.
     - **Compatibilidade Estrita iOS e Android (`CoreAudio` / `AVFoundation`)**:
       - Identificada a causa raiz do erro *"Não foi possível baixar o áudio"* no iOS: o container Alpine do backend não possuía o binário `ffmpeg`, fazendo o áudio cair no fallback MP3 cru sem cabeçalhos OggOpus e taxa de 48kHz esperada pelo WhatsApp.
       - Atualizado `backend/Dockerfile` instalando `ffmpeg` nativamente via `apk add --no-cache ffmpeg`.
       - Parâmetros rigorosos aplicados na conversão: `-c:a libopus -b:a 32k -vbr on -compression_level 10 -ar 48000 -ac 1` (Mono, 48.000 Hz, Libopus).
       - Injeção de `waveform` sonoro de 64 barras normalizadas para renderização das ondas no WhatsApp iOS e Android.
   - **Dispatcher de Comandos & Reações (`VoiceCommandDispatcher.ts` & `ZapoMessageAdapter.ts`)**:
     - Adicionado método nativo `ZapoMessageAdapter.sendReaction` utilizando os protocolos do `zapo-js`.
     - Reação em tempo real:
       - Ao receber o comando, reage instantaneamente com `🎙️` para indicar gravação em andamento.
       - Após o envio bem-sucedido do áudio, atualiza a reação para `🔊`.
       - Em caso de falha ou parâmetros ausentes, reage com `❌` e orienta o usuário com exemplos.
     - Suporte a múltiplos prefixos (`&vozkordix`, `/vozkordix`, `!vozkordix`, `&voz`, `/voz`, `!voz`, `/vozes`).
     - Tolerância a sintaxe: aceita com ou sem aspas, com barra vertical `|` ou espaço simples.
     - Persistência das mensagens de voz na base de dados e emissão de eventos em tempo real (`new_message`) via Socket.io para atualização imediata do painel web.
   - **Cobertura de Testes**:
     - Criado `backend/tests/voice_kordix.test.ts` com 10 testes cobrindo parsing de prefixos, resolução de apelidos de vozes, fluxo de reação e envio PTT.
     - 102 testes passando em 11 suítes de teste (100% de sucesso).

---

## 📍 Sessão Anterior (22/10/2026) — 🕹️ CORREÇÃO E REDESIGN DOS CONTROLES MOBILE DO JOGO RETRÔ (/jogo / DOOM SECTOR)
1. **Solução Definitiva do Corte de Controles em Smartphones e WhatsApp WebView**:
   - **Causa Raiz Identificada**:
     - No layout original, a div raiz utilizava `min-h-screen` (`100vh`), que no Safari iOS e WebView interna do WhatsApp não desconta a barra superior nem a barra de ferramentas inferior (~50-80px de obstrução).
     - Além disso, a altura do canvas possuía uma fórmula rígida `Math.min(window.innerHeight - 180, 500)` com `min-h-[300px]`, empurrando o deck de controles para fora da área visível da tela.
   - **Correção da Viewport e Safe Area**:
     - Container raiz configurado com `h-[100dvh] max-h-[100dvh] w-full overflow-hidden pb-safe pt-safe select-none touch-none`.
     - Utilização de `pb-safe` (`padding-bottom: max(16px, env(safe-area-inset-bottom, 16px))`) garantindo folga ergonômica total acima da barra do WhatsApp e home indicator do iPhone.
   - **Canvas Container Dinâmico e Sem Overflow**:
     - Container intermediário configurado com `flex-1 min-h-0 relative overflow-hidden`.
     - Implementado dimensionamento reativo via `ResizeObserver` e `logicalDimRef`, calculando o tamanho exato disponível sem empurrar os controles.
     - Suporte a telas Retina/DPR (`window.devicePixelRatio`) desenhando o canvas com nitidez 2x sem perda de resolução.

2. **Deck de Controles Arcade Móveis Refatorado e Ergonômico (`RetroGameView.tsx`)**:
   - **D-Pad Virtual Analógico 360°**:
     - Disco tátil circular moderno com marcadores direcionais neon (▲, ◀, ▼, ▶) que se iluminam ao inclinar.
     - Manete analógica flutuante que acompanha o polegar em tempo real com raio clamped de 34px.
     - Captura estrita de ponteiro (`setPointerCapture`) e cancelamento seguro, eliminando movimento travado/infinito quando o dedo desliza fora do botão.
   - **Controle Direto na Tela (Touch-to-Steer)**:
     - Adicionado suporte a arrasto direto sobre o canvas: o jogador pode tocar em qualquer ponto da tela para guiar a nave suavemente.
   - **Gatilho de Disparo FIRE e Modo AUTO-FIRE**:
     - Botão circular arcade `FIRE 🔥` de 80-88px com degradê carmim, sombra neon vibrante e feedback tátil háptico (`navigator.vibrate(15)`).
     - Novo botão seletor `⚡ AUTO [ON/OFF]`: permite disparo automático contínuo a cada 160ms para jogo com apenas uma mão.
   - **Recursos Sociais para Grupos do WhatsApp**:
     - Botão `📢 Compartilhar no Grupo WhatsApp` no Game Over com link `whatsapp://send?text=...`, permitindo desafiar os membros do grupo com a pontuação e wave alcançadas.
     - Persistência e exibição de recorde pessoal (`localStorage`).
     - Botão elegante `Voltar ao Chat` com fallback para `whatsapp://app`.

3. **Ativação de Comandos de Fluxo em Grupos do WhatsApp (`/jogo`, `/game`, `/teste`, `/menu`)**:
   - **Causa Raiz Identificada no ZapoEventHandler**:
     - O processamento de mensagens no `ZapoEventHandler.ts` continha a condição estrita `if (created && !fromMe && !isGroup && rawCommandText)`.
     - O operador `!isGroup` bloqueava 100% dos fluxos e comandos disparados dentro de qualquer grupo do WhatsApp (`@g.us`), e `!fromMe` impedia o dono do bot de homologar comandos pelo próprio aparelho conectado.
   - **Correção da Elegibilidade de Gatilho (`isEligibleFlowTrigger`)**:
     - Mensagens diretas privadas continuam acionando normalmente todos os fluxos.
     - Em grupos (`isGroup`), mensagens que comecem com `/` ou `!` (como `/jogo`, `/game`, `/teste`, `/menu`) agora acionam o `FlowEngine` de imediato, enquanto conversas normais são ignoradas para não poluir o grupo.
     - Mensagens enviadas pelo próprio dono (`fromMe`) com prefixo `/` ou `!` agora são processadas para teste e homologação.
   - **Preempção de Comandos e Variáveis de Remetente (`FlowEngine.ts`)**:
     - Quando um usuário digita um novo comando explícito (ex: `/jogo`), qualquer sessão anterior travada em `waiting_input` é automaticamente cancelada (`status: 'cancelled'`) para iniciar imediatamente o novo fluxo.
     - Injeção das variáveis `{ senderJid, senderName, isGroup }` na sessão para auditoria e suporte multi-participante.
   - Cobertura de testes unitários expandida para 92 testes passando com 100% de sucesso.

---

## 📍 Sessão Anterior (22/10/2026) — ⚡ FÍSICA VISUAL DE CONEXÕES (RAIO, ÍMÃ, RIPPLE E COMETAS) & PERSISTÊNCIA DE CONEXÃO WHATSAPP
1. **Persistência e Prioridade de Conexão WhatsApp**:
   - **Correção da Perda de Conexão / Fluxos Parando**:
     - Anteriormente, salvar o fluxo ou alterar a conexão criava uma nova versão com `isPublished: false`, fazendo o fluxo ativo parar no WhatsApp até ser republicado manualmente.
     - Atualizado `FlowController.saveVersion`: se o fluxo já estiver com status `published`, a nova versão salva mantém-se automaticamente publicada (`isPublished: true`), atualizando `publishedVersionId` e `publishedAt` de imediato.
     - Proteção contra perda de nós: quando uma requisição envia apenas a alteração de metadados (`connectionId`), o controller recupera os nós e edges da última versão existente em vez de zerar o grafo.
   - **Prioridade Estrita de Roteamento (`FlowEngine.findTriggeredFlow`)**:
     - Adicionada ordenação SQL inteligente (`CASE WHEN "Flow"."connectionId" = :connId THEN 0 ELSE 1 END`): mensagens recebidas de uma conexão WhatsApp específica (ex: `multivus`) agora têm prioridade máxima sobre fluxos genéricos com `connectionId: null`.
     - Auto-recuperação (self-heal): se `publishedVersionId` estiver nulo ou desatualizado, o motor busca automaticamente a versão mais recente e vincula na hora.
   - **Controle Direto na Lista de Fluxos (`FlowsListView.tsx`)**:
     - Adicionado seletor de conexão interativo diretamente no card de cada fluxo, permitindo vincular a `multivus` ou `Todas as Conexões` em 1 clique sem precisar entrar no editor.
     - Sincronização em tempo real de `flowsList` no `FlowStudioModal.tsx` ao alterar a conexão no cabeçalho.

2. **Física e Efeitos Visuais de Conexão Conforme Especificação Mestre (`FlowCanvas.tsx`)**:
   - **Repouso**:
     - Handles com anéis coloridos correspondentes à categoria/porta (Sucesso `#37DC7E`, Erro `#EF5050`, IA `#447AF7`, Botões `#447AF7`, Condição SIM/NÃO `#37DC7E` / `#EF5050`, DOOM `#9561eb`, Gatilho `#f59e0b`).
   - **Arrastando (Linha Neutra)**:
     - Linha de arraste com Bézier suave em cor neutra (`#F8F9FA`, 4px), halo luminoso de 10px a 15% de opacidade e ponta esférica de 11px acompanhando o cursor do mouse.
     - Handle de saída ganha anel neutro em destaque.
   - **Ímã e Raio Elétrico (Snap a 100px)**:
     - Quando o cursor se aproxima a até 100px de qualquer handle de entrada válido, o handle alvo entra em estado magnético: escala para `1.35x` em 160ms, miolo claro e anel de 2px com brilho radial de 16px na cor da porta.
     - Raio elétrico dinâmico de 10 segmentos gerado entre a ponta e o handle com amplitude de 7px (afunilando nas pontas), ruído neon na cor da porta, fio central branco de 1.2px, ramificação secundária a 80% e jitter de 20 Hz (50ms).
     - Ao soltar o mouse em qualquer ponto do raio de 100px, a conexão se concretiza automaticamente.
   - **Impacto / Conectou (0 a 250ms)**:
     - Flash luminoso na nova aresta (`anim-edge-flash`).
     - Efeito ripple de onda circular no handle alvo expandindo de `1.4x` para `2.2x` em 450ms.
     - Barra de luz vertical neon de 52px acendendo na borda esquerda do card por 250ms.
     - Brilho interno radial no card de 160px a 35% de opacidade por 700ms.
   - **Borda Correndo (250 a 900ms)**:
     - 2 cometas luminosos (cabeça de 15px e cauda de 46px) saem do handle alvo em sentidos opostos (um horário pelo topo, um anti-horário pela base) e contornam o card pela borda, extinguindo-se ao se encontrar do lado oposto após 900ms com curva cúbica ease-out.
   - **Assentado (> 900ms)**:
     - Transição suave para a aresta final limpa na cor da porta com marcador de seta neon.

3. **Deploy em Produção (`77.37.41.172`)**:
   - Compilação dos contêineres Docker Backend e Frontend atualizados.
   - URL de produção: **[https://zaptroll.multivus.com.br](https://zaptroll.multivus.com.br)**.

---

## 📍 Sessão Anterior (22/10/2026) — 🎮 BOTÃO WEBVIEW VISÍVEL NO TEMPLATE DE JOGO & GAME LAUNCHER
1. **Botão WebView Interativo no Card do Game Launcher (`FlowCanvas.tsx`)**:
   - O nó `game_launcher` (Jogo Web DOOM / RPG) exibia apenas o título do jogo em texto simples, omitindo o botão de ação.
   - Adicionado preview dinâmico no card exibindo o botão CTA configurado (ex: `🕹️ Jogar Agora 🚀`) com selo neon `WebView In-App` e badge da categoria (`Retro` ou `RPG`).

2. **Template de Jogo Oficial Alinhado (`templates/index.ts`)**:
   - O modelo `doom_game` foi atualizado para utilizar o bloco moderno nativo `game_launcher` ligado diretamente ao `trigger_keyword` (`Gatilho Jogo`).
   - Configurado por padrão com `buttonText: '🕹️ Jogar Agora'`, `presentation: 'full'` e `gameTitle: 'DOOM Sector Retrô Arcade'`, garantindo que novos fluxos criados a partir do template já nasçam prontos com o botão.

3. **Painel de Propriedades Completo (`NodePropertiesPanel.tsx`)**:
   - Adicionados campos para edição de:
     - `Título / Nome do Jogo` (`gameTitle`).
     - `Texto do Botão CTA (WebView)` (`buttonText`).
     - `Modo WebView (Dentro do WhatsApp)` (`presentation: 'full' | 'tall' | 'compact'`).
     - Prévia em tempo real do botão que o contato receberá no WhatsApp.

4. **Simulador de Fluxos & Chat (`FlowSimulatorModal.tsx` & `ChatView.tsx`)**:
   - `FlowSimulatorModal`: os eventos de `game_launcher` agora carregam `isGame: true` e exibem um botão arcade retrô estilizado em degradê magenta/roxo com ícone `Gamepad2` e badge `WebView`, abrindo o jogo diretamente.
   - `ChatView`: extração inteligente de botões `cta_url` em mensagens `nativeFlowMessage`, renderizando o botão de acesso à webview mesmo em histórico de mensagens interativas.
   - `FlowEngine`: inclusão do link de fallback direto no corpo da mensagem para garantir compatibilidade caso o cliente esteja no WhatsApp Web (que não renderiza botões nativos de flow).

---

## 📍 Sessão Anterior (22/10/2026) — 🚀 ORGANIZADOR AUTOMÁTICO DE FLUXOS (AUTO-LAYOUT), SETAS VISÍVEIS & LINHAS SUAVES
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

## 📍 Sessão Atual (22/10/2026 - Noite) — Síntese de Voz de Personagens & Celebridades (&voz / &vozkordix)

1. **Módulo de Síntese de Voz TTS (Kordix / System API's)**:
   - Implementado [KordixVoiceService.ts](file:///home/yran/Área%20de%20trabalho/zaptroll/backend/src/modules/voice/KordixVoiceService.ts) e [VoiceCommandDispatcher.ts](file:///home/yran/Área%20de%20trabalho/zaptroll/backend/src/modules/voice/VoiceCommandDispatcher.ts) para processamento do comando oficial do bot:
     `&voz <personagem> | <texto>` (ex: `&voz bolsonaro | o texto`), com suporte retroativo a `&vozkordix`, `/voz`, `!voz`, `.voz`.
   - Reação visual imediata no WhatsApp com `🎙️` durante a geração do áudio e substituição para `🔊` após entrega concluída (ou `❌` em caso de erro explicativo).
   - Integração direta em [ZapoEventHandler.ts](file:///home/yran/Área%20de%20trabalho/zaptroll/backend/src/integrations/zapo/ZapoEventHandler.ts) e suporte a reações no [ZapoMessageAdapter.ts](file:///home/yran/Área%20de%20trabalho/zaptroll/backend/src/integrations/zapo/ZapoMessageAdapter.ts).

2. **Compatibilidade Total com iOS (iPhone) e Android**:
   - Correção de reprodução de áudio no iOS: áudios MP3 simples em `ptt: true` falhavam no reprodutor de áudio nativo do iPhone (AVPlayer/CoreAudio).
   - Inclusão do `ffmpeg` no [backend/Dockerfile](file:///home/yran/Área%20de%20trabalho/zaptroll/backend/Dockerfile).
   - Conversão obrigatória para container OGG com codec Opus (`-c:a libopus -b:a 32k -vbr on -compression_level 10 -ar 48000 -ac 1`) e geração de waveform de 64 barras normalizadas para reprodução nativa de notas de voz.

3. **Correção de Vozes e Dublagem Brasileira Autêntica (Goku / Wendell Bezerra)**:
   - Investigado o catálogo de mais de 200 mil vozes da API. O termo genérico `goku` mapeava para o modelo em japonês (ID 108).
   - Localizado e fixado o ID oficial da dublagem clássica brasileira do Goku: **ID `10480`** (`"Goku ( original Wendell Bezerra)"`).
   - Mapeamento das principais vozes clássicas da cultura brasileira:
     - Goku: `10480` (Wendell Bezerra)
     - Vegeta: `188972` (Dado Monteiro)
     - Bob Esponja: `805` (Wendel Bezerra / Português)
     - Chaves: `36437` (Marcelo Gastaldi)
     - Seu Madruga: `18347` (Carlos Seidl)
     - Pica-Pau: `23360` (Português)
     - Homer Simpson: `85618` (Waldyr Sant'anna / PT-BR)
     - Batman: `239632` (Marcio Seixas / PT-BR)
     - Lula: `782`
     - Bolsonaro: `790`
     - Silvio Santos: `9280`
     - Faustão: `135283`
     - Mano Brown: `54606`
   - Normalização resiliente com `normalizeKey` (remoção de acentos, pontuação, hifens e espaços) garantindo que `silvio santos`, `silvio_santos`, `silviosantos` e apelidos encontrem o ID exato instantaneamente.

4. **Pool de Rotação Automática de Chaves de API (`KORDIX_API_KEYS`)**:
   - Implementado suporte a múltiplas chaves em `KORDIX_API_KEYS=key1,key2,key3`.
   - Distribuição de requisições por shuffle/random (load balancing).
   - Failover automático transparente: se uma chave bater na cota de 20 reqs ou der 403, o sistema tenta a próxima chave ativa do pool imediatamente antes de reportar erro ao usuário.

5. **Bateria de Testes e Qualidade**:
   - 11 testes unitários dedicados em [backend/tests/voice_kordix.test.ts](file:///home/yran/Área%20de%20trabalho/zaptroll/backend/tests/voice_kordix.test.ts).
   - Total de 103 testes passando em 11 suítes no backend (100% de sucesso).

6. **Correção de Comandos em Grupos Grandes (900+ Membros / Sender Keys & Retries)**:
   - Investigado o grupo `120363162040008527@g.us` ("Programadores BR²", 942 membros).
   - **Diagnóstico das duas causas raiz**:
     1. Stanzas de troca de chave pura (`senderKeyDistributionMessage` sem conteúdo de chat) não eram ignoradas e acabavam salvas como mensagens fake com conteúdo `[Mensagem não suportada ou formato especial]`, tomando o stanzaId.
     2. Em grupos gigantes, participantes frequentemente geram `message_unavailable` enquanto chaves de remetente (`missing sender key`) são sincronizadas. Quando o evento `message` com o texto descriptografado final chegava, `Message.findOrCreate` retornava `created = false`. Como os despachantes de comando (Voz, Meta AI, Jacaré, RPG, Flow Engine) condicionavam a execução estritamente a `if (created && ...)`, todos os comandos eram silenciosamente ignorados nesses grupos.
   - **Solução implementada em [ZapoEventHandler.ts](file:///home/yran/Área%20de%20trabalho/zaptroll/backend/src/integrations/zapo/ZapoEventHandler.ts)**:
     - Filtro para ignorar stanzas de protocolo que contenham unicamente `senderKeyDistributionMessage`.
     - Introduzida a flag `isNewOrUpgraded`: atualiza o conteúdo real e executa os comandos mesmo se a mensagem chegou inicialmente como placeholder indisponível e foi atualizada com o texto descriptografado.
     - Suporte a `quote` em mensagens de áudio (`ZapoMessageAdapter.sendAudio`) e resolução de `effectiveParticipant` para reações e citações em grupos.

---

## 📍 Sessão Anterior (22/10/2026 - Manhã) — Deploy Inicial da Arena RPG
- Deploy em produção (`77.37.41.172`) da Arena RPG e cartas colecionáveis.

