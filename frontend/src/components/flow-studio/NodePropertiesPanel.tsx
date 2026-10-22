import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Sliders,
  Sparkles,
  Info,
  Check,
  Globe,
  QrCode,
  Gamepad2,
} from 'lucide-react';
import { FlowNode } from '../../types/flows.js';

interface NodePropertiesPanelProps {
  node: FlowNode | null;
  onClose: () => void;
  onUpdateNode: (updatedNode: FlowNode) => void;
}

export const NodePropertiesPanel: React.FC<NodePropertiesPanelProps> = ({
  node,
  onClose,
  onUpdateNode,
}) => {
  if (!node) return null;

  const [name, setName] = useState(node.name);
  const [data, setData] = useState({ ...node.data });

  useEffect(() => {
    setName(node.name);
    setData({ ...node.data });
  }, [node]);

  const updateData = (key: string, value: any) => {
    const updatedData = { ...data, [key]: value };
    setData(updatedData);
    onUpdateNode({ ...node, data: updatedData });
  };

  const handleNameChange = (val: string) => {
    setName(val);
    onUpdateNode({ ...node, name: val });
  };

  // Button helpers for interactive_buttons
  const handleAddButton = () => {
    const btns = data.buttons || [];
    const newBtn = {
      buttonId: `btn_${Date.now()}`,
      displayText: `Opção ${btns.length + 1}`,
    };
    updateData('buttons', [...btns, newBtn]);
  };

  const handleRemoveButton = (index: number) => {
    const btns = [...(data.buttons || [])];
    btns.splice(index, 1);
    updateData('buttons', btns);
  };

  const handleUpdateButton = (index: number, key: string, val: string) => {
    const btns = [...(data.buttons || [])];
    btns[index] = { ...btns[index], [key]: val };
    updateData('buttons', btns);
  };

  // Form field helpers for hosted_page_button
  const handleAddFormField = () => {
    const schema = data.schema || { title: 'Formulário ZapTroll', fields: [] };
    const fields = schema.fields || [];
    const newField = {
      id: `field_${Date.now()}`,
      label: `Campo ${fields.length + 1}`,
      type: 'text',
      required: true,
    };
    updateData('schema', { ...schema, fields: [...fields, newField] });
  };

  const handleRemoveFormField = (index: number) => {
    const schema = data.schema || { fields: [] };
    const fields = [...(schema.fields || [])];
    fields.splice(index, 1);
    updateData('schema', { ...schema, fields });
  };

  const handleUpdateFormField = (index: number, key: string, val: any) => {
    const schema = data.schema || { fields: [] };
    const fields = [...(schema.fields || [])];
    fields[index] = { ...fields[index], [key]: val };
    updateData('schema', { ...schema, fields });
  };

  return (
    <div className="w-80 sm:w-96 bg-[#161922] border-l border-white/10 flex flex-col h-full shadow-2xl z-30 animate-in slide-in-from-right duration-200">
      {/* Panel Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#11141c]">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#39ff14]" />
          <div>
            <h2 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
              Propriedades do Nó
            </h2>
            <span className="text-[10px] text-gray-400 font-mono">
              ID: {node.id} • {node.type}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body / Form fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-gray-300">
        {/* Node Name */}
        <div className="space-y-1">
          <label className="block text-[11px] font-mono text-gray-400">Nome de Identificação</label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full bg-[#0b0e14] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#39ff14] font-medium"
          />
        </div>

        {/* 1. TRIGGER KEYWORD */}
        {node.type === 'trigger_keyword' && (
          <div className="space-y-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Quando o usuário enviar qualquer uma dessas palavras-chave no WhatsApp, o fluxo será disparado.
              </span>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-mono text-gray-400">
                Palavras-chave (separadas por vírgula)
              </label>
              <input
                type="text"
                value={(data.keywords || []).join(', ')}
                onChange={(e) =>
                  updateData(
                    'keywords',
                    e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                  )
                }
                placeholder="/inicio, cardapio, oi, ola"
                className="w-full bg-[#0b0e14] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>
          </div>
        )}

        {/* 2. MESSAGE TEXT */}
        {node.type === 'message_text' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-mono text-gray-400">Conteúdo da Mensagem</label>
                <span className="text-[10px] text-[#39ff14] font-mono">Suporta {'{{variavel}}'}</span>
              </div>
              <textarea
                rows={5}
                value={data.text || ''}
                onChange={(e) => updateData('text', e.target.value)}
                placeholder="Olá {{nome}}, seja bem-vindo ao atendimento..."
                className="w-full bg-[#0b0e14] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#39ff14] font-sans text-xs leading-relaxed"
              />
            </div>
          </div>
        )}

        {/* 3. INTERACTIVE BUTTONS */}
        {node.type === 'interactive_buttons' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-mono text-gray-400">Cabeçalho (Header)</label>
              <input
                type="text"
                value={data.header || ''}
                onChange={(e) => updateData('header', e.target.value)}
                placeholder="Título do menu"
                className="w-full bg-[#0b0e14] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-400"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-mono text-gray-400">Corpo da Mensagem (Body)</label>
              <textarea
                rows={3}
                value={data.content || ''}
                onChange={(e) => updateData('content', e.target.value)}
                placeholder="Escolha uma das opções abaixo:"
                className="w-full bg-[#0b0e14] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-blue-400"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-mono text-gray-400">Rodapé (Footer)</label>
              <input
                type="text"
                value={data.footer || ''}
                onChange={(e) => updateData('footer', e.target.value)}
                placeholder="ZapTroll Automação"
                className="w-full bg-[#0b0e14] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-400"
              />
            </div>

            {/* Buttons list */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-gray-400">Botões de Ação</span>
                <button
                  type="button"
                  onClick={handleAddButton}
                  className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 font-mono"
                >
                  <Plus className="w-3 h-3" />
                  <span>Adicionar Botão</span>
                </button>
              </div>

              {(data.buttons || []).map((b: any, idx: number) => (
                <div key={b.buttonId || idx} className="p-2.5 rounded-xl bg-[#0b0e14] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-gray-500">Botão #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveButton(idx)}
                      className="text-gray-500 hover:text-red-400 p-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={b.displayText || ''}
                    onChange={(e) => handleUpdateButton(idx, 'displayText', e.target.value)}
                    placeholder="Texto do Botão"
                    className="w-full bg-[#161922] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-400"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. HOSTED PAGE / FORM BUTTON */}
        {node.type === 'hosted_page_button' && (
          <div className="space-y-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px]">
              Gera um botão CTA URL nativo no WhatsApp que abre uma página web responsiva com formulário seguro.
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-mono text-gray-400">Texto do Botão</label>
              <input
                type="text"
                value={data.buttonText || ''}
                onChange={(e) => updateData('buttonText', e.target.value)}
                placeholder="Preencher Dados"
                className="w-full bg-[#0b0e14] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-400"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-mono text-gray-400">Título do Formulário</label>
              <input
                type="text"
                value={data.schema?.title || ''}
                onChange={(e) =>
                  updateData('schema', { ...(data.schema || {}), title: e.target.value })
                }
                placeholder="Cadastro de Entrega"
                className="w-full bg-[#0b0e14] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-400"
              />
            </div>

            {/* Dynamic fields */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-gray-400">Campos do Formulário</span>
                <button
                  type="button"
                  onClick={handleAddFormField}
                  className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-mono"
                >
                  <Plus className="w-3 h-3" />
                  <span>Novo Campo</span>
                </button>
              </div>

              {(data.schema?.fields || []).map((f: any, idx: number) => (
                <div key={f.id || idx} className="p-2.5 rounded-xl bg-[#0b0e14] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={f.label || ''}
                      onChange={(e) => handleUpdateFormField(idx, 'label', e.target.value)}
                      placeholder="Rótulo do Campo"
                      className="bg-[#161922] border border-white/10 rounded px-2 py-1 text-xs text-white w-2/3"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFormField(idx)}
                      className="text-gray-500 hover:text-red-400 p-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={f.type || 'text'}
                      onChange={(e) => handleUpdateFormField(idx, 'type', e.target.value)}
                      className="bg-[#161922] border border-white/10 rounded px-2 py-1 text-[11px] text-gray-300 w-1/2"
                    >
                      <option value="text">Texto</option>
                      <option value="number">Número</option>
                      <option value="email">E-mail</option>
                      <option value="phone">Telefone</option>
                      <option value="textarea">Texto Longo</option>
                    </select>
                    <label className="flex items-center gap-1 text-[10px] text-gray-400 font-mono">
                      <input
                        type="checkbox"
                        checked={f.required ?? true}
                        onChange={(e) => handleUpdateFormField(idx, 'required', e.target.checked)}
                      />
                      Obrigatório
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. DATA CAPTURE */}
        {node.type === 'data_capture' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-mono text-gray-400">Mensagem de Solicitação</label>
              <textarea
                rows={3}
                value={data.promptMessage || ''}
                onChange={(e) => updateData('promptMessage', e.target.value)}
                placeholder="Por favor, digite seu endereço completo:"
                className="w-full bg-[#0b0e14] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-mono text-gray-400">Nome da Variável</label>
              <input
                type="text"
                value={data.variableName || ''}
                onChange={(e) => updateData('variableName', e.target.value)}
                placeholder="cliente_endereco"
                className="w-full bg-[#0b0e14] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-mono text-gray-400">Tipo de Validação</label>
              <select
                value={data.validationType || 'text'}
                onChange={(e) => updateData('validationType', e.target.value)}
                className="w-full bg-[#0b0e14] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="text">Qualquer Texto</option>
                <option value="number">Apenas Números</option>
                <option value="email">E-mail Válido</option>
                <option value="phone">Telefone / WhatsApp</option>
              </select>
            </div>
          </div>
        )}

        {/* 6. CONDITION */}
        {node.type === 'condition' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-mono text-gray-400">Variável a Comparar</label>
              <input
                type="text"
                value={data.variableName || ''}
                onChange={(e) => updateData('variableName', e.target.value)}
                placeholder="opcao_escolhida"
                className="w-full bg-[#0b0e14] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-400 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-mono text-gray-400">Operador</label>
              <select
                value={data.operator || '=='}
                onChange={(e) => updateData('operator', e.target.value)}
                className="w-full bg-[#0b0e14] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-400"
              >
                <option value="==">Igual a (==)</option>
                <option value="!=">Diferente de (!=)</option>
                <option value=">">Maior que (&gt;)</option>
                <option value="<">Menor que (&lt;)</option>
                <option value="contains">Contém texto (contains)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-mono text-gray-400">Valor Esperado</label>
              <input
                type="text"
                value={data.expectedValue || ''}
                onChange={(e) => updateData('expectedValue', e.target.value)}
                placeholder="1"
                className="w-full bg-[#0b0e14] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-400"
              />
            </div>
          </div>
        )}

        {/* 7. HTTP REQUEST */}
        {node.type === 'http_request' && (
          <div className="space-y-3">
            <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-300 text-[11px] flex gap-2">
              <Globe className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Proteção SSRF Ativa: Chamadas para IPs privados, CGNAT e metadados de nuvem são automaticamente bloqueadas.
              </span>
            </div>

            <div className="flex gap-2">
              <div className="w-24">
                <label className="block text-[11px] font-mono text-gray-400">Método</label>
                <select
                  value={data.method || 'POST'}
                  onChange={(e) => updateData('method', e.target.value)}
                  className="w-full bg-[#0b0e14] border border-white/10 rounded-xl px-2.5 py-2 text-white font-mono"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[11px] font-mono text-gray-400">URL da API</label>
                <input
                  type="text"
                  value={data.url || ''}
                  onChange={(e) => updateData('url', e.target.value)}
                  placeholder="https://api.exemplo.com/webhook"
                  className="w-full bg-[#0b0e14] border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-mono text-gray-400">Salvar Resposta na Variável</label>
              <input
                type="text"
                value={data.outputVariable || 'api_response'}
                onChange={(e) => updateData('outputVariable', e.target.value)}
                placeholder="api_response"
                className="w-full bg-[#0b0e14] border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
          </div>
        )}

        {/* 8. PIX CHARGE */}
        {node.type === 'pix_charge' && (
          <div className="space-y-3">
            <div className="p-2.5 rounded-xl bg-lime-500/10 border border-lime-500/20 text-lime-300 text-[11px] flex gap-2">
              <QrCode className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Gera QR Code Pix EMV legítimo e envia para o WhatsApp do cliente com chave e valor.
              </span>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-mono text-gray-400">Chave Pix</label>
              <input
                type="text"
                value={data.pixKey || ''}
                onChange={(e) => updateData('pixKey', e.target.value)}
                placeholder="exemplo@zaptroll.com"
                className="w-full bg-[#0b0e14] border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-mono text-gray-400">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                value={data.amount || '49.90'}
                onChange={(e) => updateData('amount', e.target.value)}
                placeholder="49.90"
                className="w-full bg-[#0b0e14] border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-mono text-gray-400">Nome do Beneficiário</label>
              <input
                type="text"
                value={data.merchantName || 'ZapTroll Store'}
                onChange={(e) => updateData('merchantName', e.target.value)}
                className="w-full bg-[#0b0e14] border border-white/10 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>
        )}

        {/* 9. GAME LAUNCHER */}
        {node.type === 'game_launcher' && (
          <div className="space-y-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] flex gap-2">
              <Gamepad2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Abre um jogo web arcade retrô touch-enabled (/r/jogos) ou a Arena RPG do ZapTroll.
              </span>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-mono text-gray-400">Tipo de Jogo</label>
              <select
                value={data.gameType || 'doom_retro'}
                onChange={(e) => updateData('gameType', e.target.value)}
                className="w-full bg-[#0b0e14] border border-white/10 rounded-xl px-3 py-2 text-white"
              >
                <option value="doom_retro">DOOM Sector (WASM / Canvas Arcade)</option>
                <option value="rpg_arena">ZapTroll RPG Arena (Batalha ao Vivo)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-mono text-gray-400">Texto do Botão CTA</label>
              <input
                type="text"
                value={data.buttonText || 'Jogar Agora 🚀'}
                onChange={(e) => updateData('buttonText', e.target.value)}
                className="w-full bg-[#0b0e14] border border-white/10 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-[#11141c] border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-gray-400">
        <span className="flex items-center gap-1 text-[#39ff14]">
          <Check className="w-3.5 h-3.5" />
          <span>Salvo em memória</span>
        </span>
        <button
          onClick={onClose}
          className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-all"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};
