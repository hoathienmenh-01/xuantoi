import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { setActivePinia, createPinia } from 'pinia';

/**
 * ProfileView skeleton/smoke tests (session 9i task K2): cover các nhánh
 * onMounted (chưa auth → /auth, route param thiếu → notFound, có id → load),
 * load() success/notFound, watch route.params.id (navigate sang user khác),
 * và render branches (skeleton/notFound/profile + role badge + sect optional).
 *
 * Pattern: mock @/api/character.getPublicProfile, vue-router (useRoute +
 * useRouter), 2 stores, AppShell + SkeletonBlock stub.
 */

const getPublicProfileMock = vi.fn();
vi.mock('@/api/character', () => ({
  getPublicProfile: (...a: unknown[]) => getPublicProfileMock(...a),
}));

const routerReplaceMock = vi.fn();
const routeParamsState: { id: string } = { id: 'u1' };
vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: routerReplaceMock }),
  useRoute: () => ({ params: routeParamsState }),
}));

const authState = {
  isAuthenticated: true,
  hydrate: vi.fn().mockResolvedValue(undefined),
};
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authState,
}));

const gameState = {
  bindSocket: vi.fn(),
  fetchState: vi.fn().mockResolvedValue(undefined),
};
vi.mock('@/stores/game', () => ({
  useGameStore: () => gameState,
}));

vi.mock('@/components/shell/AppShell.vue', () => ({
  default: {
    name: 'AppShellStub',
    template: '<div data-testid="app-shell-stub"><slot /></div>',
  },
}));
vi.mock('@/components/ui/SkeletonBlock.vue', () => ({
  default: {
    name: 'SkeletonBlockStub',
    template: '<div data-testid="skeleton-block-stub" />',
  },
}));

vi.mock('@xuantoi/shared', () => ({
  fullRealmName: (r: { display: string }, stage: number) => `${r.display} ${stage}`,
  realmByKey: (k: string) => (k === 'luyen_khi' ? { display: 'Luyện Khí' } : null),
}));

import ProfileView from '@/views/ProfileView.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    vi: {
      profile: {
        title: 'Hồ sơ tu sĩ',
        notFound: 'Không tìm thấy tu sĩ này.',
        sect: 'Tông môn',
        joinedAt: 'Nhập đạo',
        stats: 'Thuộc tính',
        power: 'Lực',
        spirit: 'Linh',
        speed: 'Tốc',
        luck: 'May',
      },
    },
  },
});

interface FakeProfile {
  name: string;
  level: number;
  realmKey: string;
  realmStage: number;
  role: 'PLAYER' | 'ADMIN' | 'MOD';
  sectName: string | null;
  createdAt: string;
  power: number;
  spirit: number;
  speed: number;
  luck: number;
}

function buildProfile(overrides: Partial<FakeProfile> = {}): FakeProfile {
  return {
    name: 'Tiêu Viêm',
    level: 12,
    realmKey: 'luyen_khi',
    realmStage: 3,
    role: 'PLAYER',
    sectName: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    power: 10,
    spirit: 8,
    speed: 6,
    luck: 4,
    ...overrides,
  };
}

let wrapper: ReturnType<typeof mount> | null = null;

function mountView() {
  wrapper = mount(ProfileView, {
    attachTo: document.body,
    global: { plugins: [i18n] },
  });
  return wrapper;
}

