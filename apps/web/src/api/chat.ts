import { apiClient } from './client';

export type ChatChannel = 'WORLD' | 'SECT';

export interface ChatMessageView {
  id: string;
  channel: ChatChannel;
  scopeKey: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

function unwrap<T>(env: Envelope<T>): T {
  if (!env.ok || !env.data) {
    const err = env.error ?? { code: 'UNKNOWN', message: 'UNKNOWN' };
    throw Object.assign(new Error(err.message), { code: err.code });
  }
  return env.data;
}

export async function chatHistory(channel: ChatChannel): Promise<ChatMessageView[]> {
  const { data } = await apiClient.get<Envelope<{ messages: ChatMessageView[] }>>(
    '/chat/history',
    { params: { channel } },
  );
  return unwrap(data).messages;
}

export async function chatSendWorld(text: string): Promise<ChatMessageView> {
  const { data } = await apiClient.post<Envelope<{ message: ChatMessageView }>>(
    '/chat/world',
    { text },
  );
  return unwrap(data).message;
}

export async function chatSendSect(text: string): Promise<ChatMessageView> {
  const { data } = await apiClient.post<Envelope<{ message: ChatMessageView }>>(
    '/chat/sect',
    { text },
  );
  return unwrap(data).message;
}
