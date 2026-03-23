export type StoryReplyPayload = {
  v: 1;
  storyId: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  ownerUsername?: string;
  text: string;
};

const PREFIX = '__STORY_REPLY_V1__';
const LEGACY_PREFIX = '📷 Respondeu ao seu story:';

const encode = (value: string) => {
  try {
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      return window.btoa(encodeURIComponent(value));
    }
  } catch {
    // no-op
  }
  return '';
};

const decode = (value: string) => {
  try {
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      return decodeURIComponent(window.atob(value));
    }
  } catch {
    // no-op
  }
  return null;
};

export const serializeStoryReplyMessage = (payload: StoryReplyPayload) => (
  `${PREFIX}${encode(JSON.stringify(payload))}`
);

export const parseStoryReplyMessage = (content: string): StoryReplyPayload | null => {
  if (!content) return null;
  if (!content.startsWith(PREFIX)) return null;

  const raw = content.slice(PREFIX.length);
  const decoded = decode(raw);
  if (!decoded) return null;

  try {
    const parsed = JSON.parse(decoded) as StoryReplyPayload;
    if (
      parsed?.v === 1 &&
      parsed.storyId &&
      parsed.mediaUrl &&
      (parsed.mediaType === 'image' || parsed.mediaType === 'video')
    ) {
      return parsed;
    }
  } catch {
    // no-op
  }
  return null;
};

export const getConversationPreviewText = (content: string) => {
  const payload = parseStoryReplyMessage(content);
  if (payload) {
    return `📷 Respondeu ao story: ${payload.text}`;
  }

  if (content.startsWith(LEGACY_PREFIX)) {
    return content;
  }

  return content;
};
