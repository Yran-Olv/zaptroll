import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  MousePointerClick,
  List,
  ExternalLink,
  Layers,
  Clock,
  Code2,
  Trash2,
  Bookmark,
  X,
  Send,
  Plus,
  Trash,
  AlertTriangle,
  CheckCircle,
  Eye,
  Info,
  Copy,
  FlaskConical,
  Terminal,
  Ghost,
  Skull,
} from 'lucide-react';
import api from '../../services/api.js';

interface AdvancedFeaturesModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  conversationId?: string;
  recipientJid?: string;
  onSuccess?: () => void;
}

export const AdvancedFeaturesModal: React.FC<AdvancedFeaturesModalProps> = ({
  isOpen,
  onClose,
  connectionId,
  conversationId,
  recipientJid,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<
    'buttons' | 'list' | 'webview' | 'carousel' | 'ephemeral' | 'raw' | 'revoke'
  >('buttons');

  const [loading, setLoading] = useState(false);
  const [resultSuccess, setResultSuccess] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);

  // 1. Buttons State ("Botões do Caos")
  const [btnHeader, setBtnHeader] = useState('Experimento Zaptroll Lab');
  const [btnContent, setBtnContent] = useState('Você foi selecionado para o teste do laboratório. Escolha sua resposta:');
  const [btnFooter, setBtnFooter] = useState('Selecione com responsabilidade');
  const [buttonsList, setButtonsList] = useState([
    { buttonId: 'opt_1', displayText: 'Aceitar Desafio' },
    { buttonId: 'opt_2', displayText: 'Trollar Amigo' },
    { buttonId: 'opt_3', displayText: 'Ver Documentação' },
  ]);

  // 2. List State ("Menu do Trote")
  const [listTitle, setListTitle] = useState('Cardápio do Laboratório');
  const [listDesc, setListDesc] = useState('Selecione uma das experiências abaixo:');
  const [listBtnText, setListBtnText] = useState('Explorar Opções');
  const [listFooter, setListFooter] = useState('Zaptroll Meme Labs v2.0');
  const [listSections, setListSections] = useState([
    {
      title: 'Trollagens Clássicas',
      rows: [
        { rowId: 'row_1', title: 'Trollface Alert', description: 'Envia um alerta bem humorado' },
        { rowId: 'row_2', title: 'Teste de Sanidade', description: 'Perguntas interativas' },
      ],
    },
    {
      title: 'Ferramentas Técnicas',
      rows: [
        { rowId: 'row_3', title: 'Ping de Conexão', description: 'Validação de entrega imediata' },
      ],
    },
  ]);

  // 3. Webview State ("Webviews Secretas")
  const [webTitle, setWebTitle] = useState('Página Web Interativa');
  const [webBody, setWebBody] = useState('Acesse a central de testes completa pelo link abaixo:');
  const [webBtn, setWebBtn] = useState('Abrir Zaptroll Web');
  const [webUrl, setWebUrl] = useState('https://zapo.to/en/introduction');
  const [webFooter, setWebFooter] = useState('Zaptroll Developer Lab');

  // 4. Carousel State ("Carrossel da Humilhação")
  const [carouselBody, setCarouselBody] = useState('Confira as novidades do laboratório de testes:');
  const [carouselFooter, setCarouselFooter] = useState('Zaptroll Interatividade WhatsApp');
  const [carouselButtons, setCarouselButtons] = useState([
    { name: 'cta_url', display_text: 'Documentação Zapo', url: 'https://zapo.to' },
    { name: 'quick_reply', display_text: 'Confirmar Teste', id: 'confirm_action' },
  ]);

  // 5. Ephemeral State ("Modo Fantasma")
  const [ephMode, setEphMode] = useState<'chat' | 'single'>('single');
  const [ephChatSeconds, setEphChatSeconds] = useState(604800); // 7 days
  const [ephSingleText, setEphSingleText] = useState('Esta mensagem se autodestruirá em breve no seu WhatsApp.');
  const [ephSingleSeconds, setEphSingleSeconds] = useState(10);

  // 6. Raw Code State ("Laboratório de Payloads")
  const [rawJsonText, setRawJsonText] = useState(
    JSON.stringify(
      {
        rawPayload: {
          locationMessage: {
            degreesLatitude: -23.5613,
            degreesLongitude: -46.6565,
            name: 'Laboratório Secreto Zaptroll',
            address: 'Av. dos Memes, 2010 - SP',
          },
        },
      },
      null,
      2
    )
  );

  // 7. Revoke State ("Apaga Isso!")
  const [revokeStanzaId, setRevokeStanzaId] = useState('');

  const [rawResponseData, setRawResponseData] = useState<any>(null);
  const [examples, setExamples] = useState<any>({});

  useEffect(() => {
    if (isOpen) {
      api.get('/advanced/examples').then((res) => {
        setExamples(res.data.examples || {});
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSend = async (type: string, payload: any) => {
    setLoading(true);
    setResultSuccess(null);
    setResultError(null);
    setRawResponseData(null);

    try {
      const res = await api.post('/messages/send', {
        connectionId,
        conversationId,
        recipientJid,
        type,
        payload,
      });

      setResultSuccess('Payload executado e transmitido via WhatsApp!');
      setRawResponseData(res.data);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Erro ao enviar mensagem.';
      setResultError(msg);
      setRawResponseData(err.response?.data || null);
    } finally {
      setLoading(false);
    }
  };

  const handleManualRevoke = async () => {
    if (!revokeStanzaId.trim()) {
      setResultError('Informe o ID (stanzaId) da mensagem para revogar.');
      return;
    }
    setLoading(true);
    setResultSuccess(null);
    setResultError(null);

    try {
      await api.post('/messages/revoke', {
        connectionId,
        conversationId,
        stanzaId: revokeStanzaId.trim(),
      });
      setResultSuccess('Ordem de revogação enviada com sucesso para o WhatsApp!');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setResultError(err.response?.data?.error || 'Erro ao revogar mensagem.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddButton = () => {
    if (buttonsList.length >= 3) return;
    setButtonsList([
      ...buttonsList,
      { buttonId: `opt_${buttonsList.length + 1}`, displayText: `Botão ${buttonsList.length + 1}` },
    ]);
  };

  const handleRemoveButton = (index: number) => {
    setButtonsList(buttonsList.filter((_, i) => i !== index));
  };

  const handleAddListRow = (secIndex: number) => {
    const updated = [...listSections];
    updated[secIndex].rows.push({
      rowId: `row_${Date.now()}`,
      title: `Item ${updated[secIndex].rows.length + 1}`,
      description: 'Descrição do item',
    });
    setListSections(updated);
  };

  const handleRemoveListRow = (secIndex: number, rowIndex: number) => {
    const updated = [...listSections];
    updated[secIndex].rows = updated[secIndex].rows.filter((_, i) => i !== rowIndex);
    setListSections(updated);
  };

  const categories = [
    { id: 'buttons', label: 'Botões do Caos', icon: MousePointerClick, desc: 'Botões de resposta rápida' },
    { id: 'list', label: 'Menu do Trote', icon: List, desc: 'Menus e listas de opções' },
    { id: 'carousel', label: 'Carrossel', icon: Layers, desc: 'Cartões horizontais' },
    { id: 'webview', label: 'Webviews Secretas', icon: ExternalLink, desc: 'Links in-app' },
    { id: 'ephemeral', label: 'Modo Fantasma', icon: Ghost, desc: 'Mensagens temporárias' },
    { id: 'raw', label: 'Laboratório Payloads', icon: Code2, desc: 'Código Protobuf bruto' },
    { id: 'revoke', label: 'Apaga Isso!', icon: Trash2, desc: 'Revogação de mensagem' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="bg-[#12151c] rounded-3xl w-full max-w-4xl h-[92vh] max-h-[780px] flex flex-col shadow-2xl border border-[#2a3346] overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#161922] border-b border-[#2a3346] px-3.5 sm:px-5 py-3 sm:py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-[#39ff14]/15 border border-[#39ff14]/30 flex items-center justify-center text-[#39ff14] shrink-0">
              <FlaskConical className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="text-xs sm:text-base font-bold font-mono text-white tracking-tight truncate">
                  Laboratório de Recursos Zapo
                </h2>
                <span className="text-[9px] sm:text-[10px] font-mono font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]/30 shrink-0">
                  MOTOR ATIVO
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-gray-400 font-mono hidden sm:block">
                Experimente botões, menus, carrosséis, webviews e payloads reais no WhatsApp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Categories Bar (Horizontally scrollable with smooth touch on mobile) */}
        <div className="bg-[#0e1118] border-b border-[#2a3346] shrink-0 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 px-3 sm:px-4 py-2 min-w-max">
            {categories.map((cat) => {
              const IconComp = cat.icon;
              const isActive = activeTab === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id as any)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-mono font-semibold flex items-center gap-1.5 whitespace-nowrap transition shrink-0 ${
                    isActive
                      ? 'bg-[#39ff14] text-black font-bold shadow-[0_0_12px_rgba(57,255,20,0.3)]'
                      : 'bg-[#161922] text-gray-400 hover:text-white border border-[#2a3346]'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5 shrink-0" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body: 2 Columns on desktop (Editor + Live Preview) */}
        <div className="flex-1 overflow-y-auto md:overflow-hidden grid grid-cols-1 md:grid-cols-2">
          {/* Column 1: Config Form */}
          <div className="p-4 sm:p-5 overflow-y-auto md:border-r border-[#2a3346] space-y-4 bg-[#12151c]">
            {/* Feedback Notifications */}
            {resultSuccess && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 text-xs rounded-xl flex items-center gap-2 font-mono">
                <CheckCircle className="w-4 h-4 text-[#39ff14] shrink-0" />
                <span>{resultSuccess}</span>
              </div>
            )}
            {resultError && (
              <div className="p-3 bg-red-950/40 border border-red-500/50 text-red-300 text-xs rounded-xl flex items-center gap-2 font-mono">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{resultError}</span>
              </div>
            )}

            {/* TAB 1: BOTÕES DO CAOS */}
            {activeTab === 'buttons' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-mono font-semibold text-gray-300 mb-1">
                    Cabeçalho (Opcional)
                  </label>
                  <input
                    type="text"
                    value={btnHeader}
                    onChange={(e) => setBtnHeader(e.target.value)}
                    className="w-full px-3 py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white focus:border-[#39ff14] focus:outline-none font-sans"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono font-semibold text-gray-300 mb-1">
                    Texto Principal *
                  </label>
                  <textarea
                    rows={3}
                    value={btnContent}
                    onChange={(e) => setBtnContent(e.target.value)}
                    className="w-full px-3 py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white focus:border-[#39ff14] focus:outline-none font-sans"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono font-semibold text-gray-300 mb-1">
                    Rodapé (Opcional)
                  </label>
                  <input
                    type="text"
                    value={btnFooter}
                    onChange={(e) => setBtnFooter(e.target.value)}
                    className="w-full px-3 py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white focus:border-[#39ff14] focus:outline-none font-sans"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-mono font-semibold text-gray-300">
                      Botões Rápidos (Máx 3)
                    </label>
                    {buttonsList.length < 3 && (
                      <button
                        type="button"
                        onClick={handleAddButton}
                        className="text-[11px] text-[#39ff14] font-mono font-bold hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Adicionar
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {buttonsList.map((btn, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={btn.displayText}
                          maxLength={25}
                          placeholder="Texto do Botão"
                          onChange={(e) => {
                            const updated = [...buttonsList];
                            updated[index].displayText = e.target.value;
                            setButtonsList(updated);
                          }}
                          className="flex-1 px-3 py-1.5 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white focus:outline-none focus:border-[#39ff14]"
                        />
                        {buttonsList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveButton(index)}
                            className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() =>
                    handleSend('buttons', {
                      headerText: btnHeader,
                      contentText: btnContent,
                      footerText: btnFooter,
                      buttons: buttonsList.map((b) => ({
                        buttonId: b.buttonId,
                        buttonText: { displayText: b.displayText },
                        type: 1,
                      })),
                    })
                  }
                  disabled={loading}
                  className="w-full mt-4 py-2.5 bg-[#39ff14] hover:bg-[#32e012] text-black font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#39ff14]/20 transition disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Disparar Botões no WhatsApp
                </button>
              </div>
            )}

            {/* TAB 2: MENU DO TROTE / LISTAS */}
            {activeTab === 'list' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-mono font-semibold text-gray-300 mb-1">
                    Título do Menu *
                  </label>
                  <input
                    type="text"
                    value={listTitle}
                    onChange={(e) => setListTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white focus:border-[#39ff14]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono font-semibold text-gray-300 mb-1">
                    Descrição Principal *
                  </label>
                  <textarea
                    rows={2}
                    value={listDesc}
                    onChange={(e) => setListDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white focus:border-[#39ff14]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-mono font-semibold text-gray-300 mb-1">
                      Texto do Botão *
                    </label>
                    <input
                      type="text"
                      maxLength={20}
                      value={listBtnText}
                      onChange={(e) => setListBtnText(e.target.value)}
                      className="w-full px-3 py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white focus:border-[#39ff14]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono font-semibold text-gray-300 mb-1">
                      Rodapé
                    </label>
                    <input
                      type="text"
                      value={listFooter}
                      onChange={(e) => setListFooter(e.target.value)}
                      className="w-full px-3 py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white focus:border-[#39ff14]"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  {listSections.map((sec, secIdx) => (
                    <div key={secIdx} className="p-3 bg-[#161922] border border-[#2a3346] rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold text-gray-300">Seção: {sec.title}</span>
                        <button
                          type="button"
                          onClick={() => handleAddListRow(secIdx)}
                          className="text-[11px] text-[#39ff14] font-mono font-bold flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Item
                        </button>
                      </div>
                      {sec.rows.map((row, rowIdx) => (
                        <div key={rowIdx} className="flex items-center gap-2 bg-[#12151c] p-2 rounded-xl border border-[#2a3346]">
                          <input
                            type="text"
                            maxLength={24}
                            value={row.title}
                            placeholder="Título do item"
                            onChange={(e) => {
                              const updated = [...listSections];
                              updated[secIdx].rows[rowIdx].title = e.target.value;
                              setListSections(updated);
                            }}
                            className="flex-1 px-2 py-1 text-xs bg-[#161922] text-white border border-[#2a3346] rounded-lg"
                          />
                          <input
                            type="text"
                            value={row.description || ''}
                            placeholder="Descrição"
                            onChange={(e) => {
                              const updated = [...listSections];
                              updated[secIdx].rows[rowIdx].description = e.target.value;
                              setListSections(updated);
                            }}
                            className="flex-1 px-2 py-1 text-xs bg-[#161922] text-white border border-[#2a3346] rounded-lg"
                          />
                          {sec.rows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveListRow(secIdx, rowIdx)}
                              className="text-gray-400 hover:text-red-400"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() =>
                    handleSend('list', {
                      title: listTitle,
                      description: listDesc,
                      buttonText: listBtnText,
                      footerText: listFooter,
                      sections: listSections,
                    })
                  }
                  disabled={loading}
                  className="w-full mt-4 py-2.5 bg-[#39ff14] hover:bg-[#32e012] text-black font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#39ff14]/20 transition disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Enviar Menu de Opções
                </button>
              </div>
            )}

            {/* TAB 3: WEBVIEW */}
            {activeTab === 'webview' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-mono font-semibold text-gray-300 mb-1">
                    Texto da Mensagem *
                  </label>
                  <textarea
                    rows={3}
                    value={webBody}
                    onChange={(e) => setWebBody(e.target.value)}
                    className="w-full px-3 py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white focus:border-[#39ff14]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono font-semibold text-gray-300 mb-1">
                    Texto do Botão *
                  </label>
                  <input
                    type="text"
                    maxLength={30}
                    value={webBtn}
                    onChange={(e) => setWebBtn(e.target.value)}
                    className="w-full px-3 py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white focus:border-[#39ff14]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono font-semibold text-gray-300 mb-1">
                    URL de Destino (HTTPS) *
                  </label>
                  <input
                    type="url"
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white font-mono focus:border-[#39ff14]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono font-semibold text-gray-300 mb-1">
                    Rodapé (Opcional)
                  </label>
                  <input
                    type="text"
                    value={webFooter}
                    onChange={(e) => setWebFooter(e.target.value)}
                    className="w-full px-3 py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white focus:border-[#39ff14]"
                  />
                </div>

                <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-2xl flex items-start gap-2 text-[11px] text-amber-300 font-mono">
                  <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <span>
                    O WhatsApp abre o navegador nativo in-app para links seguros HTTPS. Endereços de rede interna são protegidos.
                  </span>
                </div>

                <button
                  onClick={() =>
                    handleSend('webview', {
                      bodyText: webBody,
                      buttonText: webBtn,
                      url: webUrl,
                      footerText: webFooter,
                    })
                  }
                  disabled={loading}
                  className="w-full mt-4 py-2.5 bg-[#39ff14] hover:bg-[#32e012] text-black font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#39ff14]/20 transition disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Enviar Webview / CTA URL
                </button>
              </div>
            )}

            {/* TAB 4: CARROSSEL */}
            {activeTab === 'carousel' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-mono font-semibold text-gray-300 mb-1">
                    Texto do Carrossel *
                  </label>
                  <input
                    type="text"
                    value={carouselBody}
                    onChange={(e) => setCarouselBody(e.target.value)}
                    className="w-full px-3 py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white focus:border-[#39ff14]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono font-semibold text-gray-300 mb-1">
                    Rodapé
                  </label>
                  <input
                    type="text"
                    value={carouselFooter}
                    onChange={(e) => setCarouselFooter(e.target.value)}
                    className="w-full px-3 py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white focus:border-[#39ff14]"
                  />
                </div>

                <div className="p-3 bg-[#161922] border border-[#2a3346] rounded-xl space-y-2 text-xs font-mono">
                  <span className="text-gray-400 block font-bold">Botões do Carrossel:</span>
                  <div className="text-[11px] text-gray-300 space-y-1">
                    <div>1. Link URL: Documentação Zapo (https://zapo.to)</div>
                    <div>2. Resposta Rápida: Confirmar Teste</div>
                  </div>
                </div>

                <button
                  onClick={() =>
                    handleSend('carousel', {
                      bodyText: carouselBody,
                      footerText: carouselFooter,
                      buttons: carouselButtons,
                    })
                  }
                  disabled={loading}
                  className="w-full mt-4 py-2.5 bg-[#39ff14] hover:bg-[#32e012] text-black font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#39ff14]/20 transition disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Enviar Carrossel Interativo
                </button>
              </div>
            )}

            {/* TAB 5: MODO FANTASMA (TEMPORÁRIAS) */}
            {activeTab === 'ephemeral' && (
              <div className="space-y-4">
                <div className="flex bg-[#0e1118] p-1 rounded-xl border border-[#2a3346]">
                  <button
                    onClick={() => setEphMode('single')}
                    className={`flex-1 py-1.5 text-xs font-mono font-bold rounded-lg transition ${
                      ephMode === 'single' ? 'bg-[#1a202c] text-[#39ff14] shadow' : 'text-gray-400'
                    }`}
                  >
                    Mensagem Individual
                  </button>
                  <button
                    onClick={() => setEphMode('chat')}
                    className={`flex-1 py-1.5 text-xs font-mono font-bold rounded-lg transition ${
                      ephMode === 'chat' ? 'bg-[#1a202c] text-[#39ff14] shadow' : 'text-gray-400'
                    }`}
                  >
                    Configurar Conversa
                  </button>
                </div>

                {ephMode === 'single' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-mono font-semibold text-gray-300 mb-1">
                        Conteúdo da Mensagem Efêmera *
                      </label>
                      <input
                        type="text"
                        value={ephSingleText}
                        onChange={(e) => setEphSingleText(e.target.value)}
                        className="w-full px-3 py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white focus:border-[#39ff14]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono font-semibold text-gray-300 mb-1">
                        Duração de Expiração (segundos) *
                      </label>
                      <div className="flex items-center gap-1.5 mb-2 overflow-x-auto scrollbar-none pb-0.5">
                        {[1, 2, 3, 4, 5, 10, 30, 60].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setEphSingleSeconds(s)}
                            className={`px-2 py-0.5 text-[11px] font-mono rounded-lg border transition ${
                              ephSingleSeconds === s
                                ? 'border-[#39ff14] bg-[#39ff14]/20 text-[#39ff14] font-bold'
                                : 'border-[#2a3346] bg-[#161922] text-gray-400 hover:text-white'
                            }`}
                          >
                            {s}s
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={ephSingleSeconds}
                        onChange={(e) => setEphSingleSeconds(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white font-mono focus:border-[#39ff14]"
                      />
                    </div>

                    <button
                      onClick={() =>
                        handleSend('ephemeral_message', {
                          text: ephSingleText,
                          expirationSeconds: ephSingleSeconds,
                          duration: ephSingleSeconds,
                          afterReadDuration: ephSingleSeconds,
                          experimentalAfterRead: true,
                        })
                      }
                      disabled={loading || !ephSingleText.trim()}
                      className="w-full mt-4 py-2.5 bg-[#39ff14] hover:bg-[#32e012] text-black font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#39ff14]/20 transition disabled:opacity-50 cursor-pointer"
                    >
                      <Ghost className="w-3.5 h-3.5" />
                      Enviar Mensagem Fantasma
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="block text-xs font-mono font-semibold text-gray-300">
                      Duração das Mensagens na Conversa
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: '24 Horas', secs: 86400 },
                        { label: '7 Dias', secs: 604800 },
                        { label: '90 Dias', secs: 7776000 },
                        { label: 'Desativar (0s)', secs: 0 },
                      ].map((item) => (
                        <button
                          key={item.secs}
                          type="button"
                          onClick={() => setEphChatSeconds(item.secs)}
                          className={`p-2.5 text-xs font-mono font-semibold rounded-xl border text-center transition ${
                            ephChatSeconds === item.secs
                              ? 'border-[#39ff14] bg-[#39ff14]/15 text-[#39ff14]'
                              : 'border-[#2a3346] bg-[#161922] text-gray-300 hover:border-gray-500'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() =>
                        handleSend('ephemeral_setting', {
                          ephemeralExpiration: ephChatSeconds,
                          duration: ephChatSeconds,
                        })
                      }
                      disabled={loading}
                      className="w-full mt-4 py-2.5 bg-[#39ff14] hover:bg-[#32e012] text-black font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#39ff14]/20 transition disabled:opacity-50 cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      Aplicar Modo Fantasma na Conversa
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: LABORATÓRIO DE PAYLOADS (RAW CODE) */}
            {activeTab === 'raw' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-semibold text-gray-300">
                    Modelos Pré-definidos:
                  </label>
                  <select
                    onChange={(e) => {
                      const selected = examples[e.target.value];
                      if (selected) {
                        setRawJsonText(JSON.stringify(selected.payload, null, 2));
                      }
                    }}
                    className="text-xs bg-[#161922] border border-[#2a3346] text-white rounded-lg px-2 py-1 font-mono focus:border-[#39ff14]"
                  >
                    <option value="">Carregar exemplo...</option>
                    <option value="rawLocation">Localização GPS</option>
                    <option value="rawPixPayment">Pagamento PIX Business</option>
                    <option value="buttons">Botões Rápidos</option>
                    <option value="list">Menu de Opções</option>
                  </select>
                </div>

                <div>
                  <textarea
                    rows={12}
                    value={rawJsonText}
                    onChange={(e) => setRawJsonText(e.target.value)}
                    className="w-full p-3 bg-[#0d1117] text-[#39ff14] font-mono text-xs rounded-xl focus:outline-none border border-[#2a3346] focus:border-[#39ff14]"
                  />
                </div>

                <button
                  onClick={() => {
                    try {
                      const parsed = JSON.parse(rawJsonText);
                      handleSend('raw', parsed);
                    } catch (e: any) {
                      setResultError(`JSON Inválido: ${e.message}`);
                    }
                  }}
                  disabled={loading}
                  className="w-full py-2.5 bg-[#39ff14] hover:bg-[#32e012] text-black font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#39ff14]/20 transition disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Transmitir Payload Raw Protobuf
                </button>
              </div>
            )}

            {/* TAB 7: APAGA ISSO! (REVOKE) */}
            {activeTab === 'revoke' && (
              <div className="space-y-4">
                <div className="p-3 bg-red-950/30 border border-red-500/40 rounded-2xl flex items-start gap-2.5 text-xs text-red-300 font-mono">
                  <Skull className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  <span>
                    O comando de revogação solicita ao servidor do WhatsApp apagar a mensagem no celular de todos os participantes.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-mono font-semibold text-gray-300 mb-1">
                    Stanza ID da Mensagem Enviada *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 3EB0XXXXX..."
                    value={revokeStanzaId}
                    onChange={(e) => setRevokeStanzaId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white font-mono focus:border-red-500"
                  />
                  <p className="text-[10px] text-gray-500 font-mono mt-1">
                    Dica: Você também pode clicar diretamente em "Apagar para todos" ao passar o mouse sobre suas mensagens no chat.
                  </p>
                </div>

                <button
                  onClick={handleManualRevoke}
                  disabled={loading || !revokeStanzaId.trim()}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Executar Revogação Imediata
                </button>
              </div>
            )}
          </div>

          {/* Column 2: Live WhatsApp Simulator */}
          <div className="p-5 bg-[#0b0e14] flex flex-col justify-between border-t md:border-t-0 overflow-y-auto wa-lab-bg">
            <div>
              <div className="flex items-center justify-between mb-3 text-xs text-gray-400 font-mono font-semibold uppercase tracking-wider">
                <span className="flex items-center gap-1.5 text-[#39ff14]">
                  <Eye className="w-4 h-4" />
                  Simulador de Mensagem WhatsApp
                </span>
                <span className="text-[10px] bg-[#161922] px-2 py-0.5 rounded-full border border-[#2a3346] text-gray-300">
                  Ao Vivo
                </span>
              </div>

              {/* Chat Bubble Mockup */}
              <div className="max-w-xs ml-auto space-y-2">
                <div className="bg-[#14382d] p-3.5 rounded-2xl rounded-tr-none border border-[#10b981]/30 text-white text-xs shadow-lg">
                  {/* Buttons Mockup */}
                  {activeTab === 'buttons' && (
                    <div className="space-y-1.5 font-sans">
                      {btnHeader && <div className="font-bold text-white font-mono text-[11px]">{btnHeader}</div>}
                      <div className="text-[12px] leading-relaxed">{btnContent}</div>
                      {btnFooter && <div className="text-[10px] text-gray-400 pt-1 font-mono">{btnFooter}</div>}
                    </div>
                  )}

                  {/* List Mockup */}
                  {activeTab === 'list' && (
                    <div className="space-y-1.5 font-sans">
                      <div className="font-bold text-white font-mono text-[11px]">{listTitle}</div>
                      <div className="text-[12px] leading-relaxed">{listDesc}</div>
                      {listFooter && <div className="text-[10px] text-gray-400 pt-1 font-mono">{listFooter}</div>}
                    </div>
                  )}

                  {/* Webview Mockup */}
                  {activeTab === 'webview' && (
                    <div className="space-y-1.5 font-sans">
                      <div className="text-[12px] leading-relaxed">{webBody}</div>
                      <div className="text-[10px] text-[#38bdf8] font-mono truncate">{webUrl}</div>
                      {webFooter && <div className="text-[10px] text-gray-400 pt-1 font-mono">{webFooter}</div>}
                    </div>
                  )}

                  {/* Carousel Mockup */}
                  {activeTab === 'carousel' && (
                    <div className="space-y-1.5 font-sans">
                      <div className="text-[12px] leading-relaxed">{carouselBody}</div>
                      {carouselFooter && <div className="text-[10px] text-gray-400 pt-1 font-mono">{carouselFooter}</div>}
                    </div>
                  )}

                  {/* Ephemeral Mockup */}
                  {activeTab === 'ephemeral' && (
                    <div className="space-y-1 font-sans">
                      <div className="flex items-center gap-1 text-[11px] text-[#facc15] font-mono mb-1">
                        <Clock className="w-3.5 h-3.5" /> Mensagem Temporária
                      </div>
                      <div className="text-[12px]">{ephMode === 'chat' ? `Configurado para ${ephChatSeconds}s` : ephSingleText}</div>
                    </div>
                  )}

                  {/* Raw Mockup */}
                  {activeTab === 'raw' && (
                    <div>
                      <span className="font-mono text-[11px] text-[#39ff14]">
                        [Payload Protobuf Raw Compilado]
                      </span>
                    </div>
                  )}

                  {/* Revoke Mockup */}
                  {activeTab === 'revoke' && (
                    <div>
                      <span className="font-mono text-[11px] text-red-300">
                        [Ordem de Revogação Remota]
                      </span>
                    </div>
                  )}

                  <div className="text-[10px] text-gray-400 text-right mt-1 font-mono">
                    Agora ✓✓
                  </div>
                </div>

                {/* Interactive Action Buttons Attached Below Bubble */}
                {activeTab === 'buttons' && (
                  <div className="space-y-1">
                    {buttonsList.map((b, i) => (
                      <div
                        key={i}
                        className="w-full py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-center text-xs font-mono font-semibold text-[#38bdf8] shadow-sm"
                      >
                        {b.displayText || 'Botão'}
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'list' && (
                  <div className="w-full py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-center text-xs font-mono font-semibold text-[#a855f7] shadow-sm flex items-center justify-center gap-1.5">
                    <List className="w-3.5 h-3.5" />
                    <span>{listBtnText || 'Ver Opções'}</span>
                  </div>
                )}

                {activeTab === 'webview' && (
                  <div className="w-full py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-center text-xs font-mono font-semibold text-[#38bdf8] shadow-sm flex items-center justify-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{webBtn || 'Abrir'}</span>
                  </div>
                )}

                {activeTab === 'carousel' && (
                  <div className="space-y-1">
                    <div className="w-full py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-center text-xs font-mono font-semibold text-[#38bdf8] shadow-sm flex items-center justify-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Documentação Zapo</span>
                    </div>
                    <div className="w-full py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-center text-xs font-mono font-semibold text-[#39ff14] shadow-sm">
                      Confirmar Teste
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Live Server Response Inspector */}
            {rawResponseData && (
              <div className="mt-4 p-3 bg-[#0e121a] rounded-2xl border border-[#2a3346] text-xs space-y-1 max-h-36 overflow-y-auto">
                <span className="font-mono font-bold text-[#39ff14] block">Resposta do Servidor Zapo:</span>
                <pre className="text-[10px] font-mono text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(rawResponseData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
