import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeoutMs?: number;
  maxResponseSizeBytes?: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  durationMs: number;
}

export class SafeHttpClient {
  private static readonly DEFAULT_TIMEOUT_MS = 8000;
  private static readonly MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB

  /**
   * Verifica se um endereço IP pertence a faixas privadas, de loopback ou metadados de nuvem.
   */
  public static isPrivateOrRestrictedIp(ip: string): boolean {
    const cleanIp = ip.trim();

    // Loopback IPv4 e IPv6
    if (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === '0.0.0.0' || cleanIp.startsWith('127.')) {
      return true;
    }

    // Cloud metadata (AWS, GCP, Azure, DigitalOcean)
    if (cleanIp === '169.254.169.254' || cleanIp.startsWith('169.254.')) {
      return true;
    }

    // RFC 1918 Class A: 10.0.0.0 - 10.255.255.255
    if (cleanIp.startsWith('10.')) {
      return true;
    }

    // RFC 1918 Class B: 172.16.0.0 - 172.31.255.255
    const classBMatch = cleanIp.match(/^172\.(\d+)\./);
    if (classBMatch) {
      const secondOctet = parseInt(classBMatch[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return true;
      }
    }

    // RFC 1918 Class C: 192.168.0.0 - 192.168.255.255
    if (cleanIp.startsWith('192.168.')) {
      return true;
    }

    // CGNAT RFC 6598: 100.64.0.0 - 100.127.255.255
    const cgnatMatch = cleanIp.match(/^100\.(\d+)\./);
    if (cgnatMatch) {
      const secondOctet = parseInt(cgnatMatch[1], 10);
      if (secondOctet >= 64 && secondOctet <= 127) {
        return true;
      }
    }

    return false;
  }

  /**
   * Valida a URL e resolve seu DNS para mitigar ataques de SSRF e DNS Rebinding.
   */
  public static async validateUrlAndResolve(rawUrl: string): Promise<{ url: URL; resolvedIp: string }> {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error(`URL inválida fornecida: "${rawUrl}"`);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Protocolo "${parsed.protocol}" não permitido. Apenas HTTP e HTTPS são suportados.`);
    }

    const hostname = parsed.hostname.toLowerCase();

    // Nomes de domínio restritos conhecidos
    const blockedHostnames = ['localhost', 'metadata.google.internal', 'instance-data'];
    if (blockedHostnames.includes(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      throw new Error(`Acesso ao host "${hostname}" bloqueado por políticas de segurança SSRF.`);
    }

    // Se já for um IP direto na URL
    if (this.isPrivateOrRestrictedIp(hostname)) {
      throw new Error(`Endereço IP "${hostname}" pertence a rede restrita ou interna e não pode ser acessado.`);
    }

    // Resolução DNS obrigatória para verificar IP de destino real
    try {
      const records = await dns.lookup(hostname, { all: true });
      for (const rec of records) {
        if (this.isPrivateOrRestrictedIp(rec.address)) {
          throw new Error(`Host "${hostname}" resolveu para o IP restrito/privado "${rec.address}" (bloqueio SSRF).`);
        }
      }
      return { url: parsed, resolvedIp: records[0]?.address || hostname };
    } catch (err: any) {
      if (err.message.includes('SSRF') || err.message.includes('restrito')) {
        throw err;
      }
      throw new Error(`Falha ao resolver DNS do host "${hostname}": ${err.message}`);
    }
  }

  /**
   * Executa a requisição HTTP segura protegida com timeouts estritos e limites de tamanho.
   */
  public static async request(rawUrl: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    const { url } = await this.validateUrlAndResolve(rawUrl);

    const method = options.method || 'GET';
    const timeoutMs = Math.min(options.timeoutMs || this.DEFAULT_TIMEOUT_MS, 15000);
    const maxSizeBytes = options.maxResponseSizeBytes || this.MAX_RESPONSE_SIZE;

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      'User-Agent': 'Zaptroll-FlowEngine/1.0',
      'Accept': 'application/json, text/plain, */*',
      ...options.headers,
    };

    let bodyPayload: any = undefined;
    if (options.body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      if (typeof options.body === 'object') {
        bodyPayload = JSON.stringify(options.body);
        if (!headers['Content-Type'] && !headers['content-type']) {
          headers['Content-Type'] = 'application/json';
        }
      } else {
        bodyPayload = String(options.body);
      }
    }

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: bodyPayload,
        signal: controller.signal,
        redirect: 'error', // Impede redirecionamentos automáticos para sub-redes privadas sem re-validação DNS
      });

      clearTimeout(timeoutHandle);
      const durationMs = Date.now() - startTime;

      // Leitura com limitação de buffer
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        responseHeaders[key.toLowerCase()] = val;
      });

      const contentLength = parseInt(responseHeaders['content-length'] || '0', 10);
      if (contentLength > maxSizeBytes) {
        throw new Error(`Resposta HTTP excedeu o limite máximo permitido de ${maxSizeBytes / 1024 / 1024}MB.`);
      }

      const rawText = await response.text();
      if (rawText.length > maxSizeBytes) {
        throw new Error(`Tamanho da resposta HTTP (${rawText.length} bytes) excedeu o limite máximo.`);
      }

      let parsedData: any = rawText;
      const contentType = responseHeaders['content-type'] || '';
      if (contentType.includes('application/json')) {
        try {
          parsedData = JSON.parse(rawText);
        } catch {
          parsedData = rawText;
        }
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data: parsedData,
        durationMs,
      };
    } catch (err: any) {
      clearTimeout(timeoutHandle);
      if (err.name === 'AbortError') {
        throw new Error(`Requisição HTTP para "${url.hostname}" expirou após ${timeoutMs}ms.`);
      }
      throw err;
    }
  }
}
