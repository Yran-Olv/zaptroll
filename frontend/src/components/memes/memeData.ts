import React from 'react';
import {
  TrollfaceSvg,
  MeGustaSvg,
  RageGuySvg,
  ForeverAloneSvg,
  LolFaceSvg,
  YunoGuySvg,
  ChallengeAcceptedSvg,
  DerpSvg,
  DerpinaSvg,
  WojakSvg,
  CerealGuySvg,
  DealWithItSvg,
  MemeSvgProps,
} from './memeVectors.js';

export interface MemeItem {
  id: string;
  name: string;
  category: 'trollface' | 'rage' | 'reactions' | 'caos' | 'classicos' | 'aleatorios';
  quote: string;
  component: React.FC<MemeSvgProps>;
  color: string;
  accentBg: string;
}

export const MEME_CATALOG: MemeItem[] = [
  {
    id: 'trollface',
    name: 'Trollface Clássico',
    category: 'trollface',
    quote: 'Problem, WhatsApp?',
    component: TrollfaceSvg,
    color: '#39ff14', // Lime
    accentBg: 'rgba(57, 255, 20, 0.12)',
  },
  {
    id: 'dealwithit',
    name: 'Deal With It',
    category: 'trollface',
    quote: 'Se o payload funcionou, Deal With It.',
    component: DealWithItSvg,
    color: '#38bdf8', // Cyan
    accentBg: 'rgba(56, 189, 248, 0.12)',
  },
  {
    id: 'megusta',
    name: 'Me Gusta',
    category: 'reactions',
    quote: 'Me gusta este botão interativo.',
    component: MeGustaSvg,
    color: '#a855f7', // Purple
    accentBg: 'rgba(168, 85, 247, 0.12)',
  },
  {
    id: 'rageguy',
    name: 'Rage Guy (FFFUUU-)',
    category: 'rage',
    quote: 'QUANDO A CONEXÃO CAI NO MEIO DO TESTE!',
    component: RageGuySvg,
    color: '#ef4444', // Red
    accentBg: 'rgba(239, 68, 68, 0.12)',
  },
  {
    id: 'foreveralone',
    name: 'Forever Alone',
    category: 'classicos',
    quote: 'Mandou mensagem para o próprio número.',
    component: ForeverAloneSvg,
    color: '#64748b', // Slate
    accentBg: 'rgba(100, 116, 139, 0.12)',
  },
  {
    id: 'lolface',
    name: 'LOL Face',
    category: 'reactions',
    quote: 'Trollei o grupo da família com carrossel.',
    component: LolFaceSvg,
    color: '#f59e0b', // Amber
    accentBg: 'rgba(245, 158, 11, 0.12)',
  },
  {
    id: 'yunoguy',
    name: 'Y U NO Guy',
    category: 'caos',
    quote: 'Y U NO CLICAR NO BOTÃO?',
    component: YunoGuySvg,
    color: '#ec4899', // Pink
    accentBg: 'rgba(236, 72, 153, 0.12)',
  },
  {
    id: 'challengeaccepted',
    name: 'Challenge Accepted',
    category: 'classicos',
    quote: 'Disse que o WhatsApp não suporta webview? Desafio aceito.',
    component: ChallengeAcceptedSvg,
    color: '#10b981', // Emerald
    accentBg: 'rgba(16, 185, 129, 0.12)',
  },
  {
    id: 'derp',
    name: 'Derp',
    category: 'aleatorios',
    quote: 'Aqui o bug é uma feature documentada.',
    component: DerpSvg,
    color: '#8b5cf6', // Indigo
    accentBg: 'rgba(139, 92, 246, 0.12)',
  },
  {
    id: 'derpina',
    name: 'Derpina',
    category: 'aleatorios',
    quote: 'Testando botões com estilo e glamour.',
    component: DerpinaSvg,
    color: '#f43f5e', // Rose
    accentBg: 'rgba(244, 63, 94, 0.12)',
  },
  {
    id: 'wojak',
    name: 'Wojak (Feels Guy)',
    category: 'reactions',
    quote: 'Eu só queria um webhook que respondesse em 200 OK...',
    component: WojakSvg,
    color: '#94a3b8', // Gray
    accentBg: 'rgba(148, 163, 184, 0.12)',
  },
  {
    id: 'cerealguy',
    name: 'Cereal Guy',
    category: 'caos',
    quote: 'Ele nunca vai conseguir revogar aquela mensagem...',
    component: CerealGuySvg,
    color: '#facc15', // Yellow
    accentBg: 'rgba(250, 204, 21, 0.12)',
  },
];

// Helper to retrieve meme by ID (or default to Trollface)
export const getMemeById = (id: string): MemeItem => {
  return MEME_CATALOG.find((m) => m.id === id) || MEME_CATALOG[0];
};

// Deterministic meme selector based on string (e.g., contact name or JID)
export const getDeterministicMeme = (seed: string): MemeItem => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % MEME_CATALOG.length;
  return MEME_CATALOG[index];
};

// Random meme selector
export const getRandomMeme = (category?: string): MemeItem => {
  const filtered = category
    ? MEME_CATALOG.filter((m) => m.category === category)
    : MEME_CATALOG;
  const list = filtered.length > 0 ? filtered : MEME_CATALOG;
  return list[Math.floor(Math.random() * list.length)];
};

// Humorous quotes for loading & login
export const LAB_QUOTES = [
  'Entrou no laboratório. Não nos responsabilizamos pelas risadas.',
  'Seu próximo teste pode ser uma péssima ideia.',
  'Conecte seu WhatsApp e libere o caos.',
  'Aqui o bug pode ser uma feature.',
  'Com grandes poderes vêm grandes trollagens.',
  'Problem, WhatsApp?',
  'Carregando 9999 trollagens por segundo...',
  'Preparando a próxima péssima ideia...',
  'O laboratório está quase sob controle.',
  'Nenhum caos encontrado. Por enquanto.',
  'Payload carregado. Que os testes comecem.',
  'Você clicou. Agora teste com responsabilidade.',
];
