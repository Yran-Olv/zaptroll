import React, { useState } from 'react';
import { Sparkles, Terminal } from 'lucide-react';

interface TrollModeBadgeProps {
  className?: string;
}

export const TrollModeBadge: React.FC<TrollModeBadgeProps> = ({ className = '' }) => {
  const [showTip, setShowTip] = useState(false);

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={() => setShowTip(!showTip)}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        className="px-2 py-0.5 rounded-full bg-[#10b981]/15 border border-[#10b981]/40 text-[#10b981] text-[10px] font-mono font-bold tracking-wider flex items-center gap-1.5 hover:bg-[#10b981]/25 transition"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
        <span>MODO TROLL ATIVO</span>
        <Sparkles className="w-2.5 h-2.5 text-[#10b981]" />
      </button>

      {showTip && (
        <div className="absolute top-full mt-2 left-0 z-50 w-56 p-2.5 rounded-xl bg-[#161922] border border-[#2a3346] shadow-xl text-[11px] text-gray-300 backdrop-blur-md animate-in fade-in zoom-in-95 pointer-events-none">
          <div className="flex items-center gap-1.5 font-bold text-[#10b981] mb-1 font-mono">
            <Terminal className="w-3.5 h-3.5" />
            <span>ZAPTROLL LAB // V2</span>
          </div>
          <p className="text-gray-400 leading-snug">
            Sessão com injeção de memes, payloads avançados Zapo e testes experimentais liberados.
          </p>
        </div>
      )}
    </div>
  );
};
