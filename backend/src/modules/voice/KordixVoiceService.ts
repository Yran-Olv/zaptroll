import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface VoiceOption {
  alias: string[];
  canonical: string;
  displayName: string;
  category: 'politica' | 'tv' | 'anime' | 'desenho' | 'pop';
  id?: number | string;
}

export const POPULAR_VOICES: VoiceOption[] = [
  // Políticos
  { alias: ['lula', 'inacio', 'presidente lula'], canonical: 'lula', displayName: 'Lula', category: 'politica', id: 782 },
  { alias: ['bolsonaro', 'jair', 'capitao', 'mito'], canonical: 'bolsonaro', displayName: 'Bolsonaro', category: 'politica', id: 790 },
  { alias: ['dilma', 'dilma rousseff'], canonical: 'dilma', displayName: 'Dilma Rousseff', category: 'politica' },

  // Desenhos & Animes (Dublagens Clássicas Brasileiras)
  { alias: ['goku', 'son goku', 'kakaroto'], canonical: 'goku', displayName: 'Goku (Wendell Bezerra)', category: 'anime', id: 10480 },
  { alias: ['vegeta', 'principe vegeta'], canonical: 'vegeta', displayName: 'Vegeta', category: 'anime', id: 188972 },
  { alias: ['bob_esponja', 'bobesponja', 'bob esponja', 'spongebob'], canonical: 'bob_esponja', displayName: 'Bob Esponja', category: 'desenho', id: 805 },
  { alias: ['chaves', 'el chavo'], canonical: 'chaves', displayName: 'Chaves (Marcelo Gastaldi)', category: 'desenho', id: 36437 },
  { alias: ['madruga', 'seu_madruga', 'seumadruga', 'don ramon'], canonical: 'madruga', displayName: 'Seu Madruga (Carlos Seidl)', category: 'desenho', id: 18347 },
  { alias: ['pica_pau', 'picapau', 'pica pau'], canonical: 'pica_pau', displayName: 'Pica-Pau', category: 'desenho', id: 23360 },
  { alias: ['homer', 'homer_simpson', 'homer simpson'], canonical: 'homer_simpson', displayName: 'Homer Simpson', category: 'desenho', id: 85618 },
  { alias: ['batman', 'cavaleiro das trevas'], canonical: 'batman', displayName: 'Batman', category: 'pop', id: 239632 },
  { alias: ['naruto', 'naruto uzumaki'], canonical: 'naruto', displayName: 'Naruto', category: 'anime' },
  { alias: ['mickey', 'mickey_mouse', 'mickey mouse'], canonical: 'mickey_mouse', displayName: 'Mickey Mouse', category: 'desenho', id: 102 },
  { alias: ['shrek'], canonical: 'shrek', displayName: 'Shrek', category: 'desenho' },

  // TV & Famosos
  { alias: ['silvio_santos', 'silviosantos', 'silvio', 'senor abravanel'], canonical: 'silvio_santos', displayName: 'Silvio Santos', category: 'tv', id: 9280 },
  { alias: ['faustao', 'faustão', 'fausto silva'], canonical: 'faustao', displayName: 'Faustão', category: 'tv', id: 135283 },
  { alias: ['galvao', 'galvão', 'galvao_bueno', 'galvão bueno'], canonical: 'galvao_bueno', displayName: 'Galvão Bueno', category: 'tv' },
  { alias: ['mano_brown', 'manobrown', 'brown', 'racionais'], canonical: 'mano_brown', displayName: 'Mano Brown', category: 'tv', id: 54606 },
  { alias: ['elon_musk', 'elon', 'musk'], canonical: 'elon_musk', displayName: 'Elon Musk', category: 'pop', id: 1 },
  { alias: ['cristiano_ronaldo', 'cr7', 'ronaldo'], canonical: 'cristiano_ronaldo', displayName: 'Cristiano Ronaldo', category: 'pop' },
  { alias: ['neymar', 'neymar jr'], canonical: 'neymar', displayName: 'Neymar Jr', category: 'pop' },
  { alias: ['darth_vader', 'vader'], canonical: 'darth_vader', displayName: 'Darth Vader', category: 'pop' },
];

export interface SynthesizeResult {
  audioBuffer: Buffer;
  mimetype: string;
  isOgg: boolean;
  voiceName: string;
  durationEstimateSec: number;
  audioUrl?: string;
  fromCache?: boolean;
}

