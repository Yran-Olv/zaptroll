import React, { useState } from 'react';
import {
  Sparkles,
  Terminal,
  RefreshCw,
  MousePointerClick,
  Layers,
  Ghost,
  Laugh,
  Flame,
} from 'lucide-react';
import { getRandomMeme, getMemeById, LAB_QUOTES } from './memeData.js';
import { MemeSticker } from './MemeSticker.js';
import { MemeBackground } from './MemeBackground.js';

interface EmptyConversationStateProps {
  type?: 'no_selection' | 'empty_chat' | 'no_results';
  onOpenTools?: () => void;
  onOpenGallery?: () => void;
}

export const EmptyConversationState: React.FC<EmptyConversationStateProps> = ({
  type = 'no_selection',
  onOpenTools,
  onOpenGallery,
}) => {
  const [currentMeme, setCurrentMeme] = useState(() => getRandomMeme());
  const [quoteIndex, setQuoteIndex] = useState(() =>
    Math.floor(Math.random() * LAB_QUOTES.length)
  );

  const handleNextMeme = () => {
    setCurrentMeme(getRandomMeme());
    setQuoteIndex((prev) => (prev + 1) % LAB_QUOTES.length);
  };

  const handleSelectMemeById = (memeId: string) => {
    const meme = getMemeById(memeId);
    if (meme) {
      setCurrentMeme(meme);
    }
  };

  const SvgComponent = currentMeme.component;

  if (type === 'empty_chat') {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto my-auto">
        <div
          onClick={handleNextMeme}
          className="w-24 h-24 rounded-3xl bg-[#161922] border-2 border-dashed border-[#2a3346] hover:border-[#10b981] p-3.5 mb-4 cursor-pointer transition-all hover:scale-105 group relative shadow-xl"
          title="Clique para trocar o meme!"
        >
          <SvgComponent className="w-full h-full object-contain filter drop-shadow group-hover:rotate-6 transition-transform" />
          <div className="absolute -bottom-2 -right-2 p-1.5 bg-[#10b981] text-black rounded-full shadow">
            <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform" />
          </div>
        </div>

        <h3 className="text-lg font-bold text-white mb-1 tracking-tight font-sans">
          Nenhuma Mensagem Ainda
        </h3>
        <p className="text-xs text-gray-400 mb-4 font-mono leading-relaxed max-w-xs">
          "{currentMeme.quote}"
        </p>

        {onOpenTools && (
          <button
            type="button"
            onClick={onOpenTools}
            className="px-4 py-2.5 bg-[#10b981]/15 hover:bg-[#10b981]/25 text-[#10b981] border border-[#10b981]/40 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Abrir Ferramentas do Lab</span>
          </button>
        )}
      </div>
    );
  }

  if (type === 'no_results') {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#161922] border border-[#2a3346] p-2.5 mb-3">
          <SvgComponent className="w-full h-full object-contain" />
        </div>
        <h4 className="text-xs font-bold text-gray-300 font-mono">
          Nenhum resultado encontrado
        </h4>
        <p className="text-[11px] text-gray-500 mt-1 max-w-xs font-mono">
          Nenhum caos localizado com esses termos de busca.
        </p>
      </div>
    );
  }

  // no_selection (Desktop Chat Splash Screen)
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 text-center bg-[#0d0f12] relative overflow-hidden">
      {/* Background Subtle Watermark Pattern */}
      <MemeBackground opacity={0.04} />

      {/* Cyber/Neon Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#a855f7]/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-[#39ff14]/10 blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/3 w-80 h-80 rounded-full bg-[#06b6d4]/10 blur-[120px] pointer-events-none" />

      {/* Floating Decorative Meme Cards around the central space on desktop */}
      {/* TOP LEFT: Trollface */}
      <div
        className="hidden xl:block absolute top-8 left-6 2xl:top-12 2xl:left-14 animate-float z-10"
        style={{ animationDelay: '0s' }}
      >
        <MemeSticker
          memeId="trollface"
          size="card"
          badge="TROLL // 2010"
          label="Problem, WhatsApp?"
          subtitle="Trollface Clássico • Laboratório sob controle"
          rotation="-rotate-3"
          onClick={() => handleSelectMemeById('trollface')}
        />
      </div>

      {/* MID LEFT: Forever Alone (on 2xl screens) */}
      <div
        className="hidden 2xl:block absolute top-1/2 -translate-y-1/2 left-8 animate-float z-10"
        style={{ animationDelay: '1.4s' }}
      >
        <MemeSticker
          memeId="foreveralone"
          size="card"
          badge="SOLITÁRIO"
          label="Forever Alone"
          subtitle="Mandou mensagem para o próprio número de teste"
          rotation="rotate-1"
          onClick={() => handleSelectMemeById('foreveralone')}
        />
      </div>

      {/* BOTTOM LEFT: Rage Guy (Status: 400 Bad Request) */}
      <div
        className="hidden xl:block absolute bottom-8 left-6 2xl:bottom-12 2xl:left-14 animate-float z-10"
        style={{ animationDelay: '2.1s' }}
      >
        <MemeSticker
          memeId="rageguy"
          size="card"
          badge="STATUS: 400"
          label="Status: 400 Bad Request"
          subtitle="Rage Guy (FFFUUU-) • Erro de conexão no WhatsApp"
          rotation="rotate-2"
          onClick={() => handleSelectMemeById('rageguy')}
        />
      </div>

      {/* TOP RIGHT: Deal With It (Deploy no WhatsApp) */}
      <div
        className="hidden xl:block absolute top-8 right-6 2xl:top-12 2xl:right-14 animate-float z-10"
        style={{ animationDelay: '0.7s' }}
      >
        <MemeSticker
          memeId="dealwithit"
          size="card"
          badge="DEPLOY_OK"
          label="Deploy no WhatsApp"
          subtitle="Deal With It • Se o payload funcionou, tá rodando"
          rotation="-rotate-2"
          onClick={() => handleSelectMemeById('dealwithit')}
        />
      </div>

      {/* MID RIGHT: Cereal Guy (on 2xl screens) */}
      <div
        className="hidden 2xl:block absolute top-1/2 -translate-y-1/2 right-8 animate-float z-10"
        style={{ animationDelay: '2.8s' }}
      >
        <MemeSticker
          memeId="cerealguy"
          size="card"
          badge="PAYLOAD"
          label="Cereal Guy"
          subtitle="Ele nunca vai conseguir revogar aquela mensagem..."
          rotation="-rotate-1"
          onClick={() => handleSelectMemeById('cerealguy')}
        />
      </div>

      {/* BOTTOM RIGHT: Challenge Accepted */}
      <div
        className="hidden xl:block absolute bottom-8 right-6 2xl:bottom-12 2xl:right-14 animate-float z-10"
        style={{ animationDelay: '1.8s' }}
      >
        <MemeSticker
          memeId="challengeaccepted"
          size="card"
          badge="DESAFIO"
          label="Challenge Accepted"
          subtitle="Desafio aceito • Testando botões e listas Zapo"
          rotation="rotate-3"
          onClick={() => handleSelectMemeById('challengeaccepted')}
        />
      </div>

      {/* Centerpiece Container */}
      <div className="relative z-20 flex flex-col items-center max-w-2xl w-full">
        {/* Large Interactive Meme Container */}
        <div
          onClick={handleNextMeme}
          style={{
            borderColor: `${currentMeme.color}99`,
            boxShadow: `0 0 40px -5px ${currentMeme.color}35`,
          }}
          className="w-36 h-36 sm:w-44 sm:h-44 rounded-3xl bg-[#161922] border-3 p-5 sm:p-6 mb-6 cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-2xl relative group"
          title="Clique para alternar o meme do laboratório!"
        >
          <SvgComponent className="w-full h-full object-contain filter drop-shadow group-hover:scale-110 group-hover:-rotate-3 transition-transform" />
          <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#39ff14] text-black text-[11px] font-mono font-black rounded-full shadow-lg flex items-center gap-1.5 whitespace-nowrap">
            <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform" />
            <span>RODAR MEME</span>
          </div>
        </div>

        {/* Central Terminal Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-[#1a202c] border border-[#2a3346] rounded-full text-xs font-mono text-[#39ff14] mb-3">
          <Terminal className="w-3.5 h-3.5" />
          <span>ZAPTROLL MEME LAB V2.0</span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-black font-mono text-white tracking-tight leading-tight">
          Laboratório de Testes & Trollagens
        </h2>

        {/* Interactive Humorous Quote Box */}
        <div className="mt-3.5 px-4 py-2.5 bg-[#161922]/90 border border-[#2a3346] rounded-2xl max-w-lg w-full text-center">
          <p className="text-xs sm:text-sm text-[#39ff14] font-mono leading-relaxed">
            "{LAB_QUOTES[quoteIndex]}"
          </p>
        </div>

        {/* 4 Quick Feature Cards Grid */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-2xl w-full text-left">
          <div
            onClick={onOpenTools}
            className="p-3.5 bg-[#161922] hover:bg-[#1c2230] rounded-2xl border border-[#2a3346] hover:border-[#39ff14]/50 flex items-start gap-2.5 transition cursor-pointer group shadow-sm"
          >
            <div className="w-9 h-9 rounded-xl bg-[#10b981]/15 text-[#39ff14] flex items-center justify-center shrink-0 border border-[#10b981]/30 group-hover:scale-105 transition-transform">
              <MousePointerClick className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold font-mono text-white">Botões do Caos</div>
              <div className="text-[10px] text-gray-400 font-mono mt-0.5">Respostas rápidas no chat</div>
            </div>
          </div>

          <div
            onClick={onOpenTools}
            className="p-3.5 bg-[#161922] hover:bg-[#1c2230] rounded-2xl border border-[#2a3346] hover:border-[#a855f7]/50 flex items-start gap-2.5 transition cursor-pointer group shadow-sm"
          >
            <div className="w-9 h-9 rounded-xl bg-[#a855f7]/15 text-[#a855f7] flex items-center justify-center shrink-0 border border-[#a855f7]/30 group-hover:scale-105 transition-transform">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold font-mono text-white">Carrosséis Zapo</div>
              <div className="text-[10px] text-gray-400 font-mono mt-0.5">Cartões multimídia deslizáveis</div>
            </div>
          </div>

          <div
            onClick={onOpenTools}
            className="p-3.5 bg-[#161922] hover:bg-[#1c2230] rounded-2xl border border-[#2a3346] hover:border-[#facc15]/50 flex items-start gap-2.5 transition cursor-pointer group shadow-sm"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-[#facc15] flex items-center justify-center shrink-0 border border-amber-500/30 group-hover:scale-105 transition-transform">
              <Ghost className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold font-mono text-white">Modo Fantasma</div>
              <div className="text-[10px] text-gray-400 font-mono mt-0.5">Mensagens com autodestruição</div>
            </div>
          </div>

          <div
            onClick={onOpenGallery || onOpenTools}
            className="p-3.5 bg-[#161922] hover:bg-[#1c2230] rounded-2xl border border-[#2a3346] hover:border-[#ec4899]/50 flex items-start gap-2.5 transition cursor-pointer group shadow-sm"
          >
            <div className="w-9 h-9 rounded-xl bg-pink-500/15 text-[#ec4899] flex items-center justify-center shrink-0 border border-pink-500/30 group-hover:scale-105 transition-transform">
              <Laugh className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold font-mono text-white">Galeria de Memes</div>
              <div className="text-[10px] text-gray-400 font-mono mt-0.5">Coleção de Rage Comics 2010</div>
            </div>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="mt-8 flex items-center gap-2 text-xs text-gray-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-[#39ff14] animate-pulse" />
          <span>Selecione uma conversa à esquerda ou crie uma sessão para começar.</span>
        </div>
      </div>
    </div>
  );
};
