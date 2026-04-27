import { defineStore } from 'pinia';
import type { PublicGameLog } from '@xuantoi/shared';
import * as api from '@/api/logs';

export const useLogsStore = defineStore('logs', {
  state: (): { logs: PublicGameLog[]; loading: boolean } => ({ logs: [], loading: false }),
  actions: {
    async load(): Promise<void> {
      this.loading = true;
      try {
        this.logs = await api.getMyLogs();
      } finally {
        this.loading = false;
      }
    },
    reset(): void {
      this.logs = [];
    },
  },
});
