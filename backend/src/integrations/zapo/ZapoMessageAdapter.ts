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

  // 7. Single Message Ephemeral (with optional experimental afterRead context)
  static async sendEphemeralMessage(
    client: WaClient,
    jid: string,
    text: string,
    expirationSeconds: number,
    experimental?: { afterReadDuration?: number; quote?: any }
  ) {
    const isGroup = jid.endsWith('@g.us');
    const sendOptions: any = {
      expirationSeconds,
      ...(isGroup ? {} : { ephemeralSettingTimestamp: Math.floor(Date.now() / 1000) }),
    };

    if (experimental?.quote) {
      sendOptions.quote = experimental.quote;
    }

    if (experimental?.afterReadDuration) {
      sendOptions.contextInfo = {
        expiration: expirationSeconds,
        ...(isGroup ? {} : { ephemeralSettingTimestamp: Math.floor(Date.now() / 1000) }),
        disappearingMode: { initiator: 0, trigger: 1 },
      };
    }

    return client.message.send(jid, { type: 'text', text }, sendOptions);
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
    options?: { mimetype?: string; ptt?: boolean; seconds?: number }
  ) {
    return client.message.send(jid, {
      type: 'audio',
      media,
      mimetype: options?.mimetype || 'audio/mpeg',
      ptt: options?.ptt ?? true,
      ...(options?.seconds ? { seconds: options.seconds } : {}),
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
}
