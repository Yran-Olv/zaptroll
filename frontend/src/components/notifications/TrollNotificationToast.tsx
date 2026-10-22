import React, { useEffect, useState } from 'react';
import { Terminal, X, Radio, ArrowRight } from 'lucide-react';
import { TrollfaceSvg } from '../memes/memeVectors.js';
import { MemeAvatar } from '../memes/MemeAvatar.js';

export interface TrollNotification {
  id: string;
  senderName: string;
  senderJid: string;
  conversationId: string;
  messageText: string;
  timestamp: Date;
}

interface TrollNotificationToastProps {
  notification: TrollNotification | null;
  onClose: () => void;
  onOpenConversation: (conversationId: string) => void;
}

// Shared singleton AudioContext to prevent mobile browser audio engine exhaustion & freezes
let sharedAudioCtx: AudioContext | null = null;

export function playTrollSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }

    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }

    const ctx = sharedAudioCtx;
    const now = ctx.currentTime;

    // Dual-tone high-tech notification chirp
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.2);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.18); // D6
    gain2.gain.setValueAtTime(0.1, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.3);
  } catch (err) {
    // Ignore audio autoplay restrictions
  }
}

export const TrollNotificationToast: React.FC<TrollNotificationToastProps> = ({
  notification,
  onClose,
  onOpenConversation,
}) => {
  useEffect(() => {
    if (!notification) return;

    const timer = setTimeout(() => {
      onClose();
    }, 6000);

    return () => clearTimeout(timer);
  }, [notification?.id, onClose]);

  if (!notification) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 max-w-sm w-[calc(100vw-2rem)] animate-in slide-in-from-bottom-3 fade-in duration-300">
      <div
        onClick={() => onOpenConversation(notification.conversationId)}
        className="group relative bg-[#131722]/95 backdrop-blur-2xl border-2 border-[#39ff14] rounded-2xl shadow-[0_0_30px_rgba(57,255,20,0.35)] p-3.5 cursor-pointer overflow-hidden transition-all hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(57,255,20,0.5)]"
      >
        {/* Animated Cyber Accent Glow */}
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-[#39ff14]/20 rounded-full blur-xl pointer-events-none" />

        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            {/* Trollface Mini Icon */}
            <div className="w-5 h-5 rounded-lg bg-[#161922] border border-[#39ff14] p-0.5 flex items-center justify-center shrink-0">
              <TrollfaceSvg className="w-full h-full object-contain filter drop-shadow" />
            </div>

            <span className="text-[10px] font-mono font-black text-[#39ff14] tracking-wider uppercase">
              NOVO CAOS // TROLL ALERT
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#39ff14] animate-ping" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition"
              title="Fechar notificação"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex items-center gap-3">
          {/* Avatar with deterministic meme */}
          <MemeAvatar
            seed={notification.senderJid || notification.senderName}
            name={notification.senderName}
            size="md"
            glow={true}
          />

          <div className="flex-1 min-w-0 pr-1">
            <h4 className="text-xs font-bold font-mono text-white truncate group-hover:text-[#39ff14] transition-colors">
              {notification.senderName}
            </h4>
            <p className="text-[11px] font-sans text-gray-300 truncate mt-0.5 leading-snug">
              {notification.messageText || 'Nova mensagem recebida no laboratório'}
            </p>
          </div>

          <div className="shrink-0 text-gray-500 group-hover:text-[#39ff14] group-hover:translate-x-0.5 transition-all">
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        {/* Progress Bar Countdown at Bottom (pure CSS animation, 0 React re-renders) */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1a202c]">
          <div className="h-full bg-gradient-to-r from-[#10b981] to-[#39ff14] animate-toast-progress" />
        </div>
      </div>
    </div>
  );
};
