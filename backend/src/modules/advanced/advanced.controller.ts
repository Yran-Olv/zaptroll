import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth.js';
import { MessageTemplate, WhatsAppConnection, Conversation, Message, Group } from '../../database/models/index.js';
import { ZapoConnectionManager } from '../../integrations/zapo/ZapoConnectionManager.js';
import { ZapoMessageAdapter } from '../../integrations/zapo/ZapoMessageAdapter.js';
import { PhoneLookupService } from './PhoneLookupService.js';
import { WhatsAppHealthService } from './WhatsAppHealthService.js';
import { StatusService } from './StatusService.js';
import { MetaAiService } from './MetaAiService.js';
import { emitToConnection } from '../realtime/socket.js';

const templateSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(60),
  category: z.enum(['buttons', 'list', 'carousel', 'webview', 'raw', 'ephemeral']),
  payload: z.any(),
});

export class AdvancedController {
  static async listTemplates(req: AuthRequest, res: Response): Promise<void> {
    try {
      const templates = await MessageTemplate.findAll({
        where: { userId: req.user!.id },
        order: [['createdAt', 'DESC']],
      });
      res.json({ templates });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async saveTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validated = templateSchema.parse(req.body);
      const template = await MessageTemplate.create({
        userId: req.user!.id,
        name: validated.name.trim(),
        category: validated.category,
        payload: validated.payload,
      });
      res.status(201).json({ template });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async deleteTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const template = await MessageTemplate.findOne({
        where: { id, userId: req.user!.id },
      });

      if (!template) {
        res.status(404).json({ error: 'Modelo não encontrado.' });
        return;
      }

      await template.destroy();
      res.json({ message: 'Modelo excluído com sucesso.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // 1. Phone & Location Lookup (DDD, Estado, Cidades, Operadora)
  static async phoneLookup(req: AuthRequest, res: Response): Promise<void> {
    try {
      const rawPhone = (req.params.phone || req.query.phone || req.body?.phone || '').toString();
      const connectionId = (req.query.connectionId || req.body?.connectionId || '').toString();
      if (!rawPhone.trim()) {
        res.status(400).json({ error: 'Informe um número de telefone para busca.' });
        return;
      }
      const result = await PhoneLookupService.lookup(rawPhone, connectionId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Falha ao buscar localidade do telefone.' });
    }
  }

  // 2. Official Server Health & Latency Ping Check
  static async serverHealth(req: AuthRequest, res: Response): Promise<void> {
    try {
      const connectionId = (req.params.connectionId || req.query.connectionId || '').toString();
      if (!connectionId) {
        res.status(400).json({ error: 'ID da conexão não informado.' });
        return;
      }
      const health = await WhatsAppHealthService.checkHealth(connectionId);
      res.json(health);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Falha ao medir saúde dos servidores.' });
    }
  }

  // 3. Status & Stories Management
  static async listStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const connectionId = (req.params.connectionId || req.query.connectionId || '').toString();
      if (!connectionId) {
        res.status(400).json({ error: 'ID da conexão não informado.' });
        return;
      }
      const stories = StatusService.listRecentStatus(connectionId);
      res.json({ count: stories.length, stories });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async postStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        connectionId,
        type,
        text,
        caption,
        backgroundColor,
        font,
        recipients,
        targetGroups,
        mentionAll,
        imageUrl,
        imageBase64,
        alsoPostToPersonal,
      } = req.body;
      if (!connectionId) {
        res.status(400).json({ error: 'ID da conexão é obrigatório.' });
        return;
      }
      const result = await StatusService.postStatus(connectionId, {
        type: type || 'text',
        text,
        caption,
        backgroundColor,
        font: Number(font || 0),
        recipients,
        targetGroups,
        mentionAll: Boolean(mentionAll),
        imageUrl,
        imageBase64,
        alsoPostToPersonal: Boolean(alsoPostToPersonal),
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Falha ao postar status.' });
    }
  }

  static async markStatusViewed(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { connectionId, stanzaId, senderJid } = req.body;
      if (!connectionId || !stanzaId) {
        res.status(400).json({ error: 'Parâmetros incompletos.' });
        return;
      }
      await StatusService.markStatusViewed(connectionId, {
        stanzaId,
        senderJid: senderJid || 'status@broadcast',
      });
      res.json({ success: true, stanzaId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // 4. Ghost Mention (Menção Fantasma / Invisível)
  static async sendGhostMention(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { connectionId, targetJid, text, mentionAll, specificMentions, quotedStanzaId } = req.body;
      if (!connectionId || !targetJid || !text) {
        res.status(400).json({ error: 'Parâmetros obrigatórios ausentes (connectionId, targetJid, text).' });
        return;
      }

      const zapoManager = ZapoConnectionManager.getInstance();
      const client = zapoManager.getClient(connectionId);
      if (!client) {
        res.status(400).json({ error: 'Conexão WhatsApp não conectada.' });
        return;
      }

      let mentionedJids: string[] = [];

      if (mentionAll && targetJid.endsWith('@g.us')) {
        // Busca todos os membros do grupo
        try {
          const meta = await client.group.queryGroupMetadata(targetJid);
          if (meta?.participants) {
            mentionedJids = meta.participants.map((p: any) => p.id || p.jid).filter(Boolean);
          }
        } catch {
          // Fallback ao banco local
          const localGroup = await Group.findOne({ where: { connectionId, jid: targetJid } });
          const parts = localGroup?.metadata?.participants;
          if (parts && Array.isArray(parts)) {
            mentionedJids = parts.map((p: any) => p.id || p.jid).filter(Boolean);
          }
        }
      }

      if (specificMentions && Array.isArray(specificMentions)) {
        for (const item of specificMentions) {
          const clean = String(item).trim();
          const jid = clean.includes('@') ? clean : `${clean.replace(/\D/g, '')}@s.whatsapp.net`;
          if (!mentionedJids.includes(jid)) {
            mentionedJids.push(jid);
          }
        }
      }

      if (mentionedJids.length === 0) {
        res.status(400).json({ error: 'Nenhum contato ou participante selecionado para a menção fantasma.' });
        return;
      }

      // Quoted message resolution if replying
      const quoteId = quotedStanzaId || req.body?.payload?.quotedStanzaId;
      let quoteOption: any = undefined;

      if (quoteId) {
        const quotedMsg = await Message.findOne({
          where: { connectionId, stanzaId: quoteId },
        });

        if (quotedMsg) {
          const isGroup = targetJid.endsWith('@g.us');
          let quoteMsgContent: any = {
            conversation: quotedMsg.content || quotedMsg.caption || 'Mensagem',
          };
          if (quotedMsg.rawPayload?.conversation) {
            quoteMsgContent = { conversation: quotedMsg.rawPayload.conversation };
          } else if (quotedMsg.rawPayload?.extendedTextMessage?.text) {
            quoteMsgContent = { conversation: quotedMsg.rawPayload.extendedTextMessage.text };
          }

          const myJid = (client as any).credentials?.meJid;

          quoteOption = {
            id: quotedMsg.stanzaId,
            participant: isGroup
              ? (quotedMsg.fromMe ? myJid : (quotedMsg.senderJid === 'me' ? myJid : quotedMsg.senderJid))
              : (quotedMsg.fromMe ? undefined : (quotedMsg.senderJid === 'me' ? targetJid : quotedMsg.senderJid)),
            remoteJid: targetJid,
            message: quoteMsgContent,
          };
        }
      }

      const sendResult = await ZapoMessageAdapter.sendGhostMention(client, targetJid, text, mentionedJids, {
        quote: quoteOption,
      });
      const stanzaId = (sendResult as any)?.stanzaId || (sendResult as any)?.key?.id || `GHOST_${Date.now()}`;

      // Salva no banco de conversas para histórico
      let convRecord = await Conversation.findOne({ where: { connectionId, jid: targetJid } });
      if (!convRecord) {
        convRecord = await Conversation.create({
          connectionId,
          jid: targetJid,
          chatType: targetJid.endsWith('@g.us') ? 'group' : 'direct',
          name: targetJid.split('@')[0],
          unreadCount: 0,
        });
      }

      const msg = await Message.create({
        connectionId,
        conversationId: convRecord.id,
        senderJid: targetJid,
        stanzaId,
        fromMe: true,
        messageType: 'ghost_mention',
        content: text,
        status: 'sent',
        timestamp: new Date(),
        rawPayload: {
          text,
          isGhostMention: true,
          mentionedCount: mentionedJids.length,
          mentionedJids,
          quotedStanzaId: quoteId || undefined,
        },
      });

      await convRecord.update({
        lastMessageText: `👻 ${text.slice(0, 45)}`,
        lastMessageTimestamp: new Date(),
      });

      emitToConnection(connectionId, 'new_message', {
        connectionId,
        message: msg,
        conversation: convRecord,
      });

      res.json({
        success: true,
        stanzaId,
        mentionedCount: mentionedJids.length,
        message: msg,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Falha ao enviar menção fantasma.' });
    }
  }

  // 5. Curated interactive examples from zapo-interactive-examples & community
  static async getExamples(req: AuthRequest, res: Response): Promise<void> {
    const examples = {
      buttons: {
        name: 'Botões Rápidos WhatsApp (Quick Reply)',
        type: 'buttons',
        payload: {
          headerText: 'Atendimento Zaptroll',
          contentText: 'Olá! Como podemos te ajudar hoje?',
          footerText: 'Selecione uma opção abaixo',
          buttons: [
            { buttonId: 'suporte', displayText: 'Falar com Suporte' },
            { buttonId: 'precos', displayText: 'Consultar Planos' },
            { buttonId: 'documentacao', displayText: 'Documentação' },
          ],
        },
      },
      pixButton: {
        name: 'PIX Copia e Cola Interativo (Botão Nativo)',
        type: 'raw',
        payload: {
          rawPayload: {
            interactiveMessage: {
              body: { text: '💳 *Pagamento Instantâneo via PIX*\n\nClique no botão abaixo para copiar a chave PIX diretamente para sua área de transferência:' },
              footer: { text: 'Chave ativa por 30 minutos' },
              nativeFlowMessage: {
                messageVersion: 1,
                buttons: [
                  {
                    name: 'cta_copy',
                    buttonParamsJson: JSON.stringify({
                      display_text: '📋 Copiar Chave PIX',
                      id: 'copy_pix_key',
                      copy_code: '00020126580014br.gov.bcb.pix0136multivus@zaptroll.local520400005303986540550.005802BR5916Zaptroll Services6009Uberlandia62070503***6304ABCD',
                    }),
                  },
                  {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                      display_text: '✅ Já Efetuei o Pagamento',
                      id: 'pix_confirm_paid',
                    }),
                  },
                ],
              },
            },
          },
        },
      },
      a2uiForm: {
        name: 'Formulário Interativo A2UI (Pesquisa / Lead)',
        type: 'raw',
        payload: {
          rawPayload: {
            interactiveMessage: {
              body: { text: '📝 *Pesquisa Rápida de Satisfação*\nPreencha em menos de 1 minuto diretamente aqui no WhatsApp:' },
              footer: { text: 'Zaptroll Interactive A2UI' },
              nativeFlowMessage: {
                messageVersion: 1,
                buttons: [
                  {
                    name: 'form_message',
                    buttonParamsJson: JSON.stringify({
                      title: 'Iniciar Pesquisa',
                      description: 'Responda 3 perguntas rápidas',
                      pages: [
                        {
                          id: 'page_1',
                          title: 'Avaliação do Suporte',
                          questions: [
                            {
                              id: 'q1',
                              type: 'single_select',
                              title: 'Como você avalia a velocidade do atendimento?',
                              options: ['Excelente', 'Bom', 'Regular', 'Ruim'],
                            },
                          ],
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          },
        },
      },
      catalogCard: {
        name: 'Card de Produto / Catálogo Interativo',
        type: 'raw',
        payload: {
          rawPayload: {
            interactiveMessage: {
              body: { text: '👟 *Tênis Esportivo Ultra Turbo*\nDe: ~R$ 399,90~\nPor: *R$ 249,90* à vista no PIX' },
              footer: { text: 'Frete Grátis para todo o Brasil' },
              nativeFlowMessage: {
                messageVersion: 1,
                buttons: [
                  {
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                      display_text: '🛍️ Ver no Catálogo',
                      url: 'https://wa.me/c/553499198782',
                    }),
                  },
                  {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                      display_text: '📦 Comprar Agora',
                      id: 'buy_ultra_turbo',
                    }),
                  },
                ],
              },
            },
          },
        },
      },
      webview: {
        name: 'Botão com Webview / Link CTA',
        type: 'webview',
        payload: {
          title: 'Acesse nossa plataforma',
          bodyText: 'Clique no botão abaixo para abrir a página web dentro do WhatsApp:',
          footerText: 'Zaptroll Developer Platform',
          buttonText: '🌐 Abrir Central Zaptroll',
          url: 'https://zaptroll.multivus.com.br',
        },
      },
      carousel: {
        name: 'Carrossel de Produtos / Cards Interativos',
        type: 'carousel',
        payload: {
          bodyText: '🔥 *Ofertas Exclusivas de Hoje!* Deslize para o lado para conferir:',
          footerText: 'Zaptroll Store',
          cards: [
            {
              headerText: 'Card 1 - Produto A',
              bodyText: 'Tênis Running Air Pro\nR$ 199,90',
              buttonText: 'Ver Detalhes',
              url: 'https://zaptroll.multivus.com.br',
            },
            {
              headerText: 'Card 2 - Produto B',
              bodyText: 'Camisa Esportiva Dry-Fit\nR$ 79,90',
              buttonText: 'Ver Detalhes',
              url: 'https://zaptroll.multivus.com.br',
            },
            {
              headerText: 'Card 3 - Produto C',
              bodyText: 'Mochila Impermeável Tech\nR$ 149,90',
              buttonText: 'Ver Detalhes',
              url: 'https://zaptroll.multivus.com.br',
            },
          ],
        },
      },
    };

    res.json({ examples });
  }

  // 6. Enviar Banner "Meta Hospedou este Chat" (Inspirado em Jobas Fernandes)
  static async sendMetaBanner(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { connectionId, jid, messageText } = req.body;
      if (!connectionId || !jid) {
        res.status(400).json({ error: 'connectionId e jid são obrigatórios.' });
        return;
      }
      const zapoManager = ZapoConnectionManager.getInstance();
      const client = zapoManager.getClient(connectionId);
      if (!client) {
        res.status(404).json({ error: 'Conexão não encontrada ou desconectada.' });
        return;
      }
      const result = await ZapoMessageAdapter.sendMetaHostedBanner(client, jid, messageText);
      res.json({
        success: true,
        messageId: (result as any)?.id || (result as any)?.key?.id,
        note: 'Banner Meta hospedado acionado com sucesso.',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Falha ao acionar banner Meta.' });
    }
  }

  // 7. Postar Status / Stories em Grupos (groupStatusMessageV2) (Inspirado em Jobas Fernandes)
  static async sendGroupStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { connectionId, groupJid, caption, imageBase64, imageUrl, mentionAll } = req.body;
      if (!connectionId || !groupJid) {
        res.status(400).json({ error: 'connectionId e groupJid são obrigatórios.' });
        return;
      }
      const zapoManager = ZapoConnectionManager.getInstance();
      const client = zapoManager.getClient(connectionId);
      if (!client) {
        res.status(404).json({ error: 'Conexão não encontrada ou desconectada.' });
        return;
      }

      let imageBytes: Buffer;
      let thumbBytes: Buffer | undefined;

      if (imageBase64) {
        const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
        imageBytes = Buffer.from(cleanBase64, 'base64');
      } else if (imageUrl) {
        try {
          const fetchRes = await fetch(imageUrl);
          const arrayBuf = await fetchRes.arrayBuffer();
          imageBytes = Buffer.from(arrayBuf);
        } catch {
          const def = StatusService.getDefaultGroupMedia();
          imageBytes = def.banner;
          thumbBytes = def.thumb;
        }
      } else {
        const def = StatusService.getDefaultGroupMedia();
        imageBytes = def.banner;
        thumbBytes = def.thumb;
      }

      let mentionedJids: string[] = [];
      if (mentionAll) {
        try {
          const meta = await client.group.queryGroupMetadata(groupJid);
          if (meta?.participants) {
            mentionedJids = meta.participants.map((p: any) => p.id || p.jid).filter(Boolean);
          }
        } catch {
          const localGroup = await Group.findOne({ where: { connectionId, jid: groupJid } });
          const parts = localGroup?.metadata?.participants;
          if (parts && Array.isArray(parts)) {
            mentionedJids = parts.map((p: any) => p.id || p.jid).filter(Boolean);
          }
        }
      }

      const result = await ZapoMessageAdapter.sendGroupStatus(
        client,
        groupJid,
        imageBytes,
        caption,
        {
          width: 1080,
          height: 1920,
          jpegThumbnail: thumbBytes,
          mentionedJids,
        }
      );

      res.json({
        success: true,
        statusId: (result as any)?.id || (result as any)?.key?.id,
        groupJid,
        mentionedCount: mentionedJids.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Falha ao postar status no grupo.' });
    }
  }

  // 8. Enquete Nativa WhatsApp (/poll) (Inspirado em Jobas Fernandes)
  static async sendPoll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { connectionId, jid, question, options, selectableCount = 1 } = req.body;
      if (!connectionId || !jid || !question || !Array.isArray(options) || options.length < 2) {
        res.status(400).json({ error: 'connectionId, jid, question e pelo menos 2 options são obrigatórios.' });
        return;
      }
      const zapoManager = ZapoConnectionManager.getInstance();
      const client = zapoManager.getClient(connectionId);
      if (!client) {
        res.status(404).json({ error: 'Conexão não encontrada ou desconectada.' });
        return;
      }

      const result = await ZapoMessageAdapter.sendPoll(client, jid, question, options, selectableCount);
      res.json({
        success: true,
        pollId: (result as any)?.id || (result as any)?.key?.id,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Falha ao enviar enquete.' });
    }
  }

  // 9. Meta AI com Selo Nativo "IA" e Streaming (/ai) (Inspirado em Jobas Fernandes)
  static async askMetaAi(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { connectionId, jid, question, systemPrompt, imageBase64, imageMimetype } = req.body;
      if (!connectionId || !jid || !question) {
        res.status(400).json({ error: 'connectionId, jid e question são obrigatórios.' });
        return;
      }
      const zapoManager = ZapoConnectionManager.getInstance();
      const client = zapoManager.getClient(connectionId);
      if (!client) {
        res.status(404).json({ error: 'Conexão não encontrada ou desconectada.' });
        return;
      }

      let image: any = undefined;
      if (imageBase64) {
        const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
        image = {
          data: Buffer.from(cleanBase64, 'base64'),
          mimetype: imageMimetype || 'image/jpeg',
        };
      }

      const response = await MetaAiService.answerWithAi(client, jid, question, {
        systemPrompt,
        image,
      });

      res.json(response);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Falha ao consultar Meta AI.' });
    }
  }

  // 10. Créditos da Comunidade (Jobas Fernandes)
  static async getCommunityCredits(req: AuthRequest, res: Response): Promise<void> {
    res.json({
      author: 'Jobas Fernandes',
      repoUrl: 'https://github.com/jobasfernandes/zapo-interactive-examples',
      description: 'Exemplos interativos de WhatsApp com zapo-js e engenharia reversa de recursos avançados do protocolo.',
      features: [
        {
          name: 'Banner "Meta hospedou este chat"',
          desc: 'Marca chats privados com o aviso nativo da Meta usando a transição de atores (actual_actors 1 -> 2).',
          badge: '🏢 Banner Meta',
        },
        {
          name: 'Meta AI dentro do chat (/ai)',
          desc: 'Selo nativo "IA" (biz_bot: 1) no balão, placeholder "Thinking…" editado para a resposta final com tabelas e blocos de código formatados, e análise de fotos com legenda.',
          badge: '🤖 Meta AI',
        },
        {
          name: 'Status em Grupos (groupStatusMessageV2)',
          desc: 'Posta stories/status com anel verde no avatar do grupo pelo WhatsApp usando o nó nativo is_group_status.',
          badge: '🟢 Status em Grupos',
        },
        {
          name: 'Enquetes Nativas (/poll)',
          desc: 'Criação e votação em enquetes interativas nativas do WhatsApp protocolar.',
          badge: '📊 Enquetes',
        },
      ],
    });
  }
}
