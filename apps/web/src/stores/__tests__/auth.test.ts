import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const sessionMock = vi.fn();
const loginMock = vi.fn();
const registerMock = vi.fn();
const logoutMock = vi.fn();

vi.mock('@/api/auth', () => ({
  session: (...a: unknown[]) => sessionMock(...a),
  login: (...a: unknown[]) => loginMock(...a),
  register: (...a: unknown[]) => registerMock(...a),
  logout: (...a: unknown[]) => logoutMock(...a),
}));

import { useAuthStore } from '@/stores/auth';

const playerUser = {
  id: 'u1',
  email: 'p@x.local',
  role: 'PLAYER' as const,
  createdAt: '2026-04-28T00:00:00.000Z',
};
const adminUser = {
  id: 'a1',
  email: 'a@x.local',
  role: 'ADMIN' as const,
  createdAt: '2026-04-28T00:00:00.000Z',
};

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    sessionMock.mockReset();
    loginMock.mockReset();
    registerMock.mockReset();
    logoutMock.mockReset();
  });

  it('default state: user=null, loading=false, isAuthenticated=false, isAdmin=false', () => {
    const a = useAuthStore();
    expect(a.user).toBeNull();
    expect(a.loading).toBe(false);
    expect(a.isAuthenticated).toBe(false);
    expect(a.isAdmin).toBe(false);
  });

  it('hydrate() sets user from session()', async () => {
    sessionMock.mockResolvedValueOnce(playerUser);
    const a = useAuthStore();
    await a.hydrate();
    expect(a.user).toEqual(playerUser);
    expect(a.isAuthenticated).toBe(true);
    expect(a.isAdmin).toBe(false);
  });

  it('isAdmin true only when role=ADMIN', async () => {
    sessionMock.mockResolvedValueOnce(adminUser);
    const a = useAuthStore();
    await a.hydrate();
    expect(a.isAdmin).toBe(true);
  });

  it('login() sets user + toggles loading + returns user', async () => {
    let resolveLogin: ((u: typeof playerUser) => void) | null = null;
    loginMock.mockImplementationOnce(
      () => new Promise<typeof playerUser>((res) => { resolveLogin = res; }),
    );
    const a = useAuthStore();
    const promise = a.login('p@x.local', 'pw', true);
    expect(a.loading).toBe(true);
    resolveLogin!(playerUser);
    const result = await promise;
    expect(result).toEqual(playerUser);
    expect(a.user).toEqual(playerUser);
    expect(a.loading).toBe(false);
    expect(loginMock).toHaveBeenCalledWith({
      email: 'p@x.local',
      password: 'pw',
      rememberEmail: true,
    });
  });

  it('login() resets loading on rejection and re-throws', async () => {
    loginMock.mockRejectedValueOnce(new Error('bad creds'));
    const a = useAuthStore();
    await expect(a.login('p@x.local', 'wrong')).rejects.toThrow('bad creds');
    expect(a.loading).toBe(false);
    expect(a.user).toBeNull();
  });

  it('register() defaults rememberEmail flag and stores user', async () => {
    registerMock.mockResolvedValueOnce(playerUser);
    const a = useAuthStore();
    const u = await a.register('new@x.local', 'pw');
    expect(u).toEqual(playerUser);
    expect(a.user).toEqual(playerUser);
    expect(registerMock).toHaveBeenCalledWith({ email: 'new@x.local', password: 'pw' });
  });

  it('logout() calls api.logout then clears user', async () => {
    logoutMock.mockResolvedValueOnce(undefined);
    const a = useAuthStore();
    a.user = playerUser;
    await a.logout();
    expect(logoutMock).toHaveBeenCalledOnce();
    expect(a.user).toBeNull();
    expect(a.isAuthenticated).toBe(false);
  });
});
