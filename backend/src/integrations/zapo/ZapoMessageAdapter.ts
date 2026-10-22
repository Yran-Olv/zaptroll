import { randomBytes } from 'node:crypto';
import { WaClient, proto } from 'zapo-js';

export class ZapoMessageAdapter {
  // 1. Plain Text
  static async sendText(
    client: WaClient,
    jid: string,
    text: string,
    options?: { linkPreview?: boolean; quote?: any }
  ) {
    const sendOptions: any = {};
    if (options?.quote) {
      sendOptions.quote = options.quote;
    }
    return client.message.send(
      jid,
      {
        type: 'text',
        text,
        linkPreview: options?.linkPreview ?? true,
      },
      Object.keys(sendOptions).length ? sendOptions : undefined
    );
  }

  // 2. Buttons Message
  static async sendButtons(
    client: WaClient,
    jid: string,
    data: {
      headerText?: string;
      contentText: string;
      footerText?: string;
      expirationSeconds?: number;
      buttons: Array<{ buttonId: string; displayText: string }>;
    }
  ) {
    const sendOptions: any = {};
    let ephemeralContext: any = undefined;
    if (data.expirationSeconds && data.expirationSeconds > 0) {
      const exp = Number(data.expirationSeconds);
      const nowSec = Math.floor(Date.now() / 1000);
      sendOptions.expirationSeconds = exp;
      sendOptions.ephemeralSettingTimestamp = nowSec;
      ephemeralContext = {
        expiration: exp,
        ephemeralSettingTimestamp: nowSec,
        disappearingMode: { initiator: 0, trigger: 1 },
      };
      sendOptions.contextInfo = ephemeralContext;
    }

    const payload = {
      buttonsMessage: {
        contentText: data.contentText,
        footerText: data.footerText,
        headerType: proto.Message.ButtonsMessage.HeaderType.TEXT,
        text: data.headerText || '',
        contextInfo: ephemeralContext,
        buttons: data.buttons.map((b) => ({
          buttonId: b.buttonId,
          buttonText: { displayText: b.displayText },
          type: proto.Message.ButtonsMessage.Button.Type.RESPONSE,
        })),
      },
    };

    return client.message.send(jid, payload, Object.keys(sendOptions).length ? sendOptions : undefined);
  }

  // 3. List Menu Message
  static async sendList(
    client: WaClient,
    jid: string,
    data: {
      title: string;
      description: string;
      buttonText: string;
      footerText?: string;
      expirationSeconds?: number;
      sections: Array<{
        title: string;
        rows: Array<{ rowId: string; title: string; description?: string }>;
      }>;
    }
  ) {
    const sendOptions: any = {};
    let ephemeralContext: any = undefined;
    if (data.expirationSeconds && data.expirationSeconds > 0) {
      const exp = Number(data.expirationSeconds);
      const nowSec = Math.floor(Date.now() / 1000);
      sendOptions.expirationSeconds = exp;
      sendOptions.ephemeralSettingTimestamp = nowSec;
      ephemeralContext = {
        expiration: exp,
        ephemeralSettingTimestamp: nowSec,
        disappearingMode: { initiator: 0, trigger: 1 },
      };
      sendOptions.contextInfo = ephemeralContext;
    }

    const payload = {
      listMessage: {
        title: data.title,
        description: data.description,
        buttonText: data.buttonText,
        footerText: data.footerText,
        listType: proto.Message.ListMessage.ListType.SINGLE_SELECT,
        contextInfo: ephemeralContext,
        sections: data.sections.map((s) => ({
          title: s.title,
          rows: s.rows.map((r) => ({
            rowId: r.rowId,
            title: r.title,
            description: r.description,
          })),
        })),
      },
    };

    return client.message.send(jid, payload, Object.keys(sendOptions).length ? sendOptions : undefined);
  }

