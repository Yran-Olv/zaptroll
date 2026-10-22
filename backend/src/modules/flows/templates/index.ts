export interface FlowTemplateDefinition {
  id: string;
  name: string;
  category: 'onboarding' | 'commercial' | 'forms' | 'games' | 'rpg';
  description: string;
  triggerKeywords: string[];
  tags: string[];
  nodes: any[];
  edges: any[];
  variables?: any[];
}

export const FLOW_TEMPLATES: Record<string, FlowTemplateDefinition> = {
  welcome_menu: {
    id: 'welcome_menu',
    name: 'Atendimento & Menu de Opções',
    category: 'onboarding',
    description: 'Menu inicial com botões rápidos direcionando para suporte, catálogo ou falar com atendente.',
    triggerKeywords: ['/inicio', 'oi', 'ola', 'menu', 'atendimento'],
    tags: ['Atendimento', 'Botões', 'Início'],
    nodes: [
      {
        id: 'trigger_welcome',
        type: 'trigger_keyword',
        name: 'Gatilho de Mensagem',
        position: { x: 50, y: 150 },
        data: { keywords: ['/inicio', 'oi', 'ola', 'menu'] },
      },
      {
        id: 'msg_welcome',
        type: 'message_text',
        name: 'Boas-vindas',
        position: { x: 300, y: 150 },
        data: { text: '👋 Olá! Seja muito bem-vindo ao atendimento automatizado do ZapTroll.' },
      },
      {
        id: 'btn_menu',
        type: 'interactive_buttons',
        name: 'Menu Principal',
        position: { x: 580, y: 150 },
        data: {
          text: 'Como podemos te ajudar hoje? Selecione uma das opções abaixo:',
          footerText: 'ZapTroll Flow Studio',
          buttons: [
            { id: 'opt_suporte', text: '🛠️ Suporte Técnico' },
            { id: 'opt_planos', text: '📦 Consultar Planos' },
            { id: 'opt_humano', text: '👤 Falar com Humano' },
          ],
        },
      },
      {
        id: 'msg_suporte',
        type: 'message_text',
        name: 'Resposta Suporte',
        position: { x: 920, y: 50 },
        data: { text: '🛠️ Você escolheu Suporte Técnico. Por favor, descreva em poucas palavras o problema que você está enfrentando:' },
      },
      {
        id: 'msg_planos',
        type: 'message_text',
        name: 'Resposta Planos',
        position: { x: 920, y: 170 },
        data: { text: '📦 Conheça nossos planos: Básico (R$ 49/mês), Pro (R$ 99/mês) e Enterprise com fluxos ilimitados!' },
      },
      {
        id: 'msg_humano',
        type: 'message_text',
        name: 'Transferência Humana',
        position: { x: 920, y: 290 },
        data: { text: '👤 Perfeito! Notificamos um de nossos atendentes. Em instantes você será atendido.' },
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger_welcome', target: 'msg_welcome' },
      { id: 'e2', source: 'msg_welcome', target: 'btn_menu' },
      { id: 'e3', source: 'btn_menu', sourceHandle: 'opt_suporte', target: 'msg_suporte' },
      { id: 'e4', source: 'btn_menu', sourceHandle: 'opt_planos', target: 'msg_planos' },
      { id: 'e5', source: 'btn_menu', sourceHandle: 'opt_humano', target: 'msg_humano' },
    ],
  },

  order_delivery_form: {
    id: 'order_delivery_form',
    name: 'Pedido de Produto com Formulário Web & Entrega',
    category: 'commercial',
    description: 'Fluxo comercial com botão CTA que abre página de formulário web responsiva para coletar nome, telefone e endereço de entrega.',
    triggerKeywords: ['/pedido', 'comprar', 'fazer pedido', 'lanche', 'delivery'],
    tags: ['Comercial', 'Formulário Web', 'Delivery'],
    nodes: [
      {
        id: 'trg_order',
        type: 'trigger_keyword',
        name: 'Gatilho Pedido',
        position: { x: 50, y: 150 },
        data: { keywords: ['/pedido', 'comprar', 'fazer pedido'] },
      },
      {
        id: 'msg_order_intro',
        type: 'message_text',
        name: 'Apresentação Cardápio',
        position: { x: 300, y: 150 },
        data: { text: '🍔 Ótima escolha! Para montar seu pedido com segurança e calcular o frete certinho, preencha o formulário rápido a seguir:' },
      },
      {
        id: 'btn_form_open',
        type: 'hosted_page_button',
        name: 'Abrir Formulário Web',
        position: { x: 580, y: 150 },
        data: {
          text: 'Clique no botão abaixo para abrir nosso formulário exclusivo de entrega:',
          buttonText: '📝 Preencher Pedido',
          pageType: 'form',
          formSchema: {
            title: 'Formulário de Entrega & Pedido',
            description: 'Informe seus dados para envio rápido e sem erros.',
            fields: [
              { name: 'nome', label: 'Nome Completo', type: 'text', required: true },
              { name: 'telefone', label: 'Telefone de Contato', type: 'tel', required: true },
              { name: 'produto', label: 'Item Desejado', type: 'select', options: ['Combo Burger Artesanal (R$ 38)', 'Pizza Família (R$ 65)', 'Açaí Turbo 500ml (R$ 22)'], required: true },
              { name: 'endereco', label: 'Rua e Número', type: 'text', required: true },
              { name: 'bairro', label: 'Bairro', type: 'text', required: true },
              { name: 'cidade', label: 'Cidade', type: 'text', required: true },
              { name: 'observacao', label: 'Ponto de Referência / Complemento', type: 'text', required: false },
            ],
          },
        },
      },
      {
        id: 'msg_order_confirmed',
        type: 'message_text',
        name: 'Confirmação do Pedido',
        position: { x: 880, y: 150 },
        data: { text: '🎉 *Pedido Confirmado com Sucesso!*\n\nRecebemos seus dados:\n👤 Nome: {{nome}}\n📦 Item: {{produto}}\n📍 Endereço: {{endereco}}, {{bairro}} - {{cidade}}\n\nSeu pedido já foi enviado para a cozinha e logo estará a caminho!' },
      },
    ],
    edges: [
      { id: 'e_o1', source: 'trg_order', target: 'msg_order_intro' },
      { id: 'e_o2', source: 'msg_order_intro', target: 'btn_form_open' },
      { id: 'e_o3', source: 'btn_form_open', target: 'msg_order_confirmed' },
    ],
  },

  pix_checkout: {
    id: 'pix_checkout',
    name: 'Cobrança Pix Instantânea com Chave & QR Code',
    category: 'commercial',
    description: 'Envia dados de pagamento Pix com chave copia e cola e botão de confirmação para o cliente.',
    triggerKeywords: ['/pix', 'pagar', 'pagamento', 'chave pix'],
    tags: ['Pix', 'Financeiro', 'Instantâneo'],
    nodes: [
      {
        id: 'trg_pix',
        type: 'trigger_keyword',
        name: 'Gatilho Pix',
        position: { x: 50, y: 150 },
        data: { keywords: ['/pix', 'pagar', 'pagamento'] },
      },
      {
        id: 'node_pix_charge',
        type: 'commercial_pix_payment',
        name: 'Dados do Pix',
        position: { x: 320, y: 150 },
        data: {
          amount: '49.90',
          pixKey: 'multivus@zaptroll.local',
        },
      },
      {
        id: 'btn_pix_confirm',
        type: 'interactive_buttons',
        name: 'Botão Já Efetuei Pagamento',
        position: { x: 620, y: 150 },
        data: {
          text: 'Após realizar a transferência no seu aplicativo bancário, clique abaixo:',
          buttons: [
            { id: 'btn_paid', text: '✅ Já Efetuei o Pagamento' },
            { id: 'btn_help_pix', text: '❓ Preciso de Ajuda' },
          ],
        },
      },
      {
        id: 'msg_pix_thanks',
        type: 'message_text',
        name: 'Agradecimento',
        position: { x: 920, y: 100 },
        data: { text: '✅ Agradecemos! Estamos validando a compensação bancária e seu comprovante será emitido em breve.' },
      },
      {
        id: 'msg_pix_help',
        type: 'message_text',
        name: 'Ajuda Pix',
        position: { x: 920, y: 220 },
        data: { text: 'ℹ️ Caso tenha tido alguma dificuldade com o Pix, envie o comprovante diretamente aqui nesta conversa.' },
      },
    ],
    edges: [
      { id: 'ep1', source: 'trg_pix', target: 'node_pix_charge' },
      { id: 'ep2', source: 'node_pix_charge', target: 'btn_pix_confirm' },
      { id: 'ep3', source: 'btn_pix_confirm', sourceHandle: 'btn_paid', target: 'msg_pix_thanks' },
      { id: 'ep4', source: 'btn_pix_confirm', sourceHandle: 'btn_help_pix', target: 'msg_pix_help' },
    ],
  },

  rpg_arena: {
    id: 'rpg_arena',
    name: 'Duelo na Arena RPG com Link Web',
    category: 'rpg',
    description: 'Convite para o RPG de Luta Política satírico do ZapTroll com abertura da arena visual 2.5D no navegador.',
    triggerKeywords: ['/duelo', '/rpg', 'lutar', 'desafio'],
    tags: ['RPG', 'Luta Política', 'WebView'],
    nodes: [
      {
        id: 'trg_rpg',
        type: 'trigger_keyword',
        name: 'Gatilho RPG',
        position: { x: 50, y: 150 },
        data: { keywords: ['/duelo', '/rpg', 'lutar'] },
      },
      {
        id: 'msg_rpg_intro',
        type: 'message_text',
        name: 'Aviso de Combate',
        position: { x: 300, y: 150 },
        data: { text: '⚔️ *DESAFIO NA ARENA POLÍTICA!* 🏛️\nVocê foi convocado para a batalha satírica pelo destino de Brasília. Escolha suas cartas e mande ver no comício!' },
      },
      {
        id: 'btn_arena',
        type: 'hosted_page_button',
        name: 'Abrir Arena de Luta',
        position: { x: 580, y: 150 },
        data: {
          text: 'Clique abaixo para entrar na arena visual com animações 2.5D, cartas e narrador ao vivo:',
          buttonText: '⚔️ Entrar na Arena',
          pageType: 'rpg',
        },
      },
    ],
    edges: [
      { id: 'er1', source: 'trg_rpg', target: 'msg_rpg_intro' },
      { id: 'er2', source: 'msg_rpg_intro', target: 'btn_arena' },
    ],
  },

  doom_game: {
    id: 'doom_game',
    name: 'Jogo Retrô Web no Navegador (HTML5 Canvas / Doom)',
    category: 'games',
    description: 'Envia um convite com botão CTA que abre um jogo retrô 60fps leve e responsivo rodando diretamente no navegador móvel ou desktop.',
    triggerKeywords: ['/jogo', '/game', '/doom', 'jogar'],
    tags: ['Jogos', 'HTML5', 'Retro', 'Canvas'],
    nodes: [
      {
        id: 'trg_game',
        type: 'trigger_keyword',
        name: 'Gatilho Jogo',
        position: { x: 50, y: 150 },
        data: { keywords: ['/jogo', '/game', '/doom', 'jogar'] },
      },
      {
        id: 'msg_game_intro',
        type: 'message_text',
        name: 'Apresentação do Jogo',
        position: { x: 300, y: 150 },
        data: { text: '🎮 *ZAPTROLL ARCADE NO NAVEGADOR!* 👾\nDesafie seus reflexos num jogo retrô com gráficos em Canvas, controles por toque no celular ou teclado no PC.' },
      },
      {
        id: 'btn_game',
        type: 'hosted_page_button',
        name: 'Abrir Jogo Web',
        position: { x: 580, y: 150 },
        data: {
          text: 'Toque no botão para carregar instantaneamente o jogo em tela cheia:',
          buttonText: '🕹️ Jogar Agora',
          pageType: 'game',
          gameId: 'doom',
        },
      },
    ],
    edges: [
      { id: 'eg1', source: 'trg_game', target: 'msg_game_intro' },
      { id: 'eg2', source: 'msg_game_intro', target: 'btn_game' },
    ],
  },
};
