import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { realmByKey, fullRealmName, type CharacterStatePayload } from '@xuantoi/shared';
import { apiClient } from '@/api/client';
import { connect, on } from '@/ws/client';

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export const useGameStore = defineStore('game', () => {
  const character = ref<CharacterStatePayload | null>(null);
  const lastTickAt = ref<number | null>(null);
  const lastTickGain = ref<string | null>(null);
  const wsConnected = ref(false);

  const realmFullName = computed(() => {
    if (!character.value) return '';
    const r = realmByKey(character.value.realmKey);
    if (!r) return character.value.realmKey;
    return fullRealmName(r, character.value.realmStage);
  });

  const expProgress = computed(() => {
    if (!character.value) return 0;
    const exp = BigInt(character.value.exp);
    const next = BigInt(character.value.expNext);
    if (next === 0n) return 1;
    const num = Number((exp * 10000n) / next);
    return Math.min(Math.max(num / 10000, 0), 1);
  });

  async function fetchState(): Promise<void> {
    const { data } = await apiClient.get<Envelope<{ character: CharacterStatePayload }>>(
      '/character/state',
    );
    if (data.ok && data.data) character.value = data.data.character;
  }

  async function setCultivating(on: boolean): Promise<void> {
    const { data } = await apiClient.post<Envelope<{ character: CharacterStatePayload }>>(
      '/character/cultivate',
      { cultivating: on },
    );
    if (data.ok && data.data) character.value = data.data.character;
  }

  async function breakthrough(): Promise<void> {
    const { data } = await apiClient.post<Envelope<{ character: CharacterStatePayload }>>(
      '/character/breakthrough',
      {},
    );
    if (data.ok && data.data) character.value = data.data.character;
  }

  function bindSocket(): void {
    const s = connect();
    s.on('connect', () => (wsConnected.value = true));
    s.on('disconnect', () => (wsConnected.value = false));

    on<CharacterStatePayload>('state:update', (frame) => {
      character.value = frame.payload;
    });
    on<{
      characterId: string;
      expGained: string;
      exp: string;
      expNext: string;
      realmKey: string;
      realmStage: number;
      brokeThrough: boolean;
    }>('cultivate:tick', (frame) => {
      const p = frame.payload;
      lastTickAt.value = frame.ts;
      lastTickGain.value = p.expGained;
      if (character.value && character.value.id === p.characterId) {
        character.value = {
          ...character.value,
          exp: p.exp,
          expNext: p.expNext,
          realmKey: p.realmKey,
          realmStage: p.realmStage,
        };
      }
    });
  }

  return {
    character,
    lastTickAt,
    lastTickGain,
    wsConnected,
    realmFullName,
    expProgress,
    fetchState,
    setCultivating,
    breakthrough,
    bindSocket,
  };
});
