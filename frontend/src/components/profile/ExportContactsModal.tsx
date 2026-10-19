import React, { useState } from 'react';
import {
  X,
  Download,
  Smartphone,
  MessageSquare,
  FileSpreadsheet,
  FileText,
  FileCode,
  Copy,
  Check,
  Users,
  Shield,
  Sliders,
  ExternalLink,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import {
  ExportContactItem,
  filterContacts,
  extractCleanDigits,
  downloadGroupContactsVcf,
  downloadGroupContactsWhaticketCsv,
  downloadGroupContactsFullCsv,
  downloadGroupContactsTxt,
  downloadGroupContactsJson,
} from '../../utils/contactExport.js';

interface ExportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupName: string;
  participants: ExportContactItem[];
  groupMetadata?: any;
}

export const ExportContactsModal: React.FC<ExportContactsModalProps> = ({
  isOpen,
  onClose,
  groupName,
  participants,
  groupMetadata,
}) => {
  const [prefix, setPrefix] = useState<string>(groupName || 'Contato');
  const [filter, setFilter] = useState<'all' | 'non-admins' | 'admins'>('all');
  const [startNumber, setStartNumber] = useState<number>(1);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const filtered = filterContacts(participants, filter);
  const totalWithPhone = participants.filter((p) => extractCleanDigits(p).length >= 8).length;
  const adminCount = participants.filter((p) => p.admin && extractCleanDigits(p).length >= 8).length;
  const nonAdminCount = totalWithPhone - adminCount;

  const showSuccess = (msg: string) => {
    setDownloadSuccessMsg(msg);
    setTimeout(() => setDownloadSuccessMsg(null), 3500);
  };

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadVcf = () => {
    const count = downloadGroupContactsVcf(participants, {
      groupName,
      prefix,
      filter,
      startNumber,
    });
    showSuccess(`📱 Arquivo .VCF com ${count} contatos baixado com sucesso para seu celular!`);
  };

  const handleDownloadWhaticket = () => {
    const count = downloadGroupContactsWhaticketCsv(participants, {
      groupName,
      prefix,
      filter,
      startNumber,
    });
    showSuccess(`💬 CSV com ${count} contatos formatado para Whaticket baixado com sucesso!`);
  };

  const handleDownloadFullCsv = () => {
    const count = downloadGroupContactsFullCsv(participants, {
      groupName,
      prefix,
      filter,
      startNumber,
    });
    showSuccess(`📊 CSV completo com ${count} contatos baixado para Excel!`);
  };

  const handleDownloadTxt = () => {
    const count = downloadGroupContactsTxt(participants, {
      groupName,
      prefix,
      filter,
      startNumber,
    });
    showSuccess(`📄 TXT com ${count} telefones limpos baixado com sucesso!`);
  };

  const handleDownloadJson = () => {
    const count = downloadGroupContactsJson(
      participants,
      { groupName, prefix, filter, startNumber },
      groupMetadata
    );
    showSuccess(`📦 JSON estruturado com ${count} contatos baixado!`);
  };

  const handleCopyPhones = () => {
    const phones = filtered.map((c) => extractCleanDigits(c)).join('\n');
    copyToClipboard(phones, 'copy_phones');
  };

  // Preview dos primeiros 3 contatos
  const padLength = filtered.length > 99 ? 3 : 2;
  const previewItems = filtered.slice(0, 3).map((c, i) => {
    const numIdx = String(startNumber + i).padStart(padLength, '0');
    const adminTag = c.admin ? ' [Admin]' : '';
    const digits = extractCleanDigits(c);
    return {
      name: `${prefix.trim() || 'Contato'}${adminTag} ${numIdx}`,
      phone: `+${digits}`,
    };
  });

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div
        className="relative w-full max-w-2xl bg-[#121620] border border-[#2a3449] rounded-3xl shadow-[0_12px_50px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#242e42] bg-[#161c29]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#39ff14]/15 border border-[#39ff14]/30 flex items-center justify-center text-[#39ff14]">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white font-mono flex items-center gap-2">
                Exportar & Baixar Contatos
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                  {filtered.length} contatos
                </span>
              </h3>
              <p className="text-xs text-gray-400 font-mono truncate max-w-md">
                Grupo: <span className="text-gray-200 font-medium">{groupName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback de Download */}
        {downloadSuccessMsg && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-5 py-2.5 text-xs text-emerald-300 flex items-center gap-2 font-mono animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="font-medium">{downloadSuccessMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Opções de Customização */}
          <div className="bg-[#171d2b] border border-[#263145] rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold font-mono text-[#39ff14] uppercase tracking-wide">
              <Sliders className="w-3.5 h-3.5" />
              <span>Configurações do Arquivo de Contatos</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Prefixo do Nome */}
              <div>
                <label className="block text-[11px] font-mono text-gray-300 mb-1.5 font-semibold">
                  Nome / Prefixo do Contato:
                </label>
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="Ex: Clientes Grupo X"
                  className="w-full bg-[#0f131c] border border-[#263145] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 font-mono focus:border-[#39ff14] focus:outline-none"
                />
                <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                  Como cada contato será salvo (ex: "{prefix} 001")
                </span>
              </div>

              {/* Filtro de Membros */}
              <div>
                <label className="block text-[11px] font-mono text-gray-300 mb-1.5 font-semibold">
                  Filtrar Participantes:
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-[#0f131c] p-1 rounded-xl border border-[#263145]">
                  <button
                    type="button"
                    onClick={() => setFilter('all')}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-mono font-medium transition text-center ${
                      filter === 'all'
                        ? 'bg-[#1e2738] text-[#39ff14] font-bold shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Todos ({totalWithPhone})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter('non-admins')}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-mono font-medium transition text-center ${
                      filter === 'non-admins'
                        ? 'bg-[#1e2738] text-cyan-300 font-bold shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Membros ({nonAdminCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter('admins')}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-mono font-medium transition text-center ${
                      filter === 'admins'
                        ? 'bg-[#1e2738] text-purple-300 font-bold shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Admins ({adminCount})
                  </button>
                </div>
                <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                  Escolha se deseja exportar todos ou filtrar
                </span>
              </div>
            </div>

            {/* Pré-visualização ao vivo */}
            {previewItems.length > 0 && (
              <div className="pt-2 border-t border-[#263145]">
                <span className="text-[10px] font-mono text-gray-400 block mb-1">
                  Exemplo de como os contatos serão salvos na agenda/sistema:
                </span>
                <div className="flex flex-wrap gap-2">
                  {previewItems.map((item, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-[#0f131c] border border-[#2a364d] rounded-lg text-[11px] font-mono text-gray-300 flex items-center gap-1.5"
                    >
                      <span className="text-[#39ff14] font-bold">{item.name}</span>
                      <span className="text-gray-500 font-sans">({item.phone})</span>
                    </span>
                  ))}
                  {filtered.length > 3 && (
                    <span className="px-2 py-1 text-[11px] font-mono text-gray-500 flex items-center">
                      + mais {filtered.length - 3} contatos
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Cards de Download dos Formatos Principais */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold font-mono text-gray-300 uppercase tracking-wide">
              Escolha o Formato de Download:
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Card 1: VCF (Celulares / Android / iPhone) */}
              <button
                type="button"
                onClick={handleDownloadVcf}
                className="group p-4 rounded-2xl bg-gradient-to-br from-[#15231c] to-[#111827] border border-emerald-500/30 hover:border-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] text-left transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      RECOMENDADO
                    </span>
                  </div>
                  <h5 className="text-sm font-bold text-white font-mono flex items-center gap-1.5">
                    Baixar VCF (.vcf)
                  </h5>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    Para <strong className="text-emerald-300">Celulares</strong> (Android, iPhone / iOS, Samsung, Xiaomi) e Google Contatos. Importa com 1 clique direto na agenda!
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-emerald-500/20 flex items-center justify-between text-xs font-mono text-emerald-300 group-hover:text-emerald-200">
                  <span className="flex items-center gap-1 font-bold">
                    <Download className="w-3.5 h-3.5" />
                    Baixar {filtered.length} Contatos VCF
                  </span>
                  <span>→</span>
                </div>
              </button>

              {/* Card 2: CSV Whaticket */}
              <button
                type="button"
                onClick={handleDownloadWhaticket}
                className="group p-4 rounded-2xl bg-gradient-to-br from-[#122329] to-[#111827] border border-cyan-500/30 hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] text-left transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      WHATICKET
                    </span>
                  </div>
                  <h5 className="text-sm font-bold text-white font-mono flex items-center gap-1.5">
                    Baixar CSV Whaticket (.csv)
                  </h5>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    Formato oficial para <strong className="text-cyan-300">Whaticket</strong>, Chatwoot e CRMs. Colunas <code className="text-cyan-300">name,number,email</code> com UTF-8 BOM.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-cyan-500/20 flex items-center justify-between text-xs font-mono text-cyan-300 group-hover:text-cyan-200">
                  <span className="flex items-center gap-1 font-bold">
                    <Download className="w-3.5 h-3.5" />
                    Baixar CSV Whaticket
                  </span>
                  <span>→</span>
                </div>
              </button>

              {/* Card 3: TXT Lista de Telefones */}
              <button
                type="button"
                onClick={handleDownloadTxt}
                className="group p-4 rounded-2xl bg-[#141925] border border-[#242f44] hover:border-[#39ff14]/50 hover:bg-[#182030] text-left transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-[#39ff14]/15 text-[#39ff14] flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono text-gray-400">1 por linha</span>
                  </div>
                  <h5 className="text-sm font-bold text-white font-mono">
                    Baixar TXT (.txt)
                  </h5>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    Lista limpa com apenas os telefones (DDI + DDD + número), ideal para disparadores e broadcast.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-xs font-mono text-[#39ff14]">
                  <span className="flex items-center gap-1 font-bold">
                    <Download className="w-3.5 h-3.5" />
                    Baixar TXT de Telefones
                  </span>
                  <span>→</span>
                </div>
              </button>

              {/* Card 4: Excel / CSV Completo */}
              <button
                type="button"
                onClick={handleDownloadFullCsv}
                className="group p-4 rounded-2xl bg-[#141925] border border-[#242f44] hover:border-purple-400/50 hover:bg-[#182030] text-left transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono text-purple-300">Planilha</span>
                  </div>
                  <h5 className="text-sm font-bold text-white font-mono">
                    Baixar Excel Completo (.csv)
                  </h5>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    Planilha com Nome, Telefone, JID, LID, Cargo de Admin e link wa.me direto.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-xs font-mono text-purple-300">
                  <span className="flex items-center gap-1 font-bold">
                    <Download className="w-3.5 h-3.5" />
                    Baixar CSV para Excel
                  </span>
                  <span>→</span>
                </div>
              </button>
            </div>
          </div>

          {/* Ações Rápidas de Copiar e JSON */}
          <div className="pt-3 border-t border-[#242f44] flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-gray-400 font-mono">Copiar para Área de Transferência:</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyPhones}
                className="px-3 py-1.5 rounded-xl bg-[#181f2f] hover:bg-[#20293d] border border-[#2a374f] text-xs font-mono text-emerald-300 flex items-center gap-1.5 transition active:scale-95"
              >
                {copiedKey === 'copy_phones' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{copiedKey === 'copy_phones' ? 'Copiados!' : 'Copiar Telefones'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadJson}
                className="px-3 py-1.5 rounded-xl bg-[#181f2f] hover:bg-[#20293d] border border-[#2a374f] text-xs font-mono text-purple-300 flex items-center gap-1.5 transition active:scale-95"
              >
                <FileCode className="w-3.5 h-3.5 text-purple-400" />
                <span>Baixar JSON</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
