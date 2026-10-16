export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'suspended';
  maxConnections: number;
  rateLimit: number;
}

export interface WhatsAppConnection {
  id: string;
  userId: string;
  name: string;
  sessionId: string;
  status: 'disconnected' | 'connecting' | 'awaiting_auth' | 'connected' | 'error';
  phoneNumber: string | null;
  qrCode: string | null;
  pairingCode: string | null;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  lastError: string | null;
}

export interface Conversation {
  id: string;
  connectionId: string;
  jid: string;
  chatType: 'direct' | 'group' | 'newsletter';
  name: string | null;
  unreadCount: number;
  lastMessageText: string | null;
  lastMessageTimestamp: string | null;
  profilePicUrl?: string | null;
}

export interface ContactProfile {
  name: string;
  phoneNumber?: string | null;
  jid: string;
  phoneJid?: string | null;
  lid?: string | null;
  profilePicUrl?: string | null;
  previewUrl?: string | null;
  about?: string | null;
}

export interface Message {
  id: string;
  connectionId: string;
  conversationId: string;
  stanzaId: string;
  senderJid: string;
  remoteJid?: string | null;
  fromMe: boolean;
  messageType: string;
  content: string | null;
  caption?: string | null;
  mediaUrl?: string | null;
  mediaMimetype?: string | null;
  mediaFilename?: string | null;
  thumbnailUrl?: string | null;
  rawPayload: any;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'revoked';
  timestamp: string;
  isRevoked: boolean;
  participant?: string | null;
}

export interface Contact {
  id: string;
  connectionId: string;
  jid: string;
  phoneNumber: string | null;
  name: string | null;
  notifyName: string | null;
  profilePicUrl: string | null;
}

export interface Group {
  id: string;
  connectionId: string;
  jid: string;
  name: string;
  description: string | null;
  participantCount: number;
}

export interface MessageTemplate {
  id: string;
  name: string;
  category: 'buttons' | 'list' | 'carousel' | 'webview' | 'raw' | 'ephemeral';
  payload: any;
}

export interface CarouselButton {
  type: 'cta_url' | 'quick_reply' | 'cta_call' | 'cta_copy';
  displayText: string;
  url?: string;
  id?: string;
  phoneNumber?: string;
  code?: string;
}

export interface CarouselCard {
  id: string;
  title: string;
  text: string;
  imageUrl?: string;
  buttons: CarouselButton[];
}
