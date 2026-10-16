import { z } from 'zod';

// 1. Text Message Validator
export const textMessageSchema = z.object({
  text: z.string().min(1, 'O texto da mensagem é obrigatório'),
  linkPreview: z.boolean().optional(),
});

// 2. Buttons Message Validator
export const buttonsMessageSchema = z.object({
  headerText: z.string().optional(),
  contentText: z.string().min(1, 'O texto principal é obrigatório'),
  footerText: z.string().optional(),
  expirationSeconds: z.coerce.number().int().optional(),
  buttons: z
    .array(
      z.object({
        buttonId: z.string().min(1, 'Identificador do botão é obrigatório'),
        displayText: z.string().optional(),
        buttonText: z.object({ displayText: z.string().optional() }).optional(),
      }).transform((b) => ({
        buttonId: b.buttonId,
        displayText: b.displayText || b.buttonText?.displayText || 'Opção',
      }))
    )
    .min(1, 'Ao menos 1 botão é necessário')
    .max(3, 'No máximo 3 botões são permitidos pelo WhatsApp'),
});

// 3. List Message Validator
export const listMessageSchema = z.object({
  title: z.string().min(1, 'O título da lista é obrigatório'),
  description: z.string().min(1, 'A descrição da lista é obrigatória'),
  buttonText: z.string().min(1, 'O texto do botão que abre o menu é obrigatório').max(20, 'Texto do botão deve ter até 20 caracteres'),
  footerText: z.string().optional(),
  expirationSeconds: z.coerce.number().int().optional(),
  sections: z
    .array(
      z.object({
        title: z.string().min(1, 'Título da seção é obrigatório'),
        rows: z
          .array(
            z.object({
              rowId: z.string().min(1, 'ID do item é obrigatório'),
              title: z.string().min(1, 'Título do item é obrigatório').max(24, 'Título do item deve ter até 24 caracteres'),
              description: z.string().optional(),
            })
          )
          .min(1, 'Cada seção deve ter ao menos 1 item'),
      })
    )
    .min(1, 'Ao menos 1 seção é obrigatória')
    .max(10, 'No máximo 10 seções permitidas'),
});

// 4. Webview / CTA URL Validator
export const webviewMessageSchema = z.object({
  title: z.string().optional(),
  bodyText: z.string().min(1, 'Texto da mensagem é obrigatório'),
  footerText: z.string().optional(),
  buttonText: z.string().min(1, 'Texto do botão é obrigatório').max(30),
  expirationSeconds: z.coerce.number().int().optional(),
  url: z
    .string()
    .url('A URL deve ser válida')
    .refine((val) => {
      // Must be https or http in development, avoid internal AWS/Docker metadata SSRF
      try {
        const parsed = new URL(val);
        const host = parsed.hostname.toLowerCase();
        if (
          host === '169.254.169.254' ||
          host === 'metadata.google.internal' ||
          host === 'localhost' && process.env.NODE_ENV === 'production'
        ) {
          return false;
        }
        return process.env.NODE_ENV === 'production' ? parsed.protocol === 'https:' : true;
      } catch {
        return false;
      }
    }, 'A URL deve usar HTTPS seguro e não apontar para redes internas de infraestrutura.'),
});

// 5. Disappearing / Ephemeral Messages Validator
export const ephemeralSettingSchema = z.object({
  ephemeralExpiration: z.coerce.number().int().min(0, 'A expiração em segundos deve ser >= 0'),
});

export const singleMessageEphemeralSchema = z.object({
  text: z.string().min(1, 'Texto é obrigatório'),
  expirationSeconds: z.coerce.number().int().min(1, 'Duração deve ser pelo menos 1 segundo'),
  experimentalAfterRead: z.boolean().optional(),
  afterReadDuration: z.coerce.number().int().optional(),
});

// 6. Revoke Validator
export const revokeMessageSchema = z.object({
  stanzaId: z.string().min(1, 'ID da mensagem a ser revogada é obrigatório'),
  participant: z.string().optional(),
  fromMe: z.boolean().default(true),
});

// 7. Carousel Message Validator
export const carouselMessageSchema = z.object({
  bodyText: z.string().min(1, 'Texto principal do carrossel é obrigatório'),
  footerText: z.string().optional(),
  expirationSeconds: z.coerce.number().int().optional(),
  cards: z
    .array(
      z.object({
        title: z.string().min(1, 'Título do cartão é obrigatório'),
        text: z.string().min(1, 'Descrição do cartão é obrigatória'),
        imageUrl: z.string().optional(),
        buttons: z
          .array(
            z.object({
              type: z.enum(['cta_url', 'quick_reply', 'cta_call', 'cta_copy']).default('quick_reply'),
              displayText: z.string().optional(),
              display_text: z.string().optional(),
              url: z.string().optional(),
              id: z.string().optional(),
              phoneNumber: z.string().optional(),
              code: z.string().optional(),
            }).transform((btn) => ({
              ...btn,
              displayText: btn.displayText || btn.display_text || 'Ação',
              display_text: btn.display_text || btn.displayText || 'Ação',
            }))
          )
          .min(1, 'Cada cartão deve ter ao menos 1 botão')
          .max(3, 'No máximo 3 botões por cartão são permitidos'),
      })
    )
    .min(1, 'Ao menos 1 cartão é obrigatório')
    .max(10, 'No máximo 10 cartões são permitidos'),
});

// 8. Raw Proto Send Validator
export const rawProtoSchema = z.object({
  rawPayload: z.record(z.any()),
  expirationSeconds: z.coerce.number().int().optional(),
});
