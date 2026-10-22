/**
 * ZAPTROLL — ADAPTADOR DE COMPATIBILIDADE & DIAGNÓSTICO ZAPO
 * Centraliza a matriz de compatibilidade e métodos tipados seguros de envio.
 */

export interface CompatibilityFeature {
  id: string;
  name: string;
  category: 'messaging' | 'interactive' | 'status' | 'lifecycle' | 'media';
  zapoMethod: string;
  payloadFormat: string;
  confirmationType: 'local_queue' | 'server_ack' | 'read_receipt' | 'status_broadcast_ack';
  clientCompatibility: {
    android: 'full' | 'partial' | 'unsupported';
    ios: 'full' | 'partial' | 'unsupported';
    web: 'full' | 'partial' | 'unsupported';
  };
  knownLimitations: string[];
  fallbackPlan: string;
}

export const ZAPO_COMPATIBILITY_MATRIX: CompatibilityFeature[] = [
  {
    id: 'text_message',
    name: 'Mensagem de Texto Simples',
    category: 'messaging',
    zapoMethod: 'client.message.send(jid, { type: "text", text })',
    payloadFormat: 'WaSendTextMessage',
    confirmationType: 'server_ack',
    clientCompatibility: { android: 'full', ios: 'full', web: 'full' },
    knownLimitations: ['Sujeito a bloqueio se enviado em massa sem consentimento'],
    fallbackPlan: 'N/A',
  },
  {
    id: 'buttons_quick_reply',
    name: 'Botões de Resposta Rápida (Interactive Native Flow)',
    category: 'interactive',
    zapoMethod: 'client.message.send(jid, { interactiveMessage: { nativeFlowMessage: ... } })',
    payloadFormat: 'Proto.IMessage (nativeFlowMessage)',
    confirmationType: 'server_ack',
    clientCompatibility: { android: 'full', ios: 'full', web: 'partial' },
    knownLimitations: [
      'Versões antigas do WhatsApp Web podem renderizar mensagem como não suportada',
      'Máximo de 3 botões por mensagem',
    ],
    fallbackPlan: 'Formatar como menu de texto numérico ("1 - Opção A, 2 - Opção B")',
  },
  {
    id: 'list_menu',
    name: 'Menu de Lista Selecionável',
    category: 'interactive',
    zapoMethod: 'client.message.send(jid, { listMessage: ... })',
    payloadFormat: 'Proto.IMessage (listMessage)',
    confirmationType: 'server_ack',
    clientCompatibility: { android: 'full', ios: 'full', web: 'full' },
    knownLimitations: ['Máximo de 10 seções e 10 itens por seção'],
    fallbackPlan: 'Menu texto formatado com lista numerada',
  },
  {
    id: 'cta_url_button',
    name: 'Botão CTA URL (Abertura de Link Web Externo)',
    category: 'interactive',
    zapoMethod: 'client.message.send(jid, { interactiveMessage: { nativeFlowMessage: { buttons: [{ name: "cta_url" }] } } })',
    payloadFormat: 'buttonParamsJson { display_text, url }',
    confirmationType: 'server_ack',
    clientCompatibility: { android: 'full', ios: 'full', web: 'full' },
    knownLimitations: [
      'Não é uma WebView incorporada no chat; abre no navegador interno ou externo do celular',
      'URL deve usar protocolo HTTPS válido e público',
    ],
    fallbackPlan: 'Enviar link formatado no corpo do texto com preview habilitado',
  },
  {
    id: 'status_text_image',
    name: 'Stories / Status (Texto e Imagem)',
    category: 'status',
    zapoMethod: 'client.status.send({ content: { type: "text" | "image" }, recipients })',
    payloadFormat: 'WaSendStatusInput',
    confirmationType: 'status_broadcast_ack',
    clientCompatibility: { android: 'full', ios: 'full', web: 'full' },
    knownLimitations: ['Recipientes limitados aos contatos mútuos ou lista configurada'],
    fallbackPlan: 'Enviar mensagem direta para lista de transmissão se permitido',
  },
  {
    id: 'status_video',
    name: 'Stories / Status (Vídeo com Legenda)',
    category: 'status',
    zapoMethod: 'client.status.send({ content: { type: "video", media, caption, mimetype } })',
    payloadFormat: 'WaSendVideoMessage',
    confirmationType: 'status_broadcast_ack',
    clientCompatibility: { android: 'full', ios: 'full', web: 'partial' },
    knownLimitations: [
      'Tamanho máximo de 16MB no WhatsApp',
      'Duração recomendada até 30 segundos',
      'Exige codec H.264 / AAC em container MP4',
    ],
    fallbackPlan: 'Extrair imagem/frame com miniatura e postar com link para o vídeo',
  },
  {
    id: 'group_status_v2',
    name: 'Status de Grupo (groupStatusMessageV2)',
    category: 'status',
    zapoMethod: 'client.message.send(groupJid, { groupStatusMessageV2: ... }, { customNodes })',
    payloadFormat: 'groupStatusMessageV2 protobuf',
    confirmationType: 'server_ack',
    clientCompatibility: { android: 'full', ios: 'full', web: 'partial' },
    knownLimitations: ['Apenas para grupos (@g.us); requer nó is_group_status'],
    fallbackPlan: 'Enviar imagem/vídeo normal no grupo com menção aos membros',
  },
  {
    id: 'ephemeral_revoke',
    name: 'Revogação Manual / Autodestruição (Apagar para Todos)',
    category: 'lifecycle',
    zapoMethod: 'client.message.send(jid, { type: "revoke", target: { remoteJid, id, fromMe } })',
    payloadFormat: 'WaSendRevokeMessage',
    confirmationType: 'server_ack',
    clientCompatibility: { android: 'full', ios: 'full', web: 'full' },
    knownLimitations: [
      'Confirmação é o ack do servidor, não garante que todos os dispositivos offline já apagaram',
      'WhatsApp impõe limite de tempo para revogação em mensagens normais (~48h)',
    ],
    fallbackPlan: 'Notificar no painel como solicitação de revogação enviada (request_sent)',
  },
  {
    id: 'native_ephemeral_timer',
    name: 'Mensagem Temporária Nativa do WhatsApp (Disappearing Messages)',
    category: 'lifecycle',
    zapoMethod: 'client.message.send(jid, { extendedTextMessage: { contextInfo: { expiration } } })',
    payloadFormat: 'disappearingMode + expirationSeconds',
    confirmationType: 'server_ack',
    clientCompatibility: { android: 'full', ios: 'full', web: 'full' },
    knownLimitations: ['Gerenciado nativamente pelo cliente WhatsApp do destinatário'],
    fallbackPlan: 'N/A',
  },
];

export class ZapoCompatibilityAdapter {
  public static getMatrix(): CompatibilityFeature[] {
    return ZAPO_COMPATIBILITY_MATRIX;
  }

  public static getFeature(id: string): CompatibilityFeature | undefined {
    return ZAPO_COMPATIBILITY_MATRIX.find((f) => f.id === id);
  }

  public static sanitizeLog(data: any): any {
    if (!data) return data;
    try {
      const clone = JSON.parse(JSON.stringify(data));
      const sensitiveKeys = ['password', 'token', 'secret', 'jwt', 'credentials', 'phone_number', 'mediaKey'];
      const scrub = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        for (const k of Object.keys(obj)) {
          if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
            obj[k] = '[REDACTED]';
          } else if (typeof obj[k] === 'object') {
            scrub(obj[k]);
          }
        }
      };
      scrub(clone);
      return clone;
    } catch {
      return '[UNSERIALIZABLE]';
    }
  }
}
