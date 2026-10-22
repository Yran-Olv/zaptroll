import React, { useState, useEffect } from 'react';
import { X, Sparkles, LayoutTemplate, ArrowRight, Check, Tag } from 'lucide-react';
import api from '../../services/api.js';
import { FlowTemplateSummary } from '../../types/flows.js';

interface TemplateSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (templateId: string) => void;
}

export const TemplateSelectorModal: React.FC<TemplateSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  if (!isOpen) return null;

  const [templates, setTemplates] = useState<FlowTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        const res = await api.get('/flows/templates');
        setTemplates(res.data.templates || []);
      } catch (err) {
        console.error('Erro ao carregar templates:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  const categories = ['all', ...Array.from(new Set(templates.map((t) => t.category)))];

  const filtered = selectedCategory === 'all'
    ? templates
    : templates.filter((t) => t.category === selectedCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#161922] border border-[#2a3346] w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-[#11141c] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#39ff14]/10 border border-[#39ff14]/30 text-[#39ff14]">
              <LayoutTemplate className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-mono">
                Modelos Prontos de Automação
              </h2>
              <p className="text-xs text-gray-400">
                Inicie rapidamente com fluxos completos de ponta a ponta testados para a Zapo.
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

        {/* Categories Bar */}
        <div className="px-5 py-2.5 bg-[#131722] border-b border-white/5 flex gap-2 overflow-x-auto text-xs font-mono">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl capitalize transition-all ${
                selectedCategory === cat
                  ? 'bg-[#39ff14]/10 text-[#39ff14] border border-[#39ff14]/30 font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {cat === 'all' ? 'Todos os Modelos' : cat}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-2 py-12 flex flex-col items-center justify-center text-gray-400">
              <div className="w-8 h-8 border-2 border-[#39ff14] border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-xs font-mono">Carregando modelos do laboratório...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-2 py-12 text-center text-gray-500 font-mono text-xs">
              Nenhum modelo encontrado nesta categoria.
            </div>
          ) : (
            filtered.map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => onSelectTemplate(tpl.id)}
                className="group p-4 rounded-2xl bg-[#0b0e14] border border-white/5 hover:border-[#39ff14]/40 hover:bg-[#111622] transition-all cursor-pointer flex flex-col justify-between shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-gray-400 uppercase">
                      {tpl.category}
                    </span>
                    <span className="text-[10px] font-mono text-[#39ff14]">
                      {tpl.nodesCount} nós
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white group-hover:text-[#39ff14] transition-colors mb-1.5">
                    {tpl.name}
                  </h3>
                  <p className="text-xs text-gray-400 leading-relaxed mb-4 line-clamp-3">
                    {tpl.description}
                  </p>
                </div>

                <div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {tpl.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[9px] font-mono text-gray-500 bg-white/5 px-1.5 py-0.5 rounded"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="w-full py-2 px-3 rounded-xl bg-white/5 group-hover:bg-[#39ff14] text-gray-300 group-hover:text-black font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <span>Usar este Modelo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
