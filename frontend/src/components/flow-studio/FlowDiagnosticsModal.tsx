import React from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Smartphone,
  Globe,
  Radio,
  Server,
  Terminal,
} from 'lucide-react';

interface FlowDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CapabilityItem {
  feature: string;
  zapoMethod: string;
  status: 'supported' | 'partial' | 'experimental' | 'external_only';
  confirmation: 'client_ack' | 'server_ack' | 'read_receipt' | 'poll_event';
  deviceSupport: {
    android: boolean;
    ios: boolean;
    web: boolean;
  };
  limitations: string;
  fallbackPlan: string;
}

const CAPABILITIES_MATRIX: CapabilityItem[] = [
  {
    feature: 'Mensagens Temporárias (AutoDestruct)',
    zapoMethod: 'client.sendMessage(jid, { delete: key })',
    status: 'supported',
    confirmation: 'server_ack',
    deviceSupport: { android: true, ios: true, web: true },
    limitations: 'Depende de conexão ativa no momento da expiração. Requer stanzaId e remoteJid exatos.',
    fallbackPlan: 'Persistência em PostgreSQL com retentativas progressivas (backoff exponencial) após reinicialização.',
  },
  {
    feature: 'Status / Stories com Vídeo',
    zapoMethod: 'client.status.send({ type: "video", media: Buffer, mimetype: "video/mp4" })',
    status: 'supported',
    confirmation: 'server_ack',
    deviceSupport: { android: true, ios: true, web: true },
    limitations: 'Limite de 16MB e 30s. Codec H.264 / AAC obrigatório.',
    fallbackPlan: 'Validação rígida de MIME type e verificação SSRF antes do processamento.',
  },
  {
    feature: 'Botões CTA URL (Nativos)',
    zapoMethod: 'interactiveMessage (native_flow_message -> cta_url)',
    status: 'supported',
    confirmation: 'server_ack',
    deviceSupport: { android: true, ios: true, web: false },
    limitations: 'WhatsApp Web pode omitir o botão nativo em algumas contas pessoais.',
    fallbackPlan: 'Fallback textual automático com link formatado no corpo da mensagem.',
  },
  {
    feature: 'Páginas Web e Formulários Hospedados',
    zapoMethod: 'Página Web Responsiva (/r/form/:id) via CTA URL',
    status: 'supported',
    confirmation: 'poll_event',
    deviceSupport: { android: true, ios: true, web: true },
    limitations: 'WhatsApp não renderiza DOM dentro do balão de conversa.',
    fallbackPlan: 'Abre no navegador móvel seguro e retoma a conversa no WhatsApp via webhook.',
  },
  {
    feature: 'Jogos Web e Arcade Retrô',
    zapoMethod: 'Página Web HTML5 Canvas (/r/jogos/:id) via CTA URL',
    status: 'supported',
    confirmation: 'poll_event',
    deviceSupport: { android: true, ios: true, web: true },
    limitations: 'Requer suporte a touch ou teclado no navegador do dispositivo.',
    fallbackPlan: 'Controles virtuais D-Pad touch na tela + sintetizador de áudio Web Audio API.',
  },
  {
    feature: 'Cobrança Pix Dinâmica',
    zapoMethod: 'Geração de Payload EMV e envio de Imagem QR Code',
    status: 'supported',
    confirmation: 'server_ack',
    deviceSupport: { android: true, ios: true, web: true },
    limitations: 'Não deve afirmar pagamento concluído sem webhook verificado do banco.',
    fallbackPlan: 'Modo demonstração claramente sinalizado e conferência manual/webhook.',
  },
  {
    feature: 'Requisições HTTP Seguras (SSRF Guard)',
    zapoMethod: 'FlowEngine SafeHttpClient',
    status: 'supported',
    confirmation: 'server_ack',
    deviceSupport: { android: true, ios: true, web: true },
    limitations: 'Bloqueio estrito de IPs privados (10.x, 192.168.x, 127.x, 169.254.x).',
    fallbackPlan: 'Validação de DNS e bloqueio de DNS rebinding em todas as requisições.',
  },
];

export const FlowDiagnosticsModal: React.FC<FlowDiagnosticsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#161922] border border-[#2a3346] w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-[#11141c] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-mono">
                Matriz de Compatibilidade do Protocolo Zapo
              </h2>
              <p className="text-xs text-gray-400">
                Auditoria técnica de recursos, limitações conhecidas e planos alternativos.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Engine Status Banner */}
        <div className="px-5 py-3 bg-[#0d1017] border-b border-white/5 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-[#39ff14]">
            <Server className="w-4 h-4" />
            <span>Motor de Execução de Fluxos: ATIVO E SAUDÁVEL</span>
          </div>
          <span className="text-gray-400">Zapo v1.10.0 • Node.js / Express • PostgreSQL</span>
        </div>

        {/* Capabilities Matrix Table */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-4">
            {CAPABILITIES_MATRIX.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-[#0b0e14] border border-white/5 hover:border-white/10 transition-all text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#39ff14] shrink-0" />
                    <h3 className="font-bold text-white text-sm">{item.feature}</h3>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-bold">
                      {item.status}
                    </span>
                    <span className="text-gray-400">
                      Dispositivos: Android {item.deviceSupport.android ? '✓' : '✗'} | iOS{' '}
                      {item.deviceSupport.ios ? '✓' : '✗'} | Web {item.deviceSupport.web ? '✓' : '✗'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-gray-400 font-mono text-[11px]">
                  <div>
                    <span className="text-gray-500">Método Zapo:</span>{' '}
                    <code className="text-cyan-300">{item.zapoMethod}</code>
                  </div>
                  <div>
                    <span className="text-gray-500">Confirmação:</span>{' '}
                    <span className="text-white">{item.confirmation}</span>
                  </div>
                  <div>
                    <span className="text-amber-500/80">Limitação:</span>{' '}
                    <span className="text-gray-300">{item.limitations}</span>
                  </div>
                  <div>
                    <span className="text-[#39ff14]">Plano Alternativo:</span>{' '}
                    <span className="text-gray-300">{item.fallbackPlan}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
