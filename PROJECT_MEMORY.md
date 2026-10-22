# MEMÓRIA VIVA & ESTADO ATUAL DO PROJETO ZAPTROLL
> **Objetivo**: Garantir que o desenvolvedor e a IA nunca percam o ritmo ou histórico de desenvolvimento entre sessões de chat.

---

## 📍 Sessão Atual (22/10/2026) — 🚀 ZAPTROLL FLOW STUDIO, MULTI-FLUXOS, IMPORT/EXPORT & SUÍTE MESTRE DE TESTES
 
1. **Flow Studio com Suporte a Múltiplos Fluxos, Importação/Exportação e Suíte de Testes**:
   - **Gerenciador de Múltiplos Fluxos**:
     - Botão `+ Novo Fluxo` destacado no cabeçalho com modal de criação rápida (nome, gatilhos, template inicial e conexão vinculada).
     - Seletor de fluxos com busca em tempo real (`flowSearchTerm`), clonagem instantânea (`handleDuplicateFlow` via `POST /api/flows/:id/duplicate`) e exclusão segura (`handleDeleteFlow` via `DELETE /api/flows/:id`).
   - **Importação e Exportação JSON**:
     - **Exportar (JSON)**: Baixa arquivo `zaptroll_fluxo_{nome}.json` com estrutura completa (nós, conexões, variáveis e gatilhos) e copia para área de transferência.
     - **Importar (JSON)**: Suporte a upload de arquivo `.json` ou colagem direta no editor com validação sintática, com opções de criar novo fluxo ou sobrescrever o canvas atual.
   - **Suíte Mestre de Testes (`full_demo_suite`)**:
     - Template padrão contendo todos os 11 blocos interligados: Gatilho ➔ Mensagem Boas-Vindas ➔ Botões Interativos ➔ Captura de Dados ➔ Condição Lógica ➔ Formulário Web Seguro ➔ Webhook HTTP ➔ Cobrança Pix ➔ Arcade DOOM ➔ Atraso ➔ Encerramento.
     - Permite homologar 100% dos recursos do Flow Studio em 1 clique.
   - **Simulador Interativo 100% Funcional**:
     - Conversor universal de eventos (`convertEventToChatMessage`) exibindo texto, botões clicáveis, formulários com link externo, dados Pix formatados, arcade game launcher e logs em tempo real.
   - **Configuração de Conexão WhatsApp por Fluxo**:
     - Seletor no cabeçalho permitindo vincular o fluxo a uma conexão específica (`multivus`) ou mantê-lo global para todas as conexões com salvamento automático.
   - **Resolução de Conflito de Interface**:
     - `TrollNotificationToast` reposicionado para `bottom-5 right-5 z-40` e `FlowStudioModal` elevado para `z-[60]`, garantindo que os botões de ação do topo nunca sejam cobertos por alertas.

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

