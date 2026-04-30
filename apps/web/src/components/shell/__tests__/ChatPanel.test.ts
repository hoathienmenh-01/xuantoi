import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { setActivePinia, createPinia } from 'pinia';
import type { ChatMessageView } from '@/api/chat';

/**
 * ChatPanel smoke tests (session 9j task L): cover tab switch (WORLD/SECT),
 * send flow (sending guard, success clears input, error map), realtime
 * `chat:msg` frame handling (WORLD + SECT scope-aware), empty state, sect
 * disabled when not in a sect. ChatPanel đụng user-generated content
 * nên submitting guard + scope filter rất quan trọng.
 */

const chatHistoryMock = vi.fn();
const chatSendWorldMock = vi.fn();
const chatSendSectMock = vi.fn();

vi.mock('@/api/chat', async () => {
  const actual = await vi.importActual<typeof import('@/api/chat')>('@/api/chat');
  return {
    ...actual,
    chatHistory: (...a: unknown[]) => chatHistoryMock(...a),
    chatSendWorld: (...a: unknown[]) => chatSendWorldMock(...a),
    chatSendSect: (...a: unknown[]) => chatSendSectMock(...a),
  };
});

type WsHandler = (frame: { payload: unknown }) => void;
const wsHandlers: Record<string, WsHandler[]> = {};
const onMock = vi.fn((type: string, fn: WsHandler) => {
  if (!wsHandlers[type]) wsHandlers[type] = [];
  wsHandlers[type].push(fn);
  return () => {
    wsHandlers[type] = (wsHandlers[type] ?? []).filter((h) => h !== fn);
  };
});
vi.mock('@/ws/client', () => ({
  on: (type: string, fn: WsHandler) => onMock(type, fn),
}));

const toastPushMock = vi.fn();
vi.mock('@/stores/toast', () => ({
  useToastStore: () => ({ push: toastPushMock }),
}));

const gameState: { character: { sectId: string | null } | null } = {
  character: { sectId: 'sect-a' },
};
vi.mock('@/stores/game', () => ({
  useGameStore: () => ({
    get character() {
      return gameState.character;
    },
  }),
}));

import ChatPanel from '@/components/shell/ChatPanel.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    vi: {
      chat: {
        title: 'Thế giới - Tông môn',
        tab: { world: 'Thế giới', sect: 'Tông môn' },
        empty: 'Chưa có tin',
        noSect: 'Chưa nhập tông môn',
        noSectShort: 'Chưa có tông môn',
        placeholder: { world: 'Gõ...', sect: 'Gõ trong tông...' },
        send: 'Gửi',
        errors: {
          RATE_LIMIT: 'Gõ chậm thôi',
          FORBIDDEN: 'Không được phép',
          UNKNOWN: 'Lỗi không rõ',
        },
      },
    },
  },
});

function makeMsg(overrides: Partial<ChatMessageView> = {}): ChatMessageView {
  return {
    id: 'm1',
    channel: 'WORLD',
    scopeKey: 'WORLD',
    senderId: 'u1',
    senderName: 'Alice',
    text: 'hello',
    createdAt: '2026-04-30T08:00:00Z',
    ...overrides,
  };
}

function mountPanel() {
  return mount(ChatPanel, { global: { plugins: [i18n] } });
}

beforeEach(() => {
  setActivePinia(createPinia());
  chatHistoryMock.mockReset();
  chatSendWorldMock.mockReset();
  chatSendSectMock.mockReset();
  toastPushMock.mockReset();
  onMock.mockClear();
  for (const k of Object.keys(wsHandlers)) delete wsHandlers[k];
  gameState.character = { sectId: 'sect-a' };
});

describe('ChatPanel — onMounted load + WS register', () => {
  it('load WORLD history + đăng ký chat:msg', async () => {
    chatHistoryMock.mockResolvedValue([makeMsg({ text: 'hi' })]);
    const w = mountPanel();
    await flushPromises();
    expect(chatHistoryMock).toHaveBeenCalledWith('WORLD');
    expect(w.text()).toContain('hi');
    expect(onMock).toHaveBeenCalledWith('chat:msg', expect.any(Function));
  });

  it('chatHistory throw → silent fail + empty state', async () => {
    chatHistoryMock.mockRejectedValue(new Error('net'));
    const w = mountPanel();
    await flushPromises();
    expect(w.text()).toContain('Chưa có tin');
  });
});

