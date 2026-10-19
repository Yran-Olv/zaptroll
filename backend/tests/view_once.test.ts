import { describe, it, expect } from 'vitest';
import { extractMessageContent } from '../src/integrations/zapo/ViewOnceInterceptor.js';

describe('ViewOnceInterceptor — Single-View Media Extraction', () => {
  it('detects standard viewOnceMessage image', () => {
    const raw = {
      viewOnceMessage: {
        message: {
          imageMessage: {
            url: 'https://mmg.whatsapp.net/v/t62.7118-24/test.enc',
            mimetype: 'image/jpeg',
            fileSha256: Buffer.from('sha256'),
            fileLength: 12345,
            mediaKey: Buffer.from('key123'),
            caption: 'Segredo de Estado',
          },
        },
      },
    };

    const res = extractMessageContent(raw);
    expect(res.isViewOnce).toBe(true);
    expect(res.hasMedia).toBe(true);
    expect(res.mediaType).toBe('image');
    expect(res.caption).toBe('Segredo de Estado');
    expect(res.unwrappedMsg.imageMessage).toBeDefined();
  });

  it('detects viewOnceMessageV2 video', () => {
    const raw = {
      viewOnceMessageV2: {
        message: {
          videoMessage: {
            url: 'https://mmg.whatsapp.net/v/t62.7118-24/video.enc',
            mimetype: 'video/mp4',
            fileSha256: Buffer.from('sha256'),
            caption: 'Vídeo confidencial',
          },
        },
      },
    };

    const res = extractMessageContent(raw);
    expect(res.isViewOnce).toBe(true);
    expect(res.hasMedia).toBe(true);
    expect(res.mediaType).toBe('video');
    expect(res.caption).toBe('Vídeo confidencial');
  });

  it('detects viewOnceMessageV2Extension audio note', () => {
    const raw = {
      viewOnceMessageV2Extension: {
        message: {
          audioMessage: {
            url: 'https://mmg.whatsapp.net/v/t62.7118-24/audio.enc',
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true,
          },
        },
      },
    };

    const res = extractMessageContent(raw);
    expect(res.isViewOnce).toBe(true);
    expect(res.hasMedia).toBe(true);
    expect(res.mediaType).toBe('audio');
    expect(res.unwrappedMsg.audioMessage.ptt).toBe(true);
  });

  it('detects deeply nested ephemeral + viewOnce message', () => {
    const raw = {
      ephemeralMessage: {
        message: {
          viewOnceMessage: {
            message: {
              imageMessage: {
                mimetype: 'image/jpeg',
                caption: 'Foto efêmera de visualização única',
              },
            },
          },
        },
      },
    };

    const res = extractMessageContent(raw);
    expect(res.isViewOnce).toBe(true);
    expect(res.isEphemeral).toBe(true);
    expect(res.mediaType).toBe('image');
    expect(res.caption).toBe('Foto efêmera de visualização única');
  });

  it('detects viewOnce flag placed directly on imageMessage', () => {
    const raw = {
      imageMessage: {
        mimetype: 'image/jpeg',
        viewOnce: true,
        caption: 'Foto com flag interna',
      },
    };

    const res = extractMessageContent(raw);
    expect(res.isViewOnce).toBe(true);
    expect(res.mediaType).toBe('image');
    expect(res.caption).toBe('Foto com flag interna');
  });

  it('correctly leaves regular messages as non-viewOnce', () => {
    const rawText = {
      conversation: 'Olá mundo normal',
    };
    const resText = extractMessageContent(rawText);
    expect(resText.isViewOnce).toBe(false);
    expect(resText.hasMedia).toBe(false);
    expect(resText.mediaType).toBe('text');

    const rawImg = {
      imageMessage: {
        mimetype: 'image/jpeg',
        caption: 'Foto comum de família',
      },
    };
    const resImg = extractMessageContent(rawImg);
    expect(resImg.isViewOnce).toBe(false);
    expect(resImg.hasMedia).toBe(true);
    expect(resImg.mediaType).toBe('image');
  });
});
