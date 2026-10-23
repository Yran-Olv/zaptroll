import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoiceCommandDispatcher } from '../src/modules/voice/VoiceCommandDispatcher.js';
import { KordixVoiceService, POPULAR_VOICES } from '../src/modules/voice/KordixVoiceService.js';
import { ZapoMessageAdapter } from '../src/integrations/zapo/ZapoMessageAdapter.js';

describe('Voice Command & Kordix TTS Module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('VoiceCommandDispatcher.isVoiceTrigger', () => {
    it('should detect &vozkordix commands in various formats', () => {
      expect(VoiceCommandDispatcher.isVoiceTrigger('&vozkordix lula | ola')).toBe(true);
      expect(VoiceCommandDispatcher.isVoiceTrigger('/vozkordix bolsonaro | talkey')).toBe(true);
      expect(VoiceCommandDispatcher.isVoiceTrigger('!vozkordix goku | kamehameha')).toBe(true);
      expect(VoiceCommandDispatcher.isVoiceTrigger('.vozkordix bob_esponja | pronto')).toBe(true);
      expect(VoiceCommandDispatcher.isVoiceTrigger('&vozkordix')).toBe(true);
    });

    it('should detect short &voz and /voz aliases', () => {
      expect(VoiceCommandDispatcher.isVoiceTrigger('&voz lula | companheiros')).toBe(true);
      expect(VoiceCommandDispatcher.isVoiceTrigger('/voz bolsonaro | boa noite')).toBe(true);
      expect(VoiceCommandDispatcher.isVoiceTrigger('!voz silvio_santos | quem quer dinheiro')).toBe(true);
      expect(VoiceCommandDispatcher.isVoiceTrigger('#voz faustao | loco bicho')).toBe(true);
      expect(VoiceCommandDispatcher.isVoiceTrigger('/vozes')).toBe(true);
      expect(VoiceCommandDispatcher.isVoiceTrigger('&vozes')).toBe(true);
    });

    it('should reject normal messages and other commands', () => {
      expect(VoiceCommandDispatcher.isVoiceTrigger('ola tudo bem')).toBe(false);
      expect(VoiceCommandDispatcher.isVoiceTrigger('/jogo')).toBe(false);
      expect(VoiceCommandDispatcher.isVoiceTrigger('/ai quem foi lula?')).toBe(false);
      expect(VoiceCommandDispatcher.isVoiceTrigger('🐊 jacare')).toBe(false);
      expect(VoiceCommandDispatcher.isVoiceTrigger('')).toBe(false);
    });
  });

  describe('KordixVoiceService.resolveVoiceName', () => {
    it('should resolve political figure aliases to official IDs', () => {
      expect(KordixVoiceService.resolveVoiceName('lula')).toBe('782');
      expect(KordixVoiceService.resolveVoiceName('inacio')).toBe('782');
      expect(KordixVoiceService.resolveVoiceName('bolsonaro')).toBe('790');
      expect(KordixVoiceService.resolveVoiceName('mito')).toBe('790');
      expect(KordixVoiceService.resolveVoiceName('dilma')).toBe('dilma');
    });

    it('should resolve anime and cartoon characters to official Brazilian dubbing IDs', () => {
      expect(KordixVoiceService.resolveVoiceName('bob esponja')).toBe('805');
      expect(KordixVoiceService.resolveVoiceName('bobesponja')).toBe('805');
      expect(KordixVoiceService.resolveVoiceName('"bob_esponja"')).toBe('805');
      // Goku agora aponta para o ID oficial da dublagem brasileira do Wendell Bezerra (10480)
      expect(KordixVoiceService.resolveVoiceName('goku')).toBe('10480');
      expect(KordixVoiceService.resolveVoiceName('son goku')).toBe('10480');
      expect(KordixVoiceService.resolveVoiceName('vegeta')).toBe('188972');
      expect(KordixVoiceService.resolveVoiceName('pica pau')).toBe('23360');
      expect(KordixVoiceService.resolveVoiceName('madruga')).toBe('18347');
    });

    it('should resolve TV and celebrity figures to official Brazilian voice IDs', () => {
      expect(KordixVoiceService.resolveVoiceName('silvio santos')).toBe('9280');
      expect(KordixVoiceService.resolveVoiceName('silviosantos')).toBe('9280');
      expect(KordixVoiceService.resolveVoiceName('faustão')).toBe('135283');
      expect(KordixVoiceService.resolveVoiceName('mano brown')).toBe('54606');
      expect(KordixVoiceService.resolveVoiceName('elon musk')).toBe('1');
    });

    it('should preserve numeric voice IDs', () => {
      expect(KordixVoiceService.resolveVoiceName('782')).toBe('782');
      expect(KordixVoiceService.resolveVoiceName('805')).toBe('805');
    });
  });

  describe('VoiceCommandDispatcher.handleMessage execution flow', () => {
    it('should send help message when command is empty or requesting help', async () => {
      const mockClient = { message: { send: vi.fn().mockResolvedValue({ id: 'msg_help' }) } } as any;
      const sendReactionSpy = vi.spyOn(ZapoMessageAdapter, 'sendReaction').mockResolvedValue({} as any);
      const sendTextSpy = vi.spyOn(ZapoMessageAdapter, 'sendText').mockResolvedValue({} as any);

      const handled = await VoiceCommandDispatcher.handleMessage({
        client: mockClient,
        connectionId: 'conn_test',
        userId: 'user_test',
        remoteJid: '120363432289926956@g.us',
        senderJid: '551199999999@s.whatsapp.net',
        fromMe: false,
        stanzaId: 'st_123',
        text: '&vozkordix',
        rawEventKey: { id: 'st_123' },
      });

      expect(handled).toBe(true);
      expect(sendReactionSpy).toHaveBeenCalledWith(mockClient, '120363432289926956@g.us', '🎙️', expect.any(Object));
      expect(sendTextSpy).toHaveBeenCalled();
      const sentText = sendTextSpy.mock.calls[0][2];
      expect(sentText).toContain('ZAPTROLL — VOZES DE PERSONAGENS');
      expect(sentText).toContain('lula');
      expect(sentText).toContain('bolsonaro');
      expect(sentText).toContain('bob_esponja');
    });

    it('should guide user if text is missing', async () => {
      const mockClient = { message: { send: vi.fn().mockResolvedValue({ id: 'msg_1' }) } } as any;
      vi.spyOn(ZapoMessageAdapter, 'sendReaction').mockResolvedValue({} as any);
      const sendTextSpy = vi.spyOn(ZapoMessageAdapter, 'sendText').mockResolvedValue({} as any);

      const handled = await VoiceCommandDispatcher.handleMessage({
        client: mockClient,
        connectionId: 'conn_test',
        userId: 'user_test',
        remoteJid: '120363432289926956@g.us',
        senderJid: '551199999999@s.whatsapp.net',
        fromMe: false,
        stanzaId: 'st_124',
        text: '&vozkordix lula',
        rawEventKey: { id: 'st_124' },
      });

      expect(handled).toBe(true);
      expect(sendTextSpy).toHaveBeenCalled();
      const sentText = sendTextSpy.mock.calls[0][2];
      expect(sentText).toContain('Você precisa informar o que a voz deve falar');
    });

    it('should parse voice and text with quotes and pipe, synthesize and send audio', async () => {
      const mockClient = { message: { send: vi.fn().mockResolvedValue({ id: 'msg_audio' }) } } as any;
      const sendReactionSpy = vi.spyOn(ZapoMessageAdapter, 'sendReaction').mockResolvedValue({} as any);
      const sendAudioSpy = vi.spyOn(ZapoMessageAdapter, 'sendAudio').mockResolvedValue({ id: 'aud_ack' } as any);

      vi.spyOn(KordixVoiceService, 'synthesize').mockResolvedValue({
        audioBuffer: Buffer.from('mock_audio_data'),
        mimetype: 'audio/ogg; codecs=opus',
        voiceName: 'lula',
        durationEstimateSec: 3,
        audioUrl: 'https://cdn.zone.api.br/test.mp3',
      });

      const handled = await VoiceCommandDispatcher.handleMessage({
        client: mockClient,
        connectionId: 'conn_test',
        userId: 'user_test',
        remoteJid: '120363432289926956@g.us',
        senderJid: '551199999999@s.whatsapp.net',
        fromMe: false,
        stanzaId: 'st_125',
        text: '&vozkordix "lula" | "olá boa noite"',
        rawEventKey: { id: 'st_125' },
      });

      expect(handled).toBe(true);
      // Reação inicial de gravação
      expect(sendReactionSpy).toHaveBeenCalledWith(mockClient, '120363432289926956@g.us', '🎙️', expect.any(Object));
      // Envio do áudio como PTT nativo
      expect(sendAudioSpy).toHaveBeenCalledWith(
        mockClient,
        '120363432289926956@g.us',
        expect.any(Buffer),
        expect.objectContaining({ ptt: true })
      );
      // Reação de sucesso 🔊
      expect(sendReactionSpy).toHaveBeenCalledWith(mockClient, '120363432289926956@g.us', '🔊', expect.any(Object));
    });

    it('should synthesize and respond directly to user preferred format: &voz bolsonaro | o texto', async () => {
      const mockClient = { message: { send: vi.fn().mockResolvedValue({ id: 'msg_audio_bolsonaro' }) } } as any;
      const sendReactionSpy = vi.spyOn(ZapoMessageAdapter, 'sendReaction').mockResolvedValue({} as any);
      const sendAudioSpy = vi.spyOn(ZapoMessageAdapter, 'sendAudio').mockResolvedValue({ id: 'aud_ack_bolso' } as any);

      const synthSpy = vi.spyOn(KordixVoiceService, 'synthesize').mockResolvedValue({
        audioBuffer: Buffer.from('mock_audio_bolsonaro'),
        mimetype: 'audio/ogg; codecs=opus',
        voiceName: 'bolsonaro',
        durationEstimateSec: 4,
        audioUrl: 'https://cdn.zone.api.br/bolso.mp3',
      });

      const handled = await VoiceCommandDispatcher.handleMessage({
        client: mockClient,
        connectionId: 'conn_test',
        userId: 'user_test',
        remoteJid: '120363432289926956@g.us',
        senderJid: '551199999999@s.whatsapp.net',
        fromMe: false,
        stanzaId: 'st_126',
        text: '&voz bolsonaro | o texto',
        rawEventKey: { id: 'st_126' },
      });

      expect(handled).toBe(true);
      expect(synthSpy).toHaveBeenCalledWith({
        voice: 'bolsonaro',
        text: 'o texto',
        effect: 'none',
      });
      expect(sendReactionSpy).toHaveBeenCalledWith(mockClient, '120363432289926956@g.us', '🎙️', expect.any(Object));
      expect(sendAudioSpy).toHaveBeenCalledWith(
        mockClient,
        '120363432289926956@g.us',
        expect.any(Buffer),
        expect.objectContaining({ ptt: true })
      );
      expect(sendReactionSpy).toHaveBeenCalledWith(mockClient, '120363432289926956@g.us', '🔊', expect.any(Object));
    });

    it('should support &voz musical with studio effect and musical reactions', async () => {
      const mockClient = { message: { send: vi.fn().mockResolvedValue({ id: 'msg_music' }) } } as any;
      const sendReactionSpy = vi.spyOn(ZapoMessageAdapter, 'sendReaction').mockResolvedValue({} as any);
      const sendAudioSpy = vi.spyOn(ZapoMessageAdapter, 'sendAudio').mockResolvedValue({ id: 'aud_ack_music' } as any);

      const synthSpy = vi.spyOn(KordixVoiceService, 'synthesize').mockResolvedValue({
        audioBuffer: Buffer.from('mock_audio_music'),
        mimetype: 'audio/ogg; codecs=opus',
        voiceName: 'lula',
        durationEstimateSec: 5,
        audioUrl: 'https://cdn.zone.api.br/music.mp3',
        effect: 'musical',
      });

      const handled = await VoiceCommandDispatcher.handleMessage({
        client: mockClient,
        connectionId: 'conn_test',
        userId: 'user_test',
        remoteJid: '120363432289926956@g.us',
        senderJid: '551199999999@s.whatsapp.net',
        fromMe: false,
        stanzaId: 'st_128',
        text: '&voz lula musical | essa e a nova cancao',
        rawEventKey: { id: 'st_128' },
      });

      expect(handled).toBe(true);
      expect(sendReactionSpy).toHaveBeenCalledWith(mockClient, '120363432289926956@g.us', '🎤', expect.any(Object));
      expect(synthSpy).toHaveBeenCalledWith({
        voice: 'lula',
        text: expect.stringContaining('🎵 essa e a nova cancao 🎵'),
        effect: 'musical',
      });
      expect(sendReactionSpy).toHaveBeenCalledWith(mockClient, '120363432289926956@g.us', '🎶', expect.any(Object));
    });

    it('should support &voz chorando with tremolo effect and crying reactions', async () => {
      const mockClient = { message: { send: vi.fn().mockResolvedValue({ id: 'msg_crying' }) } } as any;
      const sendReactionSpy = vi.spyOn(ZapoMessageAdapter, 'sendReaction').mockResolvedValue({} as any);
      const sendAudioSpy = vi.spyOn(ZapoMessageAdapter, 'sendAudio').mockResolvedValue({ id: 'aud_ack_crying' } as any);

      const synthSpy = vi.spyOn(KordixVoiceService, 'synthesize').mockResolvedValue({
        audioBuffer: Buffer.from('mock_audio_crying'),
        mimetype: 'audio/ogg; codecs=opus',
        voiceName: 'bolsonaro',
        durationEstimateSec: 6,
        audioUrl: 'https://cdn.zone.api.br/crying.mp3',
        effect: 'chorando',
      });

      const handled = await VoiceCommandDispatcher.handleMessage({
        client: mockClient,
        connectionId: 'conn_test',
        userId: 'user_test',
        remoteJid: '120363432289926956@g.us',
        senderJid: '551199999999@s.whatsapp.net',
        fromMe: false,
        stanzaId: 'st_129',
        text: '&voz bolsonaro chorando | por que voce fez isso',
        rawEventKey: { id: 'st_129' },
      });

      expect(handled).toBe(true);
      expect(sendReactionSpy).toHaveBeenCalledWith(mockClient, '120363432289926956@g.us', '🥺', expect.any(Object));
      expect(synthSpy).toHaveBeenCalledWith({
        voice: 'bolsonaro',
        text: expect.stringContaining('buááá'),
        effect: 'chorando',
      });
      expect(sendReactionSpy).toHaveBeenCalledWith(mockClient, '120363432289926956@g.us', '😭', expect.any(Object));
    });

    it('should notify user clearly when API key has expired', async () => {
      const mockClient = { message: { send: vi.fn().mockResolvedValue({ id: 'msg_err' }) } } as any;
      const sendReactionSpy = vi.spyOn(ZapoMessageAdapter, 'sendReaction').mockResolvedValue({} as any);
      const sendTextSpy = vi.spyOn(ZapoMessageAdapter, 'sendText').mockResolvedValue({} as any);

      vi.spyOn(KordixVoiceService, 'synthesize').mockRejectedValue(
        new Error('Chave de API Kordix expirada. Renove sua assinatura.')
      );

      const handled = await VoiceCommandDispatcher.handleMessage({
        client: mockClient,
        connectionId: 'conn_test',
        userId: 'user_test',
        remoteJid: '120363432289926956@g.us',
        senderJid: '551199999999@s.whatsapp.net',
        fromMe: false,
        stanzaId: 'st_127',
        text: '&voz lula | teste expirado',
        rawEventKey: { id: 'st_127' },
      });

      expect(handled).toBe(true);
      expect(sendReactionSpy).toHaveBeenCalledWith(mockClient, '120363432289926956@g.us', '❌', expect.any(Object));
      expect(sendTextSpy).toHaveBeenCalled();
      const sentText = sendTextSpy.mock.calls[0][2];
      expect(sentText).toContain('Chave de API Kordix Expirada');
      expect(sentText).toContain('zone.api.br/store');
    });
  });

  describe('KordixVoiceService Effects & Cache Mechanism', () => {
    beforeEach(() => {
      KordixVoiceService.clearCache();
    });

    it('should parse voice names and effect modifiers accurately', () => {
      expect(KordixVoiceService.parseVoiceAndEffect('lula musical')).toEqual({ voice: 'lula', effect: 'musical' });
      expect(KordixVoiceService.parseVoiceAndEffect('lula cantando')).toEqual({ voice: 'lula', effect: 'musical' });
      expect(KordixVoiceService.parseVoiceAndEffect('bolsonaro chorando')).toEqual({ voice: 'bolsonaro', effect: 'chorando' });
      expect(KordixVoiceService.parseVoiceAndEffect('goku estourado')).toEqual({ voice: 'goku', effect: 'estourado' });
      expect(KordixVoiceService.parseVoiceAndEffect('silvio_santos esquilo')).toEqual({ voice: 'silvio_santos', effect: 'esquilo' });
      expect(KordixVoiceService.parseVoiceAndEffect('batman monstro')).toEqual({ voice: 'batman', effect: 'monstro' });
      expect(KordixVoiceService.parseVoiceAndEffect('lula:musical')).toEqual({ voice: 'lula', effect: 'musical' });
      expect(KordixVoiceService.parseVoiceAndEffect('bob_esponja')).toEqual({ voice: 'bob_esponja', effect: 'none' });
    });

    it('should cache synthesized results and differentiate by effect', async () => {
      expect(KordixVoiceService.getCacheSize()).toBe(0);

      const fakeMp3 = Buffer.from('fake_mp3_data');
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: true, audio: 'https://cdn.zone.api.br/audio123.mp3', voice_id: 782 }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => fakeMp3.buffer,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: true, audio: 'https://cdn.zone.api.br/audio456.mp3', voice_id: 782 }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => fakeMp3.buffer,
        } as any);

      // 1ª chamada padrão: vai na rede
      const result1 = await KordixVoiceService.synthesize({ voice: 'lula', text: 'Bom dia companheiros', effect: 'none' });
      expect(result1.fromCache).toBeFalsy();
      expect(KordixVoiceService.getCacheSize()).toBe(1);

      // 2ª chamada idêntica: vem do cache
      const result2 = await KordixVoiceService.synthesize({ voice: 'lula', text: 'bom dia companheiros', effect: 'none' });
      expect(result2.fromCache).toBe(true);

      // 3ª chamada com efeito 'musical': deve ser tratada como nova chave de cache
      const result3 = await KordixVoiceService.synthesize({ voice: 'lula', text: 'bom dia companheiros', effect: 'musical' });
      expect(result3.fromCache).toBeFalsy();
      expect(KordixVoiceService.getCacheSize()).toBe(2);
    });
  });
});