describe('ChatPanel — tab switch', () => {
  it('switch sang SECT (có tông môn) → load SECT history', async () => {
    chatHistoryMock.mockResolvedValue([]);
    const w = mountPanel();
    await flushPromises();
    chatHistoryMock.mockResolvedValue([makeMsg({ channel: 'SECT', text: 'sect-hi' })]);
    const sectBtn = w.findAll('button').find((b) => b.text() === 'Tông môn');
    await sectBtn!.trigger('click');
    await flushPromises();
    expect(chatHistoryMock).toHaveBeenCalledWith('SECT');
    expect(w.text()).toContain('sect-hi');
  });

  it('không có tông môn → nút SECT disabled', async () => {
    gameState.character = { sectId: null };
    chatHistoryMock.mockResolvedValue([]);
    const w = mountPanel();
    await flushPromises();
    const sectBtn = w.findAll('button').find((b) => b.text() === 'Tông môn');
    expect(sectBtn!.attributes('disabled')).toBeDefined();
  });
});

describe('ChatPanel — send flow', () => {
  beforeEach(() => {
    chatHistoryMock.mockResolvedValue([]);
  });

  it('send WORLD success → clear input', async () => {
    chatSendWorldMock.mockResolvedValue(makeMsg());
    const w = mountPanel();
    await flushPromises();
    const input = w.find('input');
    await input.setValue('hello');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(chatSendWorldMock).toHaveBeenCalledWith('hello');
    expect((input.element as HTMLInputElement).value).toBe('');
  });

  it('text rỗng/whitespace → không gọi send', async () => {
    const w = mountPanel();
    await flushPromises();
    await w.find('input').setValue('   ');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(chatSendWorldMock).not.toHaveBeenCalled();
  });

  it('sending guard: 2 submit trong lúc pending → 1 call', async () => {
    const resolveHolder: { current: ((v: ChatMessageView) => void) | null } = {
      current: null,
    };
    chatSendWorldMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveHolder.current = resolve;
        }),
    );
    const w = mountPanel();
    await flushPromises();
    await w.find('input').setValue('a');
    await w.find('form').trigger('submit');
    await flushPromises();
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(chatSendWorldMock).toHaveBeenCalledTimes(1);
    resolveHolder.current?.(makeMsg());
  });

  it('error RATE_LIMIT → toast mapped', async () => {
    chatSendWorldMock.mockRejectedValue(
      Object.assign(new Error('x'), { code: 'RATE_LIMIT' }),
    );
    const w = mountPanel();
    await flushPromises();
    await w.find('input').setValue('x');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Gõ chậm thôi',
    });
  });

  it('error code lạ → fallback UNKNOWN', async () => {
    chatSendWorldMock.mockRejectedValue(
      Object.assign(new Error('x'), { code: 'VOID' }),
    );
    const w = mountPanel();
    await flushPromises();
    await w.find('input').setValue('x');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Lỗi không rõ',
    });
  });
});

describe('ChatPanel — realtime chat:msg frame', () => {
  beforeEach(() => {
    chatHistoryMock.mockResolvedValue([]);
  });

  it('WORLD frame → append vào worldMsgs', async () => {
    const w = mountPanel();
    await flushPromises();
    const handlers = wsHandlers['chat:msg'] ?? [];
    for (const h of handlers) {
      h({ payload: makeMsg({ text: 'realtime-world' }) });
    }
    await flushPromises();
    expect(w.text()).toContain('realtime-world');
  });

  it('SECT frame sai scopeKey → KHÔNG append (scope filter)', async () => {
    const w = mountPanel();
    await flushPromises();
    // Switch to SECT tab first
    const sectBtn = w.findAll('button').find((b) => b.text() === 'Tông môn');
    await sectBtn!.trigger('click');
    await flushPromises();

    const handlers = wsHandlers['chat:msg'] ?? [];
    for (const h of handlers) {
      h({
        payload: makeMsg({
          channel: 'SECT',
          scopeKey: 'other-sect',
          text: 'leak',
        }),
      });
    }
    await flushPromises();
    expect(w.text()).not.toContain('leak');
  });

  it('SECT frame đúng scopeKey → append', async () => {
    const w = mountPanel();
    await flushPromises();
    const sectBtn = w.findAll('button').find((b) => b.text() === 'Tông môn');
    await sectBtn!.trigger('click');
    await flushPromises();

    const handlers = wsHandlers['chat:msg'] ?? [];
    for (const h of handlers) {
      h({
        payload: makeMsg({
          channel: 'SECT',
          scopeKey: 'sect-a',
          text: 'my-sect-msg',
        }),
      });
    }
    await flushPromises();
    expect(w.text()).toContain('my-sect-msg');
  });
});
