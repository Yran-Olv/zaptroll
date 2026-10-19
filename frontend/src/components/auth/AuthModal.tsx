import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.js';
import {
  Terminal,
  Shield,
  Sparkles,
  AlertCircle,
  FlaskConical,
  Mail,
  KeyRound,
  User,
  ArrowRight,
  Flame,
} from 'lucide-react';
import { TrollfaceSvg } from '../memes/memeVectors.js';
import { MemeSticker } from '../memes/MemeSticker.js';
import { MemeBackground } from '../memes/MemeBackground.js';
import { LAB_QUOTES } from '../memes/memeData.js';

export const AuthModal: React.FC = () => {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % LAB_QUOTES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erro ao processar solicitação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b0e14] overflow-y-auto">
      {/* Background Subtle Watermark Pattern */}
      <MemeBackground opacity={0.06} />

      {/* Cyber/Neon Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#a855f7]/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-[#39ff14]/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-[#ec4899]/10 blur-[100px] pointer-events-none" />

      {/* Floating Decorative Meme Cards (Enlarged and Prominent for Computers) */}
      <div className="hidden lg:block absolute top-10 left-8 xl:left-20 2xl:left-32 animate-float z-10">
        <MemeSticker
          memeId="trollface"
          size="card"
          badge="MEME // 2010"
          label="Problem, WhatsApp?"
          subtitle="Trollface Clássico • 9999 testes iniciados no laboratório"
          rotation="-rotate-3"
        />
      </div>

      <div className="hidden lg:block absolute bottom-10 left-8 xl:left-20 2xl:left-32 animate-float z-10" style={{ animationDelay: '1.5s' }}>
        <MemeSticker
          memeId="megusta"
          size="card"
          badge="INTERATIVIDADE"
          label="Me Gusta Payloads"
          subtitle="Botões do Caos, Listas & Menus prontos para envio"
          rotation="rotate-3"
        />
      </div>

      <div className="hidden lg:block absolute top-10 right-8 xl:right-20 2xl:right-32 animate-float z-10" style={{ animationDelay: '0.8s' }}>
        <MemeSticker
          memeId="rageguy"
          size="card"
          badge="STATUS: 400"
          label="Status: 400 Bad Request"
          subtitle="Rage Guy (FFFUUU-) • Erro de conexão no WhatsApp"
          rotation="rotate-2"
        />
      </div>

      <div className="hidden lg:block absolute bottom-10 right-8 xl:right-20 2xl:right-32 animate-float z-10" style={{ animationDelay: '2.2s' }}>
        <MemeSticker
          memeId="dealwithit"
          size="card"
          badge="DEPLOY_OK"
          label="Deploy no WhatsApp"
          subtitle="Deal With It • Se o payload funcionou, tá rodando"
          rotation="-rotate-2"
        />
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-[#131722]/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-[#2a3346] overflow-hidden relative z-20 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="p-6 pb-5 text-center relative border-b border-[#2a3346] bg-gradient-to-b from-[#1a202c]/80 to-transparent">
          {/* Logo Badge */}
          <div className="relative inline-block mb-3">
            <div className="w-16 h-16 mx-auto bg-[#161922] rounded-2xl border-2 border-[#39ff14] flex items-center justify-center p-2.5 shadow-[0_0_20px_rgba(57,255,20,0.35)] transition-transform hover:scale-105">
              <TrollfaceSvg className="w-full h-full object-contain filter drop-shadow" />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#39ff14] rounded-full animate-ping" />
          </div>

          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white font-mono">
              ZAPTROLL
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-[#a855f7]/20 border border-[#a855f7]/40 text-[#a855f7] text-[10px] font-mono font-bold">
              MEME LAB
            </span>
          </div>

          <p className="text-xs text-gray-300 font-mono mt-1">
            Laboratório de Testes & Trollagens do WhatsApp
          </p>

          {/* Random Humorous Phrase Banner */}
          <div className="mt-3.5 px-3 py-1.5 rounded-xl bg-[#1a202c] border border-white/5 text-[11px] font-mono text-[#39ff14] flex items-center justify-center gap-2 min-h-[34px]">
            <Terminal className="w-3.5 h-3.5 shrink-0 text-[#39ff14]" />
            <span className="truncate">{LAB_QUOTES[quoteIndex]}</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#2a3346] bg-[#0d0f14]/80 p-1 m-4 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-mono font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              isLogin
                ? 'bg-[#1a202c] text-white border border-[#2a3346] shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Entrar no Lab</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-mono font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              !isLogin
                ? 'bg-[#1a202c] text-white border border-[#2a3346] shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Criar Acesso Grátis</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mb-2 p-3 bg-red-950/40 border border-red-500/50 rounded-xl flex items-center gap-2.5 text-xs text-red-200 font-mono">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 pt-1 space-y-3.5">
          {!isLogin && (
            <div>
              <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider mb-1">
                Nome de Cientista / Troll
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Mestre dos Memes"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#39ff14] focus:ring-1 focus:ring-[#39ff14] transition font-mono"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider mb-1">
              E-mail de Acesso
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@laboratorio.com"
                className="w-full pl-10 pr-4 py-2.5 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#39ff14] focus:ring-1 focus:ring-[#39ff14] transition font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider mb-1">
              Senha Secreta
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo de 6 caracteres"
                className="w-full pl-10 pr-4 py-2.5 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#39ff14] focus:ring-1 focus:ring-[#39ff14] transition font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#39ff14] hover:bg-[#32e012] text-black font-black font-mono rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-[#39ff14]/25 disabled:opacity-50 mt-4 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{isLogin ? 'Conectar ao Laboratório' : 'Iniciar Experimento Grátis'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="pt-2 flex items-center justify-between text-[10px] text-gray-400 font-mono">
            <span className="flex items-center gap-1 text-emerald-400">
              <Shield className="w-3.5 h-3.5" />
              Sessões WhatsApp Isoladas
            </span>
            <span className="flex items-center gap-1 text-purple-400">
              <FlaskConical className="w-3.5 h-3.5" />
              Motor Zapo Integrado
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};
