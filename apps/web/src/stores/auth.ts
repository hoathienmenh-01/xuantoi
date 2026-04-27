import { defineStore } from 'pinia';
import type { PublicUser } from '@xuantoi/shared';
import * as api from '@/api/auth';

interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  hydrated: boolean;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({ user: null, loading: false, hydrated: false }),
  getters: {
    isAuthenticated: (s): boolean => s.user !== null,
    isAdmin: (s): boolean => s.user?.role === 'ADMIN',
  },
  actions: {
    /** Gọi 1 lần khi app boot. Idempotent. */
    async hydrate(force = false): Promise<void> {
      if (this.hydrated && !force) return;
      let user = await api.session();
      if (!user) {
        // Có thể access cookie hết hạn — thử refresh.
        user = await api.refresh();
      }
      this.user = user;
      this.hydrated = true;
    },
    async login(email: string, password: string, rememberEmail = false): Promise<PublicUser> {
      this.loading = true;
      try {
        const user = await api.login({ email, password, rememberEmail });
        this.user = user;
        this.hydrated = true;
        return user;
      } finally {
        this.loading = false;
      }
    },
    async register(email: string, password: string): Promise<PublicUser> {
      this.loading = true;
      try {
        const user = await api.register({ email, password });
        this.user = user;
        this.hydrated = true;
        return user;
      } finally {
        this.loading = false;
      }
    },
    async logout(): Promise<void> {
      await api.logout();
      this.user = null;
    },
  },
});