  // 4. Webview / Native Flow CTA URL Message
  static async sendWebview(
    client: WaClient,
    jid: string,
    data: {
      bodyText: string;
      footerText?: string;
      buttonText: string;
      url: string;
      expirationSeconds?: number;
    }
  ) {
    const sendOptions: any = {};
    let ephemeralContext: any = undefined;
    if (data.expirationSeconds && data.expirationSeconds > 0) {
      const exp = Number(data.expirationSeconds);
      const nowSec = Math.floor(Date.now() / 1000);
      sendOptions.expirationSeconds = exp;
      sendOptions.ephemeralSettingTimestamp = nowSec;
      ephemeralContext = {
        expiration: exp,
        ephemeralSettingTimestamp: nowSec,
        disappearingMode: { initiator: 0, trigger: 1 },
      };
      sendOptions.contextInfo = ephemeralContext;
    }

    const payload = {
      interactiveMessage: {
        body: { text: data.bodyText },
        footer: data.footerText ? { text: data.footerText } : undefined,
        contextInfo: ephemeralContext,
        nativeFlowMessage: {
          buttons: [
            {
              name: 'cta_url',
              buttonParamsJson: JSON.stringify({
                display_text: data.buttonText,
                url: data.url,
              }),
            },
          ],
          messageVersion: 1,
        },
      },
    };

    return client.message.send(jid, payload, Object.keys(sendOptions).length ? sendOptions : undefined);
  }

  // 5. Native Flow Interactive Carousel Cards
  static async sendCarousel(
    client: WaClient,
    jid: string,
    data: {
      bodyText: string;
      footerText?: string;
      expirationSeconds?: number;
      cards?: Array<{
        title: string;
        text: string;
        imageUrl?: string;
        buttons: Array<{
          type?: 'cta_url' | 'quick_reply' | 'cta_call' | 'cta_copy';
          name?: string;
          displayText?: string;
          display_text?: string;
          url?: string;
          id?: string;
          phoneNumber?: string;
          code?: string;
        }>;
      }>;
      buttons?: Array<{ name: string; display_text: string; url?: string; id?: string }>;
    }
  ) {
    // WhatsApp requires <biz><interactive type=native_flow v=1><native_flow v=9 name=mixed/></interactive></biz>
    const bizMixedOpts = {
      customNodes: [
        {
          tag: 'biz',
          attrs: {},
          content: [
            {
              tag: 'interactive',
              attrs: { type: 'native_flow', v: '1' },
              content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' }, content: undefined }],
            },
          ],
        },
      ],
    };

    const sendOptions: any = {
      ...bizMixedOpts,
    };

    let ephemeralContext: any = undefined;
    if (data.expirationSeconds && data.expirationSeconds > 0) {
      const exp = Number(data.expirationSeconds);
      const nowSec = Math.floor(Date.now() / 1000);
      sendOptions.expirationSeconds = exp;
      sendOptions.ephemeralSettingTimestamp = nowSec;
      ephemeralContext = {
        expiration: exp,
        ephemeralSettingTimestamp: nowSec,
        disappearingMode: { initiator: 0, trigger: 1 },
      };
      sendOptions.contextInfo = ephemeralContext;
    }

    const fallback1x1Png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const uploadCardImage = async (
      imageUrl?: string,
      cacheMap?: Map<string, Promise<any>>
    ): Promise<proto.Message.IImageMessage> => {
      const targetUrl = imageUrl?.trim();

      if (targetUrl && cacheMap?.has(targetUrl)) {
        return cacheMap.get(targetUrl)!;
      }

      const uploadPromise = (async () => {
        try {
          let buffer: Buffer | null = null;
          let mimetype = 'image/png';

          if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(targetUrl, { signal: controller.signal });
            clearTimeout(timeout);
            if (res.ok) {
              buffer = Buffer.from(await res.arrayBuffer());
              const ct = res.headers.get('content-type');
              if (ct) {
                mimetype = ct.includes('jpeg') || ct.includes('jpg') ? 'image/jpeg' : 'image/png';
              }
            }
          } else if (targetUrl && (targetUrl.startsWith('data:image/') || targetUrl.includes(';base64,'))) {
            const match = targetUrl.match(/^data:([^;]+);base64,(.+)$/s);
            if (match) {
              mimetype = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
              buffer = Buffer.from(match[2].trim(), 'base64');
            } else {
              const parts = targetUrl.split(';base64,');
              if (parts.length === 2) {
                mimetype = parts[0].replace('data:', '');
                buffer = Buffer.from(parts[1].trim(), 'base64');
              }
            }
          }

          if (!buffer || buffer.length === 0) {
            buffer = fallback1x1Png;
            mimetype = 'image/png';
          }

          const media = await client.message.upload(buffer, { type: 'image', mimetype });
          return {
            url: media.url,
            directPath: media.directPath,
            mediaKey: media.mediaKey,
            fileSha256: media.fileSha256,
            fileEncSha256: media.fileEncSha256,
            fileLength: media.fileLength,
            mediaKeyTimestamp: media.mediaKeyTimestamp || Math.floor(Date.now() / 1000),
            mimetype: media.mimetype ?? mimetype,
            width: 640,
            height: 640,
          };
        } catch (err) {
          console.error('[ZapoMessageAdapter] Error uploading card image, using fallback:', err);
          const media = await client.message.upload(fallback1x1Png, { type: 'image', mimetype: 'image/png' });
          return {
            url: media.url,
            directPath: media.directPath,
            mediaKey: media.mediaKey,
            fileSha256: media.fileSha256,
            fileEncSha256: media.fileEncSha256,
            fileLength: media.fileLength,
            mediaKeyTimestamp: media.mediaKeyTimestamp || Math.floor(Date.now() / 1000),
            mimetype: 'image/png',
            width: 640,
            height: 640,
          };
        }
      })();

      if (targetUrl && cacheMap) {
        cacheMap.set(targetUrl, uploadPromise);
      }

      return uploadPromise;
    };

