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
      buttons: Array<{ buttonId: string; displayText: string }>;
    }
  ) {
    const payload = {
      buttonsMessage: {
        contentText: data.contentText,
        footerText: data.footerText,
        headerType: proto.Message.ButtonsMessage.HeaderType.TEXT,
        text: data.headerText || '',
        buttons: data.buttons.map((b) => ({
          buttonId: b.buttonId,
          buttonText: { displayText: b.displayText },
          type: proto.Message.ButtonsMessage.Button.Type.RESPONSE,
        })),
      },
    };

    return client.message.send(jid, payload);
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
      sections: Array<{
        title: string;
        rows: Array<{ rowId: string; title: string; description?: string }>;
      }>;
    }
  ) {
    const payload = {
      listMessage: {
        title: data.title,
        description: data.description,
        buttonText: data.buttonText,
        footerText: data.footerText,
        listType: proto.Message.ListMessage.ListType.SINGLE_SELECT,
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

    return client.message.send(jid, payload);
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
    }
  ) {
    const payload = {
      interactiveMessage: {
        body: { text: data.bodyText },
        footer: data.footerText ? { text: data.footerText } : undefined,
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

    return client.message.send(jid, payload);
  }

  // 5. Native Flow Multi-Action / Carousel Cards
  static async sendCarousel(
    client: WaClient,
    jid: string,
    data: {
      bodyText: string;
      footerText?: string;
      buttons: Array<{ name: string; display_text: string; url?: string; id?: string }>;
    }
  ) {
    const nativeButtons = data.buttons.map((b) => {
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

    const payload = {
      interactiveMessage: {
        body: { text: data.bodyText },
        footer: data.footerText ? { text: data.footerText } : undefined,
        nativeFlowMessage: {
          buttons: nativeButtons,
          messageVersion: 1,
        },
      },
    };

    return client.message.send(jid, payload);
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
  static async sendRawProto(client: WaClient, jid: string, rawPayload: any) {
    return client.message.send(jid, rawPayload);
  }
}
