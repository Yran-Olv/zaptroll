import React, { useState } from 'react';
import { X, Search, Sparkles, Copy, Check, UserCheck, Flame, Laugh, Shield } from 'lucide-react';
import { MEME_CATALOG, MemeItem } from './memeData.js';

interface MemeGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAvatar?: (memeId: string) => void;
}

export const MemeGalleryModal: React.FC<MemeGalleryModalProps> = ({
  isOpen,
  onClose,
  onSelectAvatar,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewMeme, setPreviewMeme] = useState<MemeItem | null>(MEME_CATALOG[0]);

  if (!isOpen) return null;

  const categories = [
    { id: 'all', label: 'Todos os Memes' },
    { id: 'trollface', label: 'Trollface' },
    { id: 'rage', label: 'Rage Comics' },
    { id: 'reactions', label: 'Reações' },
    { id: 'caos', label: 'Caos' },
    { id: 'classicos', label: 'Clássicos' },
    { id: 'aleatorios', label: 'Aleatórios' },
  ];

  const filteredMemes = MEME_CATALOG.filter((meme) => {
    const matchesCat = selectedCategory === 'all' || meme.category === selectedCategory;
    const matchesSearch =
      meme.name.toLowerCase().includes(search.toLowerCase()) ||
      meme.quote.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleCopyQuote = (meme: MemeItem) => {
    navigator.clipboard.writeText(meme.quote);
    setCopiedId(meme.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSetAvatar = (memeId: string) => {
    localStorage.setItem('zaptroll_lab_avatar', memeId);
    if (onSelectAvatar) {
      onSelectAvatar(memeId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#12151c] w-full max-w-4xl max-h-[90vh] rounded-3xl border border-[#2a3346] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#2a3346] flex items-center justify-between bg-[#161922]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#39ff14]/15 border border-[#39ff14]/30 flex items-center justify-center text-[#39ff14]">
              <Laugh className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Galeria de Memes & Stickers
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/40">
                  ANO 2010 EDITION
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono">
                Coleção de Rage Comics e expressões para trollagens e testes no WhatsApp
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="p-3 sm:p-4 border-b border-[#2a3346] bg-[#141822] space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar meme por nome ou frase..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#1a202c] border border-[#2a3346] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#39ff14] transition font-mono"
            />
          </div>

          {/* Categories Horizontal Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat.id
                    ? 'bg-[#39ff14] text-black shadow-[0_0_12px_rgba(57,255,20,0.3)]'
                    : 'bg-[#1a202c] text-gray-300 hover:bg-[#222b3d] border border-[#2a3346]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Area: Grid of Memes + Preview Sidebar on desktop */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3">
          {/* Grid column (2 cols in desktop) */}
          <div className="md:col-span-2 p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredMemes.map((meme) => {
              const SvgComp = meme.component;
              const isSelected = previewMeme?.id === meme.id;
              return (
                <div
                  key={meme.id}
                  onClick={() => setPreviewMeme(meme)}
                  style={{
                    borderColor: isSelected ? meme.color : '#2a3346',
                  }}
                  className={`p-3 rounded-2xl bg-[#161922] border cursor-pointer transition-all hover:scale-[1.02] flex flex-col items-center text-center group ${
                    isSelected ? 'ring-2 ring-offset-1 ring-offset-[#12151c]' : 'hover:border-gray-600'
                  }`}
                >
                  <div className="w-16 h-16 rounded-xl bg-black/40 p-2 mb-2 flex items-center justify-center border border-white/5 group-hover:rotate-3 transition-transform">
                    <SvgComp className="w-full h-full object-contain filter drop-shadow" />
                  </div>
                  <h4 className="text-xs font-bold text-white leading-tight">
                    {meme.name}
                  </h4>
                  <span className="text-[10px] text-gray-400 font-mono capitalize mt-1">
                    {meme.category}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Preview & Actions Sidebar */}
          {previewMeme && (
            <div className="hidden md:flex flex-col p-5 bg-[#141822] border-l border-[#2a3346] justify-between">
              <div>
                <div className="w-32 h-32 mx-auto rounded-3xl bg-[#1a202c] border-2 border-[#2a3346] p-4 flex items-center justify-center shadow-xl mb-4 relative">
                  {React.createElement(previewMeme.component, {
                    className: 'w-full h-full object-contain',
                  })}
                  <span
                    style={{ backgroundColor: previewMeme.color }}
                    className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold text-black uppercase"
                  >
                    {previewMeme.category}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white text-center">
                  {previewMeme.name}
                </h3>

                <div className="p-3 bg-[#1a202c] rounded-2xl border border-[#2a3346] my-4 text-xs font-mono text-gray-300 italic text-center">
                  "{previewMeme.quote}"
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleCopyQuote(previewMeme)}
                    className="w-full py-2 px-3 bg-[#222b3d] hover:bg-[#2a354c] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition border border-[#2a3346]"
                  >
                    {copiedId === previewMeme.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#39ff14]" />
                        <span>Frase Copiada!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Frase do Meme</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetAvatar(previewMeme.id)}
                    className="w-full py-2 px-3 bg-[#39ff14] hover:bg-[#32e012] text-black font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-md shadow-[#39ff14]/20"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Usar como Avatar do Lab</span>
                  </button>
                </div>
              </div>

              <div className="text-[10px] text-gray-500 font-mono text-center pt-4 border-t border-[#2a3346]">
                Memes integrados localmente em SVG vetorial de alta fidelidade.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
