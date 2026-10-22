import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusService } from '../src/modules/advanced/StatusService.js';
import { zapoManager } from '../src/integrations/zapo/ZapoConnectionManager.js';
import { ZapoMessageAdapter } from '../src/integrations/zapo/ZapoMessageAdapter.js';
import { Conversation, Message } from '../src/database/models/index.js';

describe('StatusService — Video Stories Publishing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. rejects video exceeding 16MB size limit', async () => {
    const fakeClient: any = {
      getCredentials: () => ({ meJid: '5511999999999@s.whatsapp.net' }),
    };
    vi.spyOn(zapoManager, 'getClient').mockReturnValue(fakeClient);

    // 17MB buffer
    const bigBuffer = Buffer.alloc(17 * 1024 * 1024);
    const base64 = bigBuffer.toString('base64');

    await expect(
      StatusService.postStatus('conn-1', {
        type: 'video',
        videoBase64: base64,
        videoMimetype: 'video/mp4',
        caption: 'Vídeo Pesado',
      })
    ).rejects.toThrow(/excede o limite máximo permitido pelo WhatsApp \(16MB\)/);
  });

  it('2. blocks SSRF restricted URLs (e.g. AWS metadata 169.254.169.254, localhost, private subnets)', async () => {
    const fakeClient: any = {
      getCredentials: () => ({ meJid: '5511999999999@s.whatsapp.net' }),
    };
    vi.spyOn(zapoManager, 'getClient').mockReturnValue(fakeClient);

    await expect(
      StatusService.postStatus('conn-1', {
        type: 'video',
        videoUrl: 'http://169.254.169.254/latest/meta-data/',
        caption: 'SSRF Attack Attempt',
      })
    ).rejects.toThrow(/URL de vídeo restrita por proteção de segurança SSRF/);

    await expect(
      StatusService.postStatus('conn-1', {
        type: 'video',
        videoUrl: 'http://127.0.0.1:3000/internal-video.mp4',
        caption: 'Localhost SSRF Attempt',
      })
    ).rejects.toThrow(/URL de vídeo restrita por proteção de segurança SSRF/);
  });

  it('3. posts personal video story to status@broadcast with caption and recipients', async () => {
    const fakeClient: any = {
      getCredentials: () => ({ meJid: '5511999999999@s.whatsapp.net' }),
    };
    vi.spyOn(zapoManager, 'getClient').mockReturnValue(fakeClient);

    const sendVideoSpy = vi.spyOn(ZapoMessageAdapter, 'sendStatusVideo').mockResolvedValue({
      id: 'STATUS_VID_123',
    } as any);

    const smallBuffer = Buffer.from('fake-mp4-stream-data');
    const res = await StatusService.postStatus('conn-1', {
      type: 'video',
      videoBase64: smallBuffer.toString('base64'),
      videoMimetype: 'video/mp4',
      caption: 'Meu Story em Vídeo',
      recipients: ['5511888888888@s.whatsapp.net'],
    });

    expect(res.success).toBe(true);
    expect(sendVideoSpy).toHaveBeenCalledWith(
      fakeClient,
      expect.arrayContaining(['5511888888888@s.whatsapp.net']),
      expect.any(Buffer),
      'Meu Story em Vídeo',
      expect.objectContaining({ mimetype: 'video/mp4' })
    );
  });

  it('4. posts native video group status (groupStatusMessageV2) without falling back to image', async () => {
    const fakeClient: any = {
      getCredentials: () => ({ meJid: '5511999999999@s.whatsapp.net' }),
      group: {
        queryGroupMetadata: vi.fn().mockResolvedValue({ participants: [{ id: 'p1@s.whatsapp.net' }] }),
      },
    };
    vi.spyOn(zapoManager, 'getClient').mockReturnValue(fakeClient);

    const groupVideoSpy = vi.spyOn(ZapoMessageAdapter, 'sendGroupStatusVideo').mockResolvedValue({
      id: 'GRP_VID_456',
    } as any);
    const groupImageSpy = vi.spyOn(ZapoMessageAdapter, 'sendGroupStatus');

    vi.spyOn(Conversation, 'findOne').mockResolvedValue({ id: 'conv-grp-1', update: vi.fn() } as any);
    vi.spyOn(Message, 'create').mockResolvedValue({ id: 'msg-grp-1' } as any);

    const smallBuffer = Buffer.from('fake-group-video');
    const res = await StatusService.postStatus('conn-1', {
      type: 'video',
      videoBase64: smallBuffer.toString('base64'),
      targetGroups: ['120363000000000000@g.us'],
      caption: 'Vídeo no Grupo',
    });

    expect(res.success).toBe(true);
    expect(groupVideoSpy).toHaveBeenCalledWith(
      fakeClient,
      '120363000000000000@g.us',
      expect.any(Buffer),
      'Vídeo no Grupo',
      expect.objectContaining({ mimetype: 'video/mp4' })
    );
    // Deve garantir que NÃO chamou o envio de imagem de fallback
    expect(groupImageSpy).not.toHaveBeenCalled();
  });
});