interface CachedAudioEntry extends SynthesizeResult {
  cachedAt: number;
}

export class KordixVoiceService {
  private static readonly API_BASE = 'https://zone.api.br/api/tts-kordix';
  private static readonly CACHE = new Map<string, CachedAudioEntry>();
  private static readonly MAX_CACHE_ENTRIES = 120;
  private static readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

  static getApiKeys(): string[] {
    const raw = process.env.KORDIX_API_KEYS || process.env.KORDIX_API_KEY || process.env.SYSTEMZERO_API_KEY || 'freekey';
    const keys = raw.split(/[,;\s]+/).map(k => k.trim()).filter(Boolean);
    return keys.length > 0 ? keys : ['freekey'];
  }

  static getApiKey(): string {
    return this.getApiKeys()[0] || 'freekey';
  }

  static clearCache(): void {
    this.CACHE.clear();
  }

  static getCacheSize(): number {
    return this.CACHE.size;
  }

  static normalizeKey(s: string): string {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s_\-]+/g, '');
  }

  /**
   * Normaliza o nome ou apelido de personagem para o termo canônico ou ID aceito pela API
   */
  static resolveVoiceName(input: string): string {
    if (!input) return '782';
    const clean = input.toLowerCase().trim().replace(/["']/g, '');

    // Se já for numérico (ID de voz), mantém como está
    if (/^\d+$/.test(clean)) return clean;

    const cleanNorm = this.normalizeKey(clean);

    const matched = POPULAR_VOICES.find(v => {
      if (this.normalizeKey(v.canonical) === cleanNorm) return true;
      if (v.displayName && this.normalizeKey(v.displayName) === cleanNorm) return true;
      return v.alias.some(a => this.normalizeKey(a) === cleanNorm);
    });

    if (matched) {
      // Prioriza ID exato de dublagem brasileira se cadastrado
      return matched.id ? String(matched.id) : matched.canonical;
    }

    // Se o usuário digitou com espaços, converte para underline
    return clean.replace(/\s+/g, '_');
  }

  /**
   * Converte texto em fala utilizando a API TTS Kordix com rotação e fallback de chaves
   */
  static async synthesize({
    text,
    voice,
  }: {
    text: string;
    voice: string;
  }): Promise<SynthesizeResult> {
    const canonicalVoice = this.resolveVoiceName(voice);
    const normalizedTextKey = this.normalizeKey(text);
    const cacheKey = `${canonicalVoice}:${normalizedTextKey}`;

    // ⚡ 1. Otimização de Cache: Resposta instantânea se a frase já foi sintetizada recentemente
    const cached = this.CACHE.get(cacheKey);
    if (cached && (Date.now() - cached.cachedAt) < this.CACHE_TTL_MS) {
      console.log(`[KordixVoiceService] ⚡ Resposta instantânea do cache para voz "${canonicalVoice}" (${cached.audioBuffer.length} bytes)`);
      return {
        ...cached,
        fromCache: true,
      };
    }

    const keys = this.getApiKeys();
    // Embaralha para balancear o uso entre as chaves ativas (random / load-balance)
    const candidates = [...keys].sort(() => Math.random() - 0.5);

    let lastError: Error | null = null;
    let data: any = null;

    for (let i = 0; i < candidates.length; i++) {
      const apiKey = candidates[i];
      const queryParams = new URLSearchParams({
        text: text.slice(0, 1000), // limite preventivo
        voice: canonicalVoice,
        apikey: apiKey,
      });

      const endpoint = `${this.API_BASE}?${queryParams.toString()}`;
      console.log(`[KordixVoiceService] 🎙️ Tentando síntese (voz="${canonicalVoice}", chave="${apiKey.slice(0, 4)}...", tentativa=${i + 1}/${candidates.length})...`);

      try {
        // ⏱️ 2. Timeout seguro de 45 segundos para prevenir conexões penduradas
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(45000),
        });

        let resJson: any = null;
        try {
          resJson = await response.json();
        } catch {
          resJson = null;
        }

        if (!response.ok) {
          const apiMsg = resJson?.msg || `Falha na API TTS Kordix (HTTP ${response.status})`;

          // 🛡️ 3. Tratamento explícito de chave expirada
          if (/expirad|vencid|plano/i.test(apiMsg)) {
            console.error(`[KordixVoiceService] ❌ Chave de API Kordix expirada: "${apiKey.slice(0, 4)}..." (${apiMsg})`);
            lastError = new Error(`Chave de API Kordix expirada. Renove sua assinatura.`);
            continue;
          }

          // Se for erro de quota/limite da chave atual, tenta a próxima chave do pool
          if (/limite di[aá]rio|key p[uú]blica|crie sua pr[oó]pria key|quota|403|429/i.test(apiMsg)) {
            console.warn(`[KordixVoiceService] ⚠️ Chave "${apiKey.slice(0, 4)}..." esgotada ou sem saldo (${apiMsg}). Tentando próxima chave do pool...`);
            lastError = new Error(apiMsg);
            continue;
          }
          throw new Error(apiMsg);
        }

        if (!resJson || !resJson.status || !resJson.audio) {
          throw new Error(resJson?.msg || 'A API não retornou o link do áudio.');
        }

        data = resJson;
        break; // Sucesso na síntese!
      } catch (err: any) {
        lastError = err;
        if (candidates.length > 1 && i < candidates.length - 1) {
          console.warn(`[KordixVoiceService] ⚠️ Falha na tentativa com chave ${apiKey.slice(0, 4)}...: ${err.message}. Tentando próxima...`);
          continue;
        }
        throw err;
      }
    }

    if (!data || !data.audio) {
      throw lastError || new Error('Não foi possível obter áudio através de nenhuma das chaves disponíveis.');
    }

    // ⏱️ Download do áudio gerado da CDN com timeout de 30s
    const audioRes = await fetch(data.audio, {
      signal: AbortSignal.timeout(30000),
    });
    if (!audioRes.ok) {
      throw new Error(`Erro ao baixar áudio da CDN (${audioRes.status})`);
    }

    const mp3Buffer = Buffer.from(await audioRes.arrayBuffer());
    console.log(`[KordixVoiceService] ✅ Áudio gerado com sucesso (${mp3Buffer.length} bytes, voz_id=${data.voice_id || canonicalVoice})`);

    // Converte para OGG Opus no padrão estrito aceito pelo WhatsApp no iOS e Android:
    // 48000 Hz, canal mono (1), codec libopus, VBR ativado
    const oggBuffer = await this.convertToOggOpusIfPossible(mp3Buffer);

    // Estimativa de duração (~12 caracteres por segundo em média)
    const durationEstimateSec = Math.max(2, Math.round(text.length / 12));

    const matchedVoice = POPULAR_VOICES.find(v =>
      String(v.id) === String(data.voice_id || data.voice || canonicalVoice) ||
      v.canonical === canonicalVoice ||
      (data.voice && v.displayName.toLowerCase().includes(data.voice.toLowerCase()))
    );
    const resolvedName = matchedVoice ? matchedVoice.displayName : (data.voice || canonicalVoice);

    const result: SynthesizeResult = {
      audioBuffer: oggBuffer || mp3Buffer,
      mimetype: oggBuffer ? 'audio/ogg; codecs=opus' : 'audio/mpeg',
      isOgg: Boolean(oggBuffer),
      voiceName: resolvedName,
      durationEstimateSec,
      audioUrl: data.audio,
    };

    // ⚡ Salva no cache LRU em memória
    if (this.CACHE.size >= this.MAX_CACHE_ENTRIES) {
      const oldestKey = this.CACHE.keys().next().value;
      if (oldestKey) this.CACHE.delete(oldestKey);
    }
    this.CACHE.set(cacheKey, {
      ...result,
      cachedAt: Date.now(),
    });

    return result;
  }

  /**
   * Converte áudio MP3 para OGG Opus via ffmpeg local para garantir compatibilidade
   * 100% nativa com o player do iOS (CoreAudio/AVFoundation) e Android
   */
  private static async convertToOggOpusIfPossible(inputBuffer: Buffer): Promise<Buffer | null> {
    const tmpDir = path.join('/tmp', 'zaptroll_audio');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const timestamp = Date.now();
    const inputPath = path.join(tmpDir, `kordix_${timestamp}.mp3`);
    const outputPath = path.join(tmpDir, `kordix_${timestamp}.ogg`);

    try {
      fs.writeFileSync(inputPath, inputBuffer);
      // Parâmetros estritos para iOS/Android WhatsApp:
      // - -ar 48000: taxa de amostragem obrigatória para Opus no WhatsApp
      // - -ac 1: canal mono padrão de mensagens de voz
      // - -c:a libopus: codec nativo Opus
      // - -b:a 32k -vbr on: taxa de bits de voz cristalina
      await execAsync(`ffmpeg -y -i "${inputPath}" -c:a libopus -b:a 32k -vbr on -compression_level 10 -ar 48000 -ac 1 "${outputPath}"`);
      if (fs.existsSync(outputPath)) {
        const oggBuffer = fs.readFileSync(outputPath);
        return oggBuffer;
      }
    } catch (err: any) {
      console.warn('[KordixVoiceService] FFmpeg conversion skipped or failed:', err.message);
    } finally {
      try {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch {}
    }

    return null;
  }

  /**
   * Gera waveform de 64 pontos para exibição da onda sonora no WhatsApp
   */
  static generateWaveform(buffer: Buffer): Uint8Array {
    const bars = 64;
    const waveform = new Uint8Array(bars);
    const step = Math.max(1, Math.floor(buffer.length / bars));
    for (let i = 0; i < bars; i++) {
      let sum = 0;
      let count = 0;
      for (let j = 0; j < 32 && (i * step + j) < buffer.length; j++) {
        sum += Math.abs(buffer[i * step + j] - 128);
        count++;
      }
      const avg = count > 0 ? sum / count : 10;
      waveform[i] = Math.min(100, Math.max(10, Math.round((avg / 64) * 80 + 10)));
    }
    return waveform;
  }

  /**
   * Busca vozes disponíveis no catálogo Kordix
   */
  static async searchVoices(query: string): Promise<Array<{ id: number; name: string; language: string; category?: string }>> {
    const apiKey = this.getApiKey();
    const url = `${this.API_BASE}?list=true&search=${encodeURIComponent(query)}&apikey=${apiKey}`;
    try {
      const res = await fetch(url);
      const data: any = await res.json();
      return data.voices || [];
    } catch {
      return [];
    }
  }

  /**
   * Mensagem de ajuda e catálogo completo para o WhatsApp
   */
  static getHelpMessage(): string {
    return [
      `🎙️ *ZAPTROLL — VOZES DE PERSONAGENS & FAMOSOS (TTS IA)*`,
      ``,
      `Transforme qualquer texto em áudio oficial com a voz de personalidades famosas da política, animes, desenhos e TV!`,
      ``,
      `📌 *Como Usar:*`,
      `• \`&voz personagem | seu texto aqui\``,
      ``,
      `💡 *Exemplos:*`,
      `• \`&voz bolsonaro | Olá meus amigos, boa noite a todos!\``,
      `• \`&voz lula | Companheiros e companheiras, boa noite!\``,
      `• \`&voz goku | Oi, eu sou o Goku e vou te derrotar!\``,
      `• \`&voz bob_esponja | Estou pronto, estou pronto, seu Siriguejo!\``,
      `• \`&voz silvio_santos | Quem quer dinheiro? Ma oê!\``,
      `• \`&voz mano_brown | É desse jeito, família, paz na quebrada!\``,
      ``,
      `🌟 *Vozes Principais & Atalhos:*`,
      `🇧🇷 *Políticos:* \`bolsonaro\`, \`lula\`, \`dilma\``,
      `📺 *TV & Famosos:* \`silvio_santos\`, \`faustao\`, \`galvao\`, \`mano_brown\`, \`elon_musk\``,
      `🧽 *Desenhos:* \`bob_esponja\`, \`pica_pau\`, \`mickey\`, \`chaves\`, \`madruga\`, \`shrek\`, \`homer\``,
      `💥 *Animes & Heróis:* \`goku\`, \`vegeta\`, \`naruto\`, \`batman\`, \`darth_vader\``,
      `⚽ *Futebol:* \`cristiano_ronaldo\`, \`neymar\``,
      ``,
      `🔍 *Descobrir mais vozes:*`,
      `• Digite \`&voz buscar <nome>\` para pesquisar no catálogo de mais de 200.000 vozes!`,
      `• Digite \`&vozes\` para ver este menu a qualquer momento.`,
      ``,
      `_Ao enviar o comando, o bot reage com 🎙️ e envia a resposta como áudio gravado nativo._`
    ].join('\n');
  }
}
