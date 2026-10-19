/**
 * ViewOnceInterceptor
 * Intercepts, recursively unwraps, and extracts single-view / view-once WhatsApp media.
 * Ensures view-once images, videos, and voice notes can be permanently downloaded,
 * preserved, and displayed with distinct metadata.
 */

export interface ExtractedMessageContent {
  unwrappedMsg: any;
  isViewOnce: boolean;
  isEphemeral: boolean;
  mediaType: 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'buttons' | 'list' | 'carousel' | 'interactive' | 'text';
  hasMedia: boolean;
  mediaPayload: any;
  caption: string | null;
  mimetype: string | null;
  fileName: string | null;
}

export function extractMessageContent(rawMessage: any): ExtractedMessageContent {
  let msg = rawMessage;
  let isViewOnce = false;
  let isEphemeral = false;

  if (!msg || typeof msg !== 'object') {
    return {
      unwrappedMsg: msg,
      isViewOnce: false,
      isEphemeral: false,
      mediaType: 'text',
      hasMedia: false,
      mediaPayload: null,
      caption: null,
      mimetype: null,
      fileName: null,
    };
  }

  // Recursively traverse wrapper envelopes up to 10 levels deep
  for (let depth = 0; depth < 10; depth++) {
    if (msg.ephemeralMessage?.message) {
      isEphemeral = true;
      msg = msg.ephemeralMessage.message;
      continue;
    }
    if (msg.viewOnceMessage?.message) {
      isViewOnce = true;
      msg = msg.viewOnceMessage.message;
      continue;
    }
    if (msg.viewOnceMessageV2?.message) {
      isViewOnce = true;
      msg = msg.viewOnceMessageV2.message;
      continue;
    }
    if (msg.viewOnceMessageV2Extension?.message) {
      isViewOnce = true;
      msg = msg.viewOnceMessageV2Extension.message;
      continue;
    }
    if (msg.documentWithCaptionMessage?.message) {
      msg = msg.documentWithCaptionMessage.message;
      continue;
    }
    if (msg.groupMentionedMessage?.message) {
      msg = msg.groupMentionedMessage.message;
      continue;
    }
    if (msg.botInvokeMessage?.message) {
      msg = msg.botInvokeMessage.message;
      continue;
    }
    if (msg.deviceSentMessage?.message) {
      msg = msg.deviceSentMessage.message;
      continue;
    }
    if (msg.botForwardedMessage?.message) {
      msg = msg.botForwardedMessage.message;
      continue;
    }
    break;
  }

  const img = msg?.imageMessage;
  const vid = msg?.videoMessage;
  const ptv = msg?.ptvMessage;
  const aud = msg?.audioMessage;
  const doc = msg?.documentMessage;
  const stk = msg?.stickerMessage;

  // Check if viewOnce flag is set directly on media structures
  if (
    img?.viewOnce ||
    vid?.viewOnce ||
    ptv?.viewOnce ||
    aud?.viewOnce ||
    Boolean(msg?.viewOnce)
  ) {
    isViewOnce = true;
  }

  let mediaType: ExtractedMessageContent['mediaType'] = 'text';
  let hasMedia = false;
  let mediaPayload: any = null;
  let caption: string | null = null;
  let mimetype: string | null = null;
  let fileName: string | null = null;

  if (img) {
    mediaType = 'image';
    hasMedia = true;
    mediaPayload = img;
    caption = img.caption || null;
    mimetype = img.mimetype || 'image/jpeg';
  } else if (vid || ptv) {
    mediaType = 'video';
    hasMedia = true;
    mediaPayload = vid || ptv;
    caption = (vid || ptv).caption || null;
    mimetype = (vid || ptv).mimetype || 'video/mp4';
  } else if (aud) {
    mediaType = 'audio';
    hasMedia = true;
    mediaPayload = aud;
    mimetype = aud.mimetype || 'audio/ogg';
  } else if (doc) {
    mediaType = 'document';
    hasMedia = true;
    mediaPayload = doc;
    caption = doc.caption || null;
    fileName = doc.fileName || null;
    mimetype = doc.mimetype || 'application/octet-stream';
  } else if (stk) {
    mediaType = 'sticker';
    hasMedia = true;
    mediaPayload = stk;
    mimetype = stk.mimetype || 'image/webp';
  } else if (msg?.buttonsMessage) {
    mediaType = 'buttons';
  } else if (msg?.listMessage) {
    mediaType = 'list';
  } else if (msg?.interactiveMessage?.carouselMessage) {
    mediaType = 'carousel';
  } else if (msg?.interactiveMessage) {
    mediaType = 'interactive';
  }

  return {
    unwrappedMsg: msg,
    isViewOnce,
    isEphemeral,
    mediaType,
    hasMedia,
    mediaPayload,
    caption,
    mimetype,
    fileName,
  };
}