describe('ProfileView — onMounted routing', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    authState.isAuthenticated = true;
    authState.hydrate = vi.fn().mockResolvedValue(undefined);
    gameState.bindSocket = vi.fn();
    gameState.fetchState = vi.fn().mockResolvedValue(undefined);
    routeParamsState.id = 'u1';
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
  });

  it('chưa auth ⇒ router.replace("/auth") + KHÔNG load profile', async () => {
    authState.isAuthenticated = false;
    mountView();
    await flushPromises();
    expect(routerReplaceMock).toHaveBeenCalledWith('/auth');
    expect(getPublicProfileMock).not.toHaveBeenCalled();
  });

  it('route param id rỗng ⇒ notFound state, KHÔNG gọi getPublicProfile', async () => {
    routeParamsState.id = '';
    mountView();
    await flushPromises();
    expect(getPublicProfileMock).not.toHaveBeenCalled();
    expect(wrapper?.text()).toContain('Không tìm thấy tu sĩ này.');
  });

  it('có id và profile tồn tại ⇒ render header + name + realm + level', async () => {
    getPublicProfileMock.mockResolvedValue(buildProfile({ name: 'Hàn Lập' }));
    const w = mountView();
    await flushPromises();
    expect(getPublicProfileMock).toHaveBeenCalledWith('u1');
    expect(w.text()).toContain('Hàn Lập');
    expect(w.text()).toContain('Luyện Khí 3');
    expect(w.text()).toContain('Lv.12');
  });

  it('có id nhưng profile null (404) ⇒ render notFound message', async () => {
    getPublicProfileMock.mockResolvedValue(null);
    const w = mountView();
    await flushPromises();
    expect(w.text()).toContain('Không tìm thấy tu sĩ này.');
  });

  it('fetchState throw ⇒ KHÔNG crash, vẫn load profile', async () => {
    gameState.fetchState = vi.fn().mockRejectedValue(new Error('socket down'));
    getPublicProfileMock.mockResolvedValue(buildProfile());
    const w = mountView();
    await flushPromises();
    expect(getPublicProfileMock).toHaveBeenCalledWith('u1');
    expect(w.text()).toContain('Tiêu Viêm');
  });
});

describe('ProfileView — render branches', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    authState.isAuthenticated = true;
    authState.hydrate = vi.fn().mockResolvedValue(undefined);
    gameState.bindSocket = vi.fn();
    gameState.fetchState = vi.fn().mockResolvedValue(undefined);
    routeParamsState.id = 'u1';
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
  });

  it('PLAYER role ⇒ KHÔNG render role badge', async () => {
    getPublicProfileMock.mockResolvedValue(buildProfile({ role: 'PLAYER' }));
    const w = mountView();
    await flushPromises();
    expect(w.text()).not.toContain('ADMIN');
    expect(w.text()).not.toContain('MOD');
  });

  it('ADMIN role ⇒ render badge "ADMIN" với class amber', async () => {
    getPublicProfileMock.mockResolvedValue(buildProfile({ role: 'ADMIN' }));
    const w = mountView();
    await flushPromises();
    expect(w.text()).toContain('ADMIN');
    expect(w.html()).toContain('bg-amber-700/40');
  });

  it('MOD role ⇒ render badge "MOD" với class blue', async () => {
    getPublicProfileMock.mockResolvedValue(buildProfile({ role: 'MOD' }));
    const w = mountView();
    await flushPromises();
    expect(w.text()).toContain('MOD');
    expect(w.html()).toContain('bg-blue-700/40');
  });

  it('sectName null ⇒ KHÔNG render dòng "Tông môn"', async () => {
    getPublicProfileMock.mockResolvedValue(buildProfile({ sectName: null }));
    const w = mountView();
    await flushPromises();
    expect(w.text()).not.toContain('Tông môn:');
  });

  it('sectName có giá trị ⇒ render "Tông môn: {name}"', async () => {
    getPublicProfileMock.mockResolvedValue(
      buildProfile({ sectName: 'Thiên Kiếm Tông' }),
    );
    const w = mountView();
    await flushPromises();
    expect(w.text()).toContain('Tông môn');
    expect(w.text()).toContain('Thiên Kiếm Tông');
  });

  it('realmKey không trong catalog ⇒ fallback hiển thị raw key', async () => {
    getPublicProfileMock.mockResolvedValue(
      buildProfile({ realmKey: 'unknown_realm', realmStage: 5 }),
    );
    const w = mountView();
    await flushPromises();
    expect(w.text()).toContain('unknown_realm');
  });

  it('render đầy đủ stats grid (power/spirit/speed/luck)', async () => {
    getPublicProfileMock.mockResolvedValue(
      buildProfile({ power: 99, spirit: 88, speed: 77, luck: 66 }),
    );
    const w = mountView();
    await flushPromises();
    expect(w.text()).toContain('99');
    expect(w.text()).toContain('88');
    expect(w.text()).toContain('77');
    expect(w.text()).toContain('66');
  });
});