    const cardsList = Array.isArray(data.cards) ? data.cards : [];
    if (cardsList.length > 0) {
      const cacheMap = new Map<string, Promise<any>>();
      const processedCards = await Promise.all(
        cardsList.map(async (c, cardIdx) => {
          const imageMessage = await uploadCardImage(c.imageUrl, cacheMap);

          const btnList = Array.isArray(c.buttons) ? c.buttons : [];
          const flowBtns = btnList.map((b: any, btnIdx: number) => {
            const btnText = b.displayText || b.display_text || `Ação ${btnIdx + 1}`;
            const btnType = b.type || (b.url ? 'cta_url' : 'quick_reply');

            if (btnType === 'cta_url' || b.url) {
              return {
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                  display_text: btnText,
                  url: b.url || 'https://zaptroll.multivus.com.br',
                }),
              };
            }
            if (btnType === 'cta_call' || b.phoneNumber) {
              return {
                name: 'cta_call',
                buttonParamsJson: JSON.stringify({
                  display_text: btnText,
                  phone_number: b.phoneNumber || '',
                }),
              };
            }
            if (btnType === 'cta_copy' || b.code) {
              return {
                name: 'cta_copy',
                buttonParamsJson: JSON.stringify({
                  display_text: btnText,
                  copy_code: b.code || '',
                }),
              };
            }
            return {
              name: 'quick_reply',
              buttonParamsJson: JSON.stringify({
                display_text: btnText,
                id: b.id || `card_${cardIdx + 1}_btn_${btnIdx + 1}`,
              }),
            };
          });

          return {
            header: {
              title: c.title,
              hasMediaAttachment: true,
              imageMessage,
            },
            body: { text: c.text },
            nativeFlowMessage: {
              messageVersion: 1,
              buttons: flowBtns,
            },
          };
        })
      );

      const content = {
        interactiveMessage: {
          body: { text: data.bodyText },
          footer: data.footerText ? { text: data.footerText } : undefined,
          contextInfo: ephemeralContext,
          carouselMessage: {
            messageVersion: 1,
            cards: processedCards,
          },
        },
      };

      return client.message.send(jid, content as any, sendOptions as any);
    }

    // Legacy fallback
    const fallbackImage = await uploadCardImage();
    const legacyButtons = (data.buttons || []).map((b) => {
      if (b.url) {
        return {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: b.display_text,
            url: b.url,
          }),
        };
      }
      return {
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
          display_text: b.display_text,
          id: b.id || b.display_text.toLowerCase().replace(/\s+/g, '_'),
        }),
      };
    });

    const fallbackCards = [
      {
        header: {
          title: 'Zaptroll Interativo',
          hasMediaAttachment: true,
          imageMessage: fallbackImage,
        },
        body: { text: data.bodyText },
        nativeFlowMessage: {
          messageVersion: 1,
          buttons: legacyButtons,
        },
      },
    ];

    const content = {
      interactiveMessage: {
        body: { text: data.bodyText },
        contextInfo: ephemeralContext,
        carouselMessage: {
          messageVersion: 1,
          cards: fallbackCards,
        },
      },
    };

    return client.message.send(jid, content as any, sendOptions as any);
  }

  // 6. Chat-wide Ephemeral Toggle
  static async setChatEphemeral(client: WaClient, jid: string, ephemeralExpiration: number) {
    if (jid.endsWith('@g.us') && typeof (client as any).group?.setEphemeralDuration === 'function') {
      return (client as any).group.setEphemeralDuration(jid, ephemeralExpiration);
    }

    const payload = {
      protocolMessage: {
        type: proto.Message.ProtocolMessage.Type.EPHEMERAL_SETTING,
        ephemeralExpiration, // in seconds: 0 disables, 86400 (24h), 604800 (7d), etc.
      },
    };

    return client.message.send(jid, payload);
  }

  // 7. Single Message Ephemeral (Mensagem Fantasma nativa que desaparece após a leitura)
  static async sendEphemeralMessage(
    client: WaClient,
    jid: string,
    text: string,
    expirationSeconds: number,
    experimental?: { afterReadDuration?: number; quote?: any }
  ) {
    const duration = Number(experimental?.afterReadDuration || expirationSeconds || 5);

    const contextInfo: any = {
      expiration: 0,
      ephemeralSettingTimestamp: Math.floor(Date.now() / 1000),
      disappearingMode: {
        initiator: 0,
        trigger: 1,
      },
      afterReadDuration: duration,
    };

    if (experimental?.quote) {
      contextInfo.stanzaId = experimental.quote.id;
      contextInfo.participant = experimental.quote.participant;
      contextInfo.remoteJid = experimental.quote.remoteJid;
      contextInfo.quotedMessage = experimental.quote.message;
    }

    const payload = {
      extendedTextMessage: {
        text,
        previewType: 0,
        contextInfo,
        inviteLinkGroupTypeV2: 0,
      },
    };

    return client.message.send(jid, payload as any);
  }

  // 8. Revoke Message (Delete for everyone)
  static async revokeMessage(
    client: WaClient,
    jid: string,
    target: { stanzaId: string; fromMe?: boolean; participant?: string }
  ) {
    return client.message.send(jid, {
      type: 'revoke',
      target: {
        remoteJid: jid,
        id: target.stanzaId,
        fromMe: target.fromMe ?? true,
        participant: target.participant,
      },
    });
  }

  // 9. Raw Proto Send
  static async sendRawProto(client: WaClient, jid: string, rawPayload: any, expirationSeconds?: number) {
    const sendOptions: any = {};
    if (expirationSeconds && expirationSeconds > 0) {
      sendOptions.expirationSeconds = Number(expirationSeconds);
      sendOptions.ephemeralSettingTimestamp = Math.floor(Date.now() / 1000);
      sendOptions.contextInfo = {
        expiration: Number(expirationSeconds),
        ephemeralSettingTimestamp: Math.floor(Date.now() / 1000),
        disappearingMode: { initiator: 0, trigger: 1 },
      };
    }
    return client.message.send(jid, rawPayload, Object.keys(sendOptions).length ? sendOptions : undefined);
  }

  // 10. Send Audio / Voice Note
  static async sendAudio(
    client: WaClient,
    jid: string,
    media: Buffer | string,
    options?: { mimetype?: string; ptt?: boolean; seconds?: number; waveform?: Uint8Array | Buffer }
  ) {
    return client.message.send(jid, {
      type: 'audio',
      media,
      mimetype: options?.mimetype || 'audio/ogg; codecs=opus',
      ptt: options?.ptt ?? true,
      ...(options?.seconds ? { seconds: options.seconds } : {}),
      ...(options?.waveform ? { waveform: options.waveform } : {}),
    } as any);
  }

  // 11. Send Sticker
  static async sendSticker(
    client: WaClient,
    jid: string,
    media: Buffer | string,
    options?: { mimetype?: string; isAnimated?: boolean }
  ) {
    return client.message.send(jid, {
      type: 'sticker',
      media,
      mimetype: options?.mimetype || 'image/webp',
      ...(options?.isAnimated !== undefined ? { isAnimated: options.isAnimated } : {}),
    } as any);
  }

  // 11.1 Send Image
  static async sendImage(
    client: WaClient,
    jid: string,
    data: { url?: string; media?: Buffer | string; caption?: string; mimetype?: string }
  ) {
    const media = data.media || data.url;
    return client.message.send(jid, {
      type: 'image',
      media,
      caption: data.caption,
      mimetype: data.mimetype || 'image/jpeg',
    } as any);
  }

  // 11.2 Send Video
  static async sendVideo(
    client: WaClient,
    jid: string,
    data: { url?: string; media?: Buffer | string; caption?: string; mimetype?: string }
  ) {
    const media = data.media || data.url;
    return client.message.send(jid, {
      type: 'video',
      media,
      caption: data.caption,
      mimetype: data.mimetype || 'video/mp4',
    } as any);
  }

  // 12. Send Ghost Mention (Menção Fantasma / Invisível)
  static async sendGhostMention(
    client: WaClient,
    jid: string,
    text: string,
    mentionedJids: string[],
    options?: { quote?: any; ephemeralExpiration?: number }
  ) {
    const contextInfo: any = {
      mentionedJid: mentionedJids,
    };
    if (options?.ephemeralExpiration) {
      contextInfo.expiration = options.ephemeralExpiration;
      contextInfo.ephemeralSettingTimestamp = Math.floor(Date.now() / 1000);
    }
    if (options?.quote) {
      contextInfo.stanzaId = options.quote.id;
      contextInfo.participant = options.quote.participant;
      contextInfo.remoteJid = options.quote.remoteJid;
      contextInfo.quotedMessage = options.quote.message;
    }

    const payload = {
      extendedTextMessage: {
        text,
        previewType: 0,
        contextInfo,
      },
    };

    return client.message.send(jid, payload as any);
  }

  // 13. Send Meta-Hosted Privacy Banner (Inspirado no zapo-interactive-examples por Jobas Fernandes)
  static async sendMetaHostedBanner(
    client: WaClient,
    jid: string,
    messageText = 'Olá! Esta conversa agora está configurada com serviços seguros da Meta.'
  ) {
    if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid')) {
      throw new Error('O banner da Meta só pode ser aplicado em conversas privadas (não em grupos).');
    }

    const now = Math.floor(Date.now() / 1000);
    // Passo 1: Envia o switch text com modo end-to-end (actors=1)
    await client.message.send(jid, '👋', {
      customNodes: [
        {
          tag: 'biz',
          attrs: { actual_actors: '1', host_storage: '1', privacy_mode_ts: String(now) },
        },
      ],
    } as any);

    // Passo 2: Envia a mensagem real carimbada como hospedada pela Meta (actors=2)
    return client.message.send(jid, messageText, {
      customNodes: [
        {
          tag: 'biz',
          attrs: { actual_actors: '2', host_storage: '2', privacy_mode_ts: String(now + 1) },
        },
      ],
    } as any);
  }

  // 14. Send Message with Native "IA" Badge (Inspirado no zapo-interactive-examples por Jobas Fernandes)
  static async sendWithAiBadge(
    client: WaClient,
    jid: string,
    text: string,
    options?: { quote?: any }
  ) {
    const isGroup = jid.endsWith('@g.us');
    const sendOptions: any = {};
    if (options?.quote) {
      sendOptions.quote = options.quote;
    }
    // WhatsApp só aceita o nó biz_bot em conversas privadas (em grupos gera NACK 479)
    if (!isGroup) {
      sendOptions.customNodes = [{ tag: 'bot', attrs: { biz_bot: '1' } }];
    }

    return client.message.send(jid, text, sendOptions);
  }

  // 15. Send Group Status / Stories (groupStatusMessageV2) (Inspirado no zapo-interactive-examples por Jobas Fernandes)
  static async sendGroupStatus(
    client: WaClient,
    groupJid: string,
    mediaBytes: Uint8Array | Buffer,
    caption?: string,
    options?: {
      width?: number;
      height?: number;
      jpegThumbnail?: Uint8Array;
      mentionedJids?: string[];
    }
  ) {
    if (!groupJid.endsWith('@g.us')) {
      throw new Error(`Status de grupo deve ser enviado para um JID de grupo (@g.us). Recebido: ${groupJid}`);
    }

    const upload = await client.message.upload(mediaBytes, { type: 'image', mimetype: 'image/jpeg' });
    const payload = {
      messageContextInfo: { messageSecret: randomBytes(32) },
      groupStatusMessageV2: {
        message: {
          imageMessage: {
            url: upload.url,
            directPath: upload.directPath,
            mediaKey: upload.mediaKey,
            fileSha256: upload.fileSha256,
            fileEncSha256: upload.fileEncSha256,
            fileLength: upload.fileLength,
            mediaKeyTimestamp: upload.mediaKeyTimestamp,
            mimetype: upload.mimetype || 'image/jpeg',
            width: options?.width || 1080,
            height: options?.height || 1920,
            caption: caption || '',
            ...(options?.jpegThumbnail ? { jpegThumbnail: options.jpegThumbnail } : {}),
            contextInfo: {
              isGroupStatus: true,
              ...(options?.mentionedJids && options.mentionedJids.length > 0
                ? { mentionedJid: options.mentionedJids }
                : {}),
            },
          },
        },
      },
    };

    return client.message.send(groupJid, payload as any, {
      customNodes: [{ tag: 'meta', attrs: { is_group_status: 'true', origin: 'group_status' }, content: undefined }],
      disableGroupEphemeralAutoInject: true,
      ackTimeoutMs: 30000,
    } as any);
  }

  // 15b. Send Video Group Status / Stories (groupStatusMessageV2)
  static async sendGroupStatusVideo(
    client: WaClient,
    groupJid: string,
    mediaBytes: Uint8Array | Buffer,
    caption?: string,
    options?: {
      mimetype?: string;
      seconds?: number;
      jpegThumbnail?: Uint8Array;
      mentionedJids?: string[];
    }
  ) {
    if (!groupJid.endsWith('@g.us')) {
      throw new Error(`Status de grupo deve ser enviado para um JID de grupo (@g.us). Recebido: ${groupJid}`);
    }

    const upload = await client.message.upload(mediaBytes, { type: 'video', mimetype: options?.mimetype || 'video/mp4' });
    const payload = {
      messageContextInfo: { messageSecret: randomBytes(32) },
      groupStatusMessageV2: {
        message: {
          videoMessage: {
            url: upload.url,
            directPath: upload.directPath,
            mediaKey: upload.mediaKey,
            fileSha256: upload.fileSha256,
            fileEncSha256: upload.fileEncSha256,
            fileLength: upload.fileLength,
            mediaKeyTimestamp: upload.mediaKeyTimestamp,
            mimetype: upload.mimetype || options?.mimetype || 'video/mp4',
            seconds: options?.seconds || 15,
            caption: caption || '',
            ...(options?.jpegThumbnail ? { jpegThumbnail: options.jpegThumbnail } : {}),
            contextInfo: {
              isGroupStatus: true,
              ...(options?.mentionedJids && options.mentionedJids.length > 0
                ? { mentionedJid: options.mentionedJids }
                : {}),
            },
          },
        },
      },
    };

    return client.message.send(groupJid, payload as any, {
      customNodes: [{ tag: 'meta', attrs: { is_group_status: 'true', origin: 'group_status' }, content: undefined }],
      disableGroupEphemeralAutoInject: true,
      ackTimeoutMs: 30000,
    } as any);
  }

  // 15c. Send Personal Status Video to status@broadcast
  static async sendStatusVideo(
    client: WaClient,
    recipients: string[],
    media: Buffer | Uint8Array | string,
    caption?: string,
    options?: { mimetype?: string; seconds?: number }
  ) {
    if (client.status && typeof client.status.send === 'function') {
      return client.status.send({
        content: {
          type: 'video',
          media,
          mimetype: options?.mimetype || 'video/mp4',
          caption: caption || '',
          seconds: options?.seconds,
        } as any,
        recipients,
        statusSetting: 'contacts',
      });
    }

    const upload = await client.message.upload(media, { type: 'video', mimetype: options?.mimetype || 'video/mp4' });
    return client.message.send('status@broadcast', {
      videoMessage: {
        url: upload.url,
        directPath: upload.directPath,
        mediaKey: upload.mediaKey,
        fileSha256: upload.fileSha256,
        fileEncSha256: upload.fileEncSha256,
        fileLength: upload.fileLength,
        mediaKeyTimestamp: upload.mediaKeyTimestamp,
        mimetype: upload.mimetype || options?.mimetype || 'video/mp4',
        caption: caption || '',
        seconds: options?.seconds || 15,
      },
    } as any);
  }

  // 16. Send Native WhatsApp Poll (Inspirado no zapo-interactive-examples por Jobas Fernandes)
  static async sendPoll(
    client: WaClient,
    jid: string,
    question: string,
    options: string[],
    selectableCount = 1
  ) {
    return client.message.send(jid, {
      type: 'poll',
      name: question,
      options: options.map((opt) => (typeof opt === 'string' ? opt : (opt as any).name)),
      selectableCount,
    } as any);
  }
}
