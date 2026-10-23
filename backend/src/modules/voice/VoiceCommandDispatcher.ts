import { WaClient } from 'zapo-js';
import { ZapoMessageAdapter } from '../../integrations/zapo/ZapoMessageAdapter.js';
import { KordixVoiceService } from './KordixVoiceService.js';
import { Message, Conversation } from '../../database/models/index.js';
import { emitToConnection, emitToUser } from '../realtime/socket.js';

export interface VoiceMessageContext {
  client: WaClient;
  connectionId: string;
  userId: string;
  remoteJid: string;
  senderJid: string;
  fromMe: boolean;
  stanzaId: string;
  text: string;
  rawEventKey: any;
}

export class VoiceCommandDispatcher {
  /**
   * Verifica se a mensagem é um gatilho de comando de voz
   */
  static isVoiceTrigger(text: string): boolean {
    if (!text) return false;
    const clean = text.trim();
    return /^([&/!#.]\s*(vozkordix|voz|vozes|kordix|audio)(\s+[\s\S]*|$)|^(vozkordix|voz|vozes)$)/i.test(clean);
  }

  /**
   * Processa a mensagem e executa a síntese e envio do áudio
   */
  static async handleMessage(ctx: VoiceMessageContext): Promise<boolean> {
    const raw = (ctx.text || '').trim();
    if (!this.isVoiceTrigger(raw)) {
      return false;
    }

    console.log(`[VoiceCommandDispatcher] 🎙️ Comando de voz detectado de ${ctx.senderJid} em ${ctx.remoteJid}: "${raw}"`);

    const effectiveParticipant =
      ctx.rawEventKey?.participant ||
      (ctx.fromMe ? undefined : ctx.senderJid);

    // 1. Reação imediata de processamento
    try {
      await ZapoMessageAdapter.sendReaction(ctx.client, ctx.remoteJid, '🎙️', {
        id: ctx.stanzaId,
        remoteJid: ctx.remoteJid,
        fromMe: ctx.fromMe,
        participant: effectiveParticipant,
      });
    } catch (reactErr: any) {
      console.warn('[VoiceCommandDispatcher] Aviso ao enviar reação inicial:', reactErr.message);
    }

    // 2. Extrai comando e parâmetros
    // Remove o prefixo inicial (ex: &vozkordix, /voz, etc.)
    const contentWithoutCmd = raw.replace(/^([&/!#.]\s*(vozkordix|voz|vozes|kordix|audio)|^(vozkordix|voz|vozes))\s*/i, '').trim();

    // Se a mensagem for vazia, "ajuda", "help" ou "vozes", exibe o catálogo
    if (!contentWithoutCmd || /^(ajuda|help|vozes|lista|menu)$/i.test(contentWithoutCmd)) {
      const helpText = KordixVoiceService.getHelpMessage();
      await ZapoMessageAdapter.sendText(ctx.client, ctx.remoteJid, helpText, {
        quote: { id: ctx.stanzaId, remoteJid: ctx.remoteJid, participant: ctx.rawEventKey?.participant },
      });
      return true;
    }

    // Se for comando de busca (ex: &vozkordix buscar goku)
    if (/^buscar\s+/i.test(contentWithoutCmd)) {
      const searchTerm = contentWithoutCmd.replace(/^buscar\s+/i, '').trim();
      const results = await KordixVoiceService.searchVoices(searchTerm);
      if (!results || results.length === 0) {
        await ZapoMessageAdapter.sendText(ctx.client, ctx.remoteJid, `❌ Nenhuma voz encontrada para "${searchTerm}". Tente termos como: lula, bolsonaro, goku, bob_esponja, silvio_santos.`, {
          quote: { id: ctx.stanzaId, remoteJid: ctx.remoteJid, participant: ctx.rawEventKey?.participant },
        });
        return true;
      }

      const lines = results.slice(0, 10).map((v, i) => `${i + 1}. *${v.name}* (ID: \`${v.id}\`, Idioma: ${v.language})`);
      const msg = [
        `🔍 *Vozes encontradas para "${searchTerm}":*`,
        '',
        ...lines,
        '',
        `💡 *Para usar:* \`&vozkordix ${results[0].name.toLowerCase().replace(/\s+/g, '_')} | seu texto\``,
        `Ou pelo ID: \`&vozkordix ${results[0].id} | seu texto\``,
      ].join('\n');

      await ZapoMessageAdapter.sendText(ctx.client, ctx.remoteJid, msg, {
        quote: { id: ctx.stanzaId, remoteJid: ctx.remoteJid, participant: ctx.rawEventKey?.participant },
      });
      return true;
    }

    // 3. Fatiamento de Personagem e Texto
    // Suporta com ou sem aspas, com barra vertical "|" ou espaço simples
    let voiceParam = '';
    let speechText = '';

    if (contentWithoutCmd.includes('|')) {
      const parts = contentWithoutCmd.split('|');
      voiceParam = parts[0].trim();
      speechText = parts.slice(1).join('|').trim();
    } else {
      // Se não usou |, a primeira palavra é a voz e o resto é o texto
      const firstSpaceIdx = contentWithoutCmd.search(/\s/);
      if (firstSpaceIdx > 0) {
        voiceParam = contentWithoutCmd.slice(0, firstSpaceIdx).trim();
        speechText = contentWithoutCmd.slice(firstSpaceIdx).trim();
      } else {
        voiceParam = contentWithoutCmd.trim();
        speechText = '';
      }
    }

    // Remove aspas caso o usuário tenha colocado ("lula" | "texto")
    voiceParam = voiceParam.replace(/^["'`]|["'`]$/g, '').trim();
    speechText = speechText.replace(/^["'`]|["'`]$/g, '').trim();

    if (!speechText) {
      await ZapoMessageAdapter.sendText(
        ctx.client,
        ctx.remoteJid,
        `⚠️ Você precisa informar o que a voz deve falar!\n\n*Exemplo:* \`&voz ${voiceParam || 'bolsonaro'} | Olá pessoal, boa noite!\``,
        {
          quote: { id: ctx.stanzaId, remoteJid: ctx.remoteJid, participant: ctx.rawEventKey?.participant },
        }
      );
      return true;
    }

    try {
      // 4. Executa a síntese de áudio
      const synthResult = await KordixVoiceService.synthesize({
        text: speechText,
        voice: voiceParam,
      });

      // 5. Envia o áudio no WhatsApp como PTT (mensagem de voz gravada nativa compatível com iOS e Android)
      const isOgg = synthResult.isOgg ?? (Boolean(synthResult.mimetype?.includes('ogg')) || Boolean(synthResult.mimetype?.includes('opus')));
      const waveform = KordixVoiceService.generateWaveform(synthResult.audioBuffer);
      const audioSendResult = await ZapoMessageAdapter.sendAudio(
        ctx.client,
        ctx.remoteJid,
        synthResult.audioBuffer,
        {
          ptt: isOgg,
          mimetype: synthResult.mimetype,
          seconds: synthResult.durationEstimateSec,
          waveform: isOgg ? waveform : undefined,
          quote: {
            id: ctx.stanzaId,
            remoteJid: ctx.remoteJid,
            participant: effectiveParticipant,
          },
        }
      );

      // 6. Atualiza a reação para sucesso 🔊
      try {
        await ZapoMessageAdapter.sendReaction(ctx.client, ctx.remoteJid, '🔊', {
          id: ctx.stanzaId,
          remoteJid: ctx.remoteJid,
          fromMe: ctx.fromMe,
          participant: effectiveParticipant,
        });
      } catch {}

      // 7. Persistência no banco de dados e notificação em tempo real (não bloqueante)
      try {
        const conv = await Conversation.findOne({ where: { connectionId: ctx.connectionId, jid: ctx.remoteJid } });
        if (conv) {
          const audioStanzaId = (audioSendResult as any)?.id || `aud_kordix_${Date.now()}`;
          const newMsg = await Message.create({
            connectionId: ctx.connectionId,
            conversationId: conv.id,
            stanzaId: audioStanzaId,
            senderJid: 'me',
            fromMe: true,
            messageType: 'audio',
            content: `🎤 Áudio [${synthResult.voiceName}]: "${speechText.slice(0, 60)}"`,
            mediaMimetype: synthResult.mimetype,
            status: 'sent',
            timestamp: new Date(),
          });

          conv.lastMessageText = `🎤 [${synthResult.voiceName}]: ${speechText.slice(0, 40)}`;
          conv.lastMessageTimestamp = new Date();
          await conv.save();

          const payload = {
            connectionId: ctx.connectionId,
            message: newMsg,
            conversation: conv,
          };
          emitToConnection(ctx.connectionId, 'new_message', payload);
          emitToUser(ctx.userId, 'new_message', payload);
        }
      } catch (dbErr: any) {
        console.warn('[VoiceCommandDispatcher] Aviso ao persistir áudio no banco de dados:', dbErr.message);
      }

      console.log(`[VoiceCommandDispatcher] ✅ Áudio enviado com sucesso para ${ctx.remoteJid}`);
      return true;
    } catch (err: any) {
      console.error('[VoiceCommandDispatcher] ❌ Erro ao gerar voz Kordix:', err);

      try {
        await ZapoMessageAdapter.sendReaction(ctx.client, ctx.remoteJid, '❌', {
          id: ctx.stanzaId,
          remoteJid: ctx.remoteJid,
          fromMe: ctx.fromMe,
          participant: effectiveParticipant,
        });
      } catch {}

      const isQuotaError = /limite di[aá]rio|key p[uú]blica|crie sua pr[oó]pria key/i.test(err.message || '');
      const isExpiredError = /expirad|vencid|plano/i.test(err.message || '');
      let errorResponse = `❌ *Erro ao sintetizar voz de "${voiceParam}":* ${err.message || 'Serviço temporariamente indisponível'}`;

      if (isExpiredError) {
        errorResponse = [
          `⚠️ *Chave de API Kordix Expirada*`,
          '',
          `A chave de API configurada para o bot venceu.`,
          '',
          `🔑 *Para renovar sua assinatura:*`,
          `Acesse *https://zone.api.br/store* para renovar ou gerar uma nova key e atualize no \`.env\`.`,
        ].join('\n');
      } else if (isQuotaError) {
        errorResponse = [
          `⚠️ *Limite Diário Atingido (API TTS Kordix)*`,
          '',
          `A chave pública gratuita (\`freekey\`) atingiu o limite global de 20 requisições diárias.`,
          '',
          `🔑 *Para requisições ilimitadas:*`,
          `Adquira ou gere uma key própria em *https://zone.api.br/store* e configure no \`.env\` com:`,
          `\`KORDIX_API_KEY=sua_key\``,
        ].join('\n');
      } else {
        errorResponse += `\n\n💡 Digite \`&voz\` para ver as vozes suportadas.`;
      }

      await ZapoMessageAdapter.sendText(ctx.client, ctx.remoteJid, errorResponse, {
        quote: { id: ctx.stanzaId, remoteJid: ctx.remoteJid, participant: effectiveParticipant },
      });
      return true;
    }
  }
}
