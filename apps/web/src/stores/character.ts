import { defineStore } from 'pinia';
import type { PublicCharacter } from '@xuantoi/shared';
import * as charApi from '@/api/character';
import * as cultApi from '@/api/cultivation';

interface State {
  character: PublicCharacter | null;
  loading: boolean;
  loaded: boolean;
}

export const useCharacterStore = defineStore('character', {
  state: (): State => ({ character: null, loading: false, loaded: false }),
  getters: {
    hasCharacter: (s): boolean => s.character !== null,
    isCultivating: (s): boolean => s.character?.cultivating === true,
  },
  actions: {
    async loadMe(): Promise<void> {
      this.loading = true;
      try {
        this.character = await charApi.getMyCharacter();
      } finally {
        this.loading = false;
        this.loaded = true;
      }
    },
    async create(name: string): Promise<void> {
      this.loading = true;
      try {
        this.character = await charApi.createCharacter({ name });
      } finally {
        this.loading = false;
        this.loaded = true;
      }
    },
    async start(): Promise<void> {
      const r = await cultApi.startCultivation();
      this.character = r.character;
    },
    async stop(): Promise<void> {
      const r = await cultApi.stopCultivation();
      this.character = r.character;
    },
    async tick(): Promise<void> {
      const r = await cultApi.tickCultivation();
      this.character = r.character;
    },
    async breakthrough(): Promise<void> {
      const r = await cultApi.breakthrough();
      this.character = r.character;
    },
    reset(): void {
      this.character = null;
      this.loaded = false;
    },
  },
});
