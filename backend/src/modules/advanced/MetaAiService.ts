/**
 * MetaAiService.ts
 *
 * Módulo de Integração com Meta AI dentro do chat do WhatsApp.
 * Baseado e inspirado nas implementações de engenharia reversa do protocolo WhatsApp
 * por Jobas Fernandes no projeto:
 * https://github.com/jobasfernandes/zapo-interactive-examples
 *
 * Funcionalidades:
 * - Canal de streaming de chunks: decodifica e renderiza AIRichResponse (tabelas, códigos, textos)
 * - Selo nativo "IA" no balão do WhatsApp (`customNodes: [{ tag: 'bot', attrs: { biz_bot: '1' } }]`)
 * - Efeito "Thinking…" que é editado para a resposta final assim que o Meta AI conclui
 * - Envio de imagem + legenda para o Meta AI analisar fotos
 * - Persona / prompt de sistema configurável
 */

import { randomUUID } from 'node:crypto';
import { WaClient, proto, type WaIncomingMessageEvent, type WaSendMessageOptions } from 'zapo-js';
import { WA_BOT_KNOWN_JIDS, parseSignalAddressFromJid } from 'zapo-js/protocol';

export const THINKING_TEXT = 'Thinking…';
export const ANSWER_TIMEOUT_MS = 45_000;
export const THREAD_IDLE_MS = 30 * 60 * 1000;

export const AI_LABEL_NODE = {
  customNodes: [{ tag: 'bot', attrs: { biz_bot: '1' } }],
};

export type MetaAiImage = {
  data: Uint8Array | Buffer;
  mimetype: string;
};

export type RenderedAnswer = {
  text: string;
  skipped: boolean;
};

export type MetaAiAnswer =
  | { ok: true; text: string; complete: boolean; chunks: number; threadNew: boolean }
  | { ok: false; reason: 'no-answer' | 'unsupported' | 'unavailable' }
  | { ok: false; reason: 'send-failed'; detail: string };

type Rich = NonNullable<proto.IMessage['richResponseMessage']>;
type Table = NonNullable<NonNullable<NonNullable<Rich['submessages']>[number]['tableMetadata']>['rows']>;
type CodeBlocks = NonNullable<NonNullable<NonNullable<Rich['submessages']>[number]['codeMetadata']>['codeBlocks']>;

const FENCE = '```';
const TEXT_PART = proto.AIRichResponseSubMessageType.AI_RICH_RESPONSE_TEXT;
const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b);

