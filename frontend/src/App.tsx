import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext.js';
import { SocketProvider } from './contexts/SocketContext.js';
import { AuthModal } from './components/auth/AuthModal.js';
import { MainLayout } from './components/layout/MainLayout.js';
import { TrollfaceSvg } from './components/memes/memeVectors.js';
import { LAB_QUOTES } from './components/memes/memeData.js';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [loadingQuote, setLoadingQuote] = useState(LAB_QUOTES[0]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingQuote(LAB_QUOTES[Math.floor(Math.random() * LAB_QUOTES.length)]);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#0b0e14] p-6 text-center">
        {/* Pulsing Trollface */}
        <div className="relative mb-5">
          <div className="w-20 h-20 rounded-3xl bg-[#161922] border-2 border-[#39ff14] flex items-center justify-center shadow-[0_0_30px_rgba(57,255,20,0.3)] animate-pulse p-3">
            <TrollfaceSvg className="w-full h-full object-contain filter drop-shadow" />
          </div>
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#39ff14] animate-ping" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#161922] border border-white/10 text-[11px] font-mono text-[#39ff14] mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14]" />
          <span>ZAPTROLL MEME LAB // INICIALIZANDO</span>
        </div>

        <div className="w-7 h-7 border-2 border-[#39ff14] border-t-transparent rounded-full animate-spin my-2" />

        <p className="text-xs text-gray-400 font-mono mt-3 max-w-xs transition-opacity duration-300">
          "{loadingQuote}"
        </p>
      </div>
    );
  }

  if (!user) {
    return <AuthModal />;
  }

  return (
    <SocketProvider>
      <MainLayout />
    </SocketProvider>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
