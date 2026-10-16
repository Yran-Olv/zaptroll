import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth.js';
import { MessageTemplate } from '../../database/models/index.js';

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

  static async getExamples(req: AuthRequest, res: Response): Promise<void> {
    // Official curated examples from zapo-js documentation
    const examples = {
      buttons: {
        name: 'Botões Rápidos WhatsApp',
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
      list: {
        name: 'Menu de Opções Interativo',
        type: 'list',
        payload: {
          title: 'Cardápio / Serviços',
          description: 'Selecione o serviço desejado na lista:',
          buttonText: 'Ver Opções',
          footerText: 'Horário de atendimento 9h às 18h',
          sections: [
            {
              title: 'Recursos Principais',
              rows: [
                { rowId: 'btn_test', title: 'Testar Botões', description: 'Envio de botões rápidos' },
                { rowId: 'list_test', title: 'Testar Menus', description: 'Listas e menus expansíveis' },
              ],
            },
            {
              title: 'Outros Recursos',
              rows: [
                { rowId: 'cta_test', title: 'Testar Webview', description: 'Botão com link externo' },
                { rowId: 'eph_test', title: 'Testar Efêmera', description: 'Mensagem temporária' },
              ],
            },
          ],
        },
      },
      webview: {
        name: 'Botão com Webview / Link CTA',
        type: 'webview',
        payload: {
          title: 'Acesse nossa plataforma',
          bodyText: 'Clique no botão abaixo para abrir a página web:',
          footerText: 'Zaptroll Developer Platform',
          buttonText: 'Abrir Zaptroll',
          url: 'https://zapo.to/en/introduction',
        },
      },
      carousel: {
        name: 'Carrossel de Produtos / Cards Interativos',
        type: 'carousel',
        payload: {
          bodyText: 'Hey there! 🙂 Great day to explore awesome products.',
          footerText: 'Expo Shoes Official Store',
          cards: [
            {
              title: 'Expo Shoes Classic',
              text: 'Experience timeless style with iconic model, designed for all-day ease and durability.',
              imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=640&q=80',
              buttons: [
                { type: 'cta_url', displayText: 'Buy now', url: 'https://zaptroll.multivus.com.br' },
                { type: 'quick_reply', displayText: 'Send more like this', id: 'more_shoes_1' },
              ],
            },
            {
              title: 'Speed Runner Pro',
              text: 'Elevate your game with sleek, high-performance model, built for speed and precision.',
              imageUrl: 'https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=640&q=80',
              buttons: [
                { type: 'cta_url', displayText: 'Buy now', url: 'https://zaptroll.multivus.com.br' },
                { type: 'quick_reply', displayText: 'Send more like this', id: 'more_shoes_2' },
              ],
            },
            {
              title: 'Urban Adventure Air',
              text: 'Stay trendy and comfortable with sporty model, perfect for your daily adventures.',
              imageUrl: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=640&q=80',
              buttons: [
                { type: 'cta_url', displayText: 'Buy now', url: 'https://zaptroll.multivus.com.br' },
                { type: 'quick_reply', displayText: 'Send more like this', id: 'more_shoes_3' },
              ],
            },
          ],
        },
      },
      ephemeralChat: {
        name: 'Mensagens Temporárias da Conversa (7 Dias)',
        type: 'ephemeral_setting',
        payload: {
          ephemeralExpiration: 604800, // 7 days in seconds (0 to disable)
        },
      },
      ephemeralSingle: {
        name: 'Mensagem Efêmera Individual (5 Segundos)',
        type: 'ephemeral_message',
        payload: {
          text: 'Esta mensagem foi configurada para sumir rapidamente.',
          expirationSeconds: 5,
          experimentalAfterRead: true,
          afterReadDuration: 5,
        },
      },
      rawLocation: {
        name: 'Localização (Raw Proto)',
        type: 'raw',
        payload: {
          rawPayload: {
            locationMessage: {
              degreesLatitude: -23.5613,
              degreesLongitude: -46.6565,
              name: 'Av. Paulista, São Paulo',
              address: 'São Paulo, SP, Brasil',
            },
          },
        },
      },
      rawPixPayment: {
        name: 'Cartão de Pagamento PIX (Raw Proto)',
        type: 'raw',
        payload: {
          rawPayload: {
            interactiveMessage: {
              nativeFlowMessage: {
                messageVersion: 1,
                buttons: [
                  {
                    name: 'payment_info',
                    buttonParamsJson: JSON.stringify({
                      currency: 'BRL',
                      total_amount: { value: 1000, offset: 100 },
                      reference_id: `PIX_${Date.now()}`,
                      type: 'physical-goods',
                      payment_settings: [
                        {
                          type: 'pix_static_code',
                          pix_static_code: {
                            merchant_name: 'Zaptroll Labs',
                            key: 'contato@zaptroll.local',
                            key_type: 'EMAIL',
                          },
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
    };

    res.json({ examples });
  }
}