function neutralize(content: string): string {
  return content.replace(/`{3,}/g, (run) => run.split('').join(ZERO_WIDTH_SPACE));
}

function fenced(content: string): string {
  return `${FENCE}\n${content}\n${FENCE}`;
}

function renderTable(rows: Table): string {
  const cells = rows.map((row) => (row.items ?? []).map((cell) => neutralize(cell.replace(/\r?\n/g, ' '))));
  const columns = Math.max(0, ...cells.map((row) => row.length));
  const widths = Array.from({ length: columns }, (_, column) =>
    Math.max(...cells.map((row) => (row[column] ?? '').length))
  );
  const line = (row: readonly string[]) =>
    widths
      .map((width, column) => (row[column] ?? '').padEnd(width))
      .join(' | ')
      .trimEnd();

  const lines: string[] = [];
  cells.forEach((row, index) => {
    lines.push(line(row));
    if (rows[index]?.isHeading) lines.push(widths.map((width) => '-'.repeat(width)).join('-+-'));
  });
  return fenced(lines.join('\n'));
}

function renderCode(blocks: CodeBlocks): string {
  const code = blocks.map((block) => block.codeContent ?? '').join('');
  return fenced(neutralize(code).replace(/\n+$/, ''));
}

export function renderAnswer(message: proto.IMessage | null | undefined): RenderedAnswer {
  const body = message?.protocolMessage?.editedMessage ?? message;
  const submessages = body?.richResponseMessage?.submessages;
  if (!submessages) {
    return {
      text: body?.conversation ?? body?.extendedTextMessage?.text ?? '',
      skipped: false,
    };
  }

  const parts: string[] = [];
  let skipped = false;
  for (const submessage of submessages) {
    if (submessage.messageType === TEXT_PART || typeof submessage.messageText === 'string') {
      if (submessage.messageText) parts.push(submessage.messageText);
    } else if (submessage.tableMetadata) {
      parts.push(renderTable(submessage.tableMetadata.rows ?? []));
    } else if (submessage.codeMetadata) {
      parts.push(renderCode(submessage.codeMetadata.codeBlocks ?? []));
    } else {
      skipped = true;
    }
  }
  return { text: parts.join('\n\n'), skipped };
}

export function failureText(answer: Extract<MetaAiAnswer, { ok: false }>): string {
  switch (answer.reason) {
    case 'no-answer':
      return 'O Meta AI não respondeu a tempo. Tente novamente em instantes.';
    case 'unsupported':
      return 'O Meta AI respondeu com um formato não suportado em texto puro.';
    case 'unavailable':
      return 'Houve uma instabilidade temporária no serviço Meta AI.';
    case 'send-failed':
      return `Não foi possível contatar o Meta AI: ${answer.detail}`;
  }
}

export class MetaAiService {
  private static clientAiInstances = new WeakMap<
    WaClient,
    {
      ask: (chatJid: string, question: string, image?: MetaAiImage, systemPrompt?: string) => Promise<MetaAiAnswer>;
    }
  >();

  /**
   * Obtém ou inicializa a instância do coordenador Meta AI para o WaClient
   */
  public static getOrCreateAiCoordinator(client: WaClient) {
    let instance = this.clientAiInstances.get(client);
    if (instance) return instance;

    const threads = new Map<string, { id: string; lastUsedAt: number }>();
    const pending = new Map<
      string,
      {
        latest: RenderedAnswer;
        chunks: number;
        finished: boolean;
        done: Promise<void>;
        finish: () => void;
      }
    >();

    // Ouve eventos streaming de bot chunk
    client.on('message_bot_chunk' as any, (event: any) => {
      const entry = pending.get(event.targetMessageId);
      if (!entry || entry.finished) return;
      entry.latest = renderAnswer(event.message);
      entry.chunks += 1;
      if (event.editType === 'last' || event.editType === 'full') {
        entry.finished = true;
        entry.finish();
      }
    });

    async function ask(
      chatJid: string,
      question: string,
      image?: MetaAiImage,
      systemPrompt?: string
    ): Promise<MetaAiAnswer> {
      const at = Date.now();
      const known = threads.get(chatJid);
      const reused = known && at - known.lastUsedAt < THREAD_IDLE_MS ? known : undefined;
      const thread = reused || { id: randomUUID(), lastUsedAt: at };
      thread.lastUsedAt = at;
      threads.set(chatJid, thread);

      const threadNew = !reused;
      const defaultSystemPrompt =
        systemPrompt ||
        'Você é o Meta AI integrado ao Zaptroll. Responda de forma clara, formatando código e tabelas adequadamente.';
      const text = threadNew ? `${defaultSystemPrompt}\n\n${question}` : question;

      const content: any = image
        ? {
            type: 'image',
            media: image.data instanceof Uint8Array ? image.data : new Uint8Array(image.data),
            mimetype: image.mimetype,
            caption: text,
          }
        : text;

      const promptId = `${Date.now()}_${randomUUID().slice(0, 8)}`;
      let finishResolver: () => void = () => {};
      const donePromise = new Promise<void>((resolve) => {
        finishResolver = resolve;
      });

      const entry = {
        latest: { text: '', skipped: false },
        chunks: 0,
        finished: false,
        done: donePromise,
        finish: finishResolver,
      };
      pending.set(promptId, entry);

      try {
        const promptRes = await client.bot.sendPrompt(WA_BOT_KNOWN_JIDS.META_AI_FBID, content, {
          aiThreadId: thread.id,
          id: promptId,
        });
        const actualId = promptRes?.id || promptId;
        if (actualId !== promptId) {
          pending.set(actualId, entry);
        }
      } catch (err: any) {
        pending.delete(promptId);
        return { ok: false, reason: 'send-failed', detail: err.message || String(err) };
      }

      // Aguarda resposta ou timeout
      const timeoutPromise = new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), ANSWER_TIMEOUT_MS)
      );
      const raceResult = await Promise.race([entry.done.then(() => 'done' as const), timeoutPromise]);

      pending.delete(promptId);

      const complete = raceResult === 'done';
      const { text: resultText, skipped } = entry.latest;
      if (!resultText) {
        return complete && skipped ? { ok: false, reason: 'unsupported' } : { ok: false, reason: 'no-answer' };
      }

      return {
        ok: true,
        text: resultText,
        complete,
        chunks: entry.chunks,
        threadNew,
      };
    }

    instance = { ask };
    this.clientAiInstances.set(client, instance);
    return instance;
  }

  /**
   * Fluxo interativo completo:
   * 1. Envia 'Thinking…' com o selo nativo de IA (se chat privado) citando a mensagem original
   * 2. Consulta o Meta AI
   * 3. Edita o 'Thinking…' com a resposta final gerada (ou envia nova mensagem caso edição falhe)
   */
  public static async answerWithAi(
    client: WaClient,
    chatJid: string,
    question: string,
    options?: {
      quote?: WaIncomingMessageEvent | any;
      image?: MetaAiImage;
      systemPrompt?: string;
    }
  ): Promise<{ messageId?: string; answerText: string; success: boolean }> {
    const isGroup = chatJid.endsWith('@g.us');
    const aiCoordinator = this.getOrCreateAiCoordinator(client);

    // Envia placeholder 'Thinking…'
    let placeholderId: string | undefined;
    const sendOptions: any = {};
    if (options?.quote) {
      sendOptions.quote = options.quote;
    }
    if (!isGroup) {
      sendOptions.customNodes = AI_LABEL_NODE.customNodes;
    }

    try {
      const placeholderRes = await client.message.send(chatJid, THINKING_TEXT, sendOptions);
      placeholderId = placeholderRes?.id;
    } catch (err: any) {
      console.warn('[MetaAiService] Could not send Thinking placeholder with options, trying simple fallback:', err.message);
      try {
        const fallbackOpts: any = !isGroup ? { customNodes: AI_LABEL_NODE.customNodes } : {};
        const placeholderRes = await client.message.send(chatJid, THINKING_TEXT, fallbackOpts);
        placeholderId = placeholderRes?.id;
      } catch (err2: any) {
        console.warn('[MetaAiService] Could not send Thinking placeholder:', err2.message);
      }
    }

    // Pergunta ao Meta AI
    const answer = await aiCoordinator.ask(chatJid, question, options?.image, options?.systemPrompt);
    const answerText = answer.ok ? answer.text : failureText(answer);

    // Atualiza o placeholder via edição nativa de mensagem
    if (placeholderId) {
      try {
        const editRes = await client.message.send(chatJid, answerText, {
          editKey: { id: placeholderId },
        } as any);
        return { messageId: editRes?.id || placeholderId, answerText, success: answer.ok };
      } catch (editErr: any) {
        console.warn('[MetaAiService] Edit placeholder failed, sending new message:', editErr.message);
      }
    }

    // Se não editou, manda nova mensagem (com quote ou fallback direto)
    try {
      const fallbackRes = await client.message.send(chatJid, answerText, sendOptions);
      return { messageId: fallbackRes?.id, answerText, success: answer.ok };
    } catch (sendErr: any) {
      const simpleRes = await client.message.send(chatJid, answerText);
      return { messageId: simpleRes?.id, answerText, success: answer.ok };
    }
  }
}
