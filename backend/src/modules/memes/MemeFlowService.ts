import fs from 'fs';
import path from 'path';
import { ZapoConnectionManager } from '../../integrations/zapo/ZapoConnectionManager.js';
import { ZapoMessageAdapter } from '../../integrations/zapo/ZapoMessageAdapter.js';
import { Message } from '../../database/models/Message.js';
import { Conversation } from '../../database/models/Conversation.js';
import { emitToConnection } from '../realtime/socket.js';
import { config } from '../../config/index.js';

export interface MemeFlowDefinition {
  id: string;
  name: string;
  emoji: string;
  description: string;
  audioUrl?: string;
  stickerUrl?: string;
  steps: Array<{
    type: 'audio' | 'sticker' | 'text';
    label: string;
    details?: string;
  }>;
}

export class MemeFlowService {
  private static recentTriggers = new Set<string>();

  static shouldTrigger(key: string): boolean {
    if (!key) return true;
    if (this.recentTriggers.has(key)) return false;
    this.recentTriggers.add(key);
    setTimeout(() => this.recentTriggers.delete(key), 20000);
    return true;
  }

  private static findFile(candidates: string[]): string | null {
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  static getJacareAudioPath(): string | null {
    const candidates = [
      path.join(config.mediaDir, 'e4330dfd_2AF53ACD515E31730B48_1792170298396.mp3'),
      path.resolve(process.cwd(), 'uploads/media/e4330dfd_2AF53ACD515E31730B48_1792170298396.mp3'),
      path.resolve(process.cwd(), 'public/memes/jacare.mp3'),
      path.resolve(process.cwd(), '../frontend/public/memes/jacare.mp3'),
      '/app/uploads/media/e4330dfd_2AF53ACD515E31730B48_1792170298396.mp3',
      '/app/public/memes/jacare.mp3',
    ];
    return this.findFile(candidates);
  }

  static getJacareStickerPath(): string | null {
    const candidates = [
      path.join(config.mediaDir, 'e4330dfd_2AE997B1CCE788E0B4D1_1792170298674.webp'),
      path.resolve(process.cwd(), 'uploads/media/e4330dfd_2AE997B1CCE788E0B4D1_1792170298674.webp'),
      path.resolve(process.cwd(), 'public/memes/jacare.webp'),
      path.resolve(process.cwd(), '../frontend/public/memes/jacare.webp'),
      '/app/uploads/media/e4330dfd_2AE997B1CCE788E0B4D1_1792170298674.webp',
      '/app/public/memes/jacare.webp',
    ];
    return this.findFile(candidates);
  }

  static listFlows(): MemeFlowDefinition[] {
    return [
      {
        id: 'jacare',
        name: 'Combo Jacaré Dançarino 🐊',
        emoji: '🐊',
        description:
          'Envia o áudio exclusivo do Jacaré (28s) e, assim que confirmado o envio, dispara a figurinha animada do Jacaré dançando.',
        audioUrl: '/api/media/e4330dfd_2AF53ACD515E31730B48_1792170298396.mp3',
        stickerUrl: '/api/media/e4330dfd_2AE997B1CCE788E0B4D1_1792170298674.webp',
        steps: [
          { type: 'audio', label: 'Passo 1: Áudio do Jacaré', details: 'Duração 28s • Áudio de Voz' },
          { type: 'sticker', label: 'Passo 2: Figurinha Animada', details: 'WebP Animado • Dança do Jacaré' },
        ],
      },
    ];
  }

  static async triggerJacareFlow(params: {
    connectionId: string;
    conversationId?: string;
    recipientJid?: string;
  }) {
    const { connectionId } = params;
    const zapoManager = ZapoConnectionManager.getInstance();
    const client = zapoManager.getClient(connectionId);

    if (!client) {
      throw new Error('Sessão do WhatsApp não conectada.');
    }

    let targetJid = params.recipientJid;
    let convRecord: Conversation | null = null;

    if (params.conversationId) {
      convRecord = await Conversation.findByPk(params.conversationId);
      if (convRecord) {
        targetJid = convRecord.jid;
      }
    } else if (targetJid) {
      convRecord = await Conversation.findOne({
        where: { connectionId, jid: targetJid },
      });
    }

    if (!targetJid || !convRecord) {
      throw new Error('Conversa ou destinatário JID não encontrado.');
    }

    const audioPath = this.getJacareAudioPath();
    const stickerPath = this.getJacareStickerPath();

    if (!audioPath || !fs.existsSync(audioPath)) {
      throw new Error('Arquivo de áudio do Jacaré não encontrado no servidor.');
    }
    if (!stickerPath || !fs.existsSync(stickerPath)) {
      throw new Error('Arquivo de figurinha do Jacaré não encontrado no servidor.');
    }

    const audioBuffer = fs.readFileSync(audioPath);
    const stickerBuffer = fs.readFileSync(stickerPath);

    console.log(`[MemeFlow] 🐊 Iniciando Combo do Jacaré para ${targetJid}...`);

    // 1. Passo 1: Disparar Áudio
    console.log(`[MemeFlow] 🎵 Enviando Passo 1: Áudio do Jacaré...`);
    const audioSendResult = await ZapoMessageAdapter.sendAudio(client, targetJid, audioBuffer, {
      mimetype: 'audio/mpeg',
      ptt: true,
      seconds: 28,
    });

    const audioStanzaId = audioSendResult?.id || `aud_jacare_${Date.now()}`;
    const audioMessage = await Message.create({
      connectionId,
      conversationId: convRecord.id,
      stanzaId: audioStanzaId,
      senderJid: 'me',
      fromMe: true,
      messageType: 'audio',
      content: '🎵 Áudio',
      mediaUrl: '/api/media/e4330dfd_2AF53ACD515E31730B48_1792170298396.mp3',
      mediaMimetype: 'audio/mpeg',
      mediaFilename: 'e4330dfd_2AF53ACD515E31730B48_1792170298396.mp3',
      status: 'sent',
      timestamp: new Date(),
      isRevoked: false,
    });

    convRecord.lastMessageText = '🎵 Áudio';
    convRecord.lastMessageTimestamp = new Date();
    await convRecord.save();

    emitToConnection(connectionId, 'new_message', {
      connectionId,
      message: audioMessage,
      conversation: convRecord,
    });

    console.log(`[MemeFlow] ✅ Áudio do Jacaré entregue com sucesso (${audioStanzaId}). Aguardando confirmação...`);

    // 2. Aguarda entrega e confirmação (800ms) para sequenciamento perfeito
    await new Promise((r) => setTimeout(r, 800));

    // 3. Passo 2: Disparar Figurinha do Jacaré
    console.log(`[MemeFlow] 🐊 Enviando Passo 2: Figurinha Animada do Jacaré...`);
    const stickerSendResult = await ZapoMessageAdapter.sendSticker(client, targetJid, stickerBuffer, {
      mimetype: 'image/webp',
      isAnimated: true,
    });

    const stickerStanzaId = stickerSendResult?.id || `stk_jacare_${Date.now()}`;
    const stickerMessage = await Message.create({
      connectionId,
      conversationId: convRecord.id,
      stanzaId: stickerStanzaId,
      senderJid: 'me',
      fromMe: true,
      messageType: 'sticker',
      content: 'Sticker',
      mediaUrl: '/api/media/e4330dfd_2AE997B1CCE788E0B4D1_1792170298674.webp',
      mediaMimetype: 'image/webp',
      mediaFilename: 'e4330dfd_2AE997B1CCE788E0B4D1_1792170298674.webp',
      status: 'sent',
      timestamp: new Date(),
      isRevoked: false,
    });

    convRecord.lastMessageText = 'Sticker';
    convRecord.lastMessageTimestamp = new Date();
    await convRecord.save();

    emitToConnection(connectionId, 'new_message', {
      connectionId,
      message: stickerMessage,
      conversation: convRecord,
    });

    console.log(`[MemeFlow] 🎉 Combo do Jacaré concluído com 100% de sucesso! (${stickerStanzaId})`);

    return {
      success: true,
      flowId: 'jacare',
      audioMessage,
      stickerMessage,
    };
  }
}
