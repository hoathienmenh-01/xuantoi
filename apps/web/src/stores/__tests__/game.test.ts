import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import type { CharacterStatePayload } from '@xuantoi/shared';
import { useGameStore } from '@/stores/game';

function makeCharacter(overrides: Partial<CharacterStatePayload> = {}): CharacterStatePayload {
  return {
    id: 'char_test',
    name: 'TestPlayer',
    realmKey: 'luyenkhi',
    realmStage: 3,
    level: 3,
    exp: '500',
    expNext: '1000',
    hp: 100,
    hpMax: 100,
    mp: 50,
    mpMax: 50,
    stamina: 100,
    staminaMax: 100,
    power: 10,
    spirit: 10,
    speed: 10,
    luck: 1,
    linhThach: '0',
    tienNgoc: 0,
    cultivating: false,
    ...overrides,
  } as CharacterStatePayload;
}

describe('useGameStore (computed + helpers)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('realmFullName is empty when character is null', () => {
    const game = useGameStore();
    expect(game.realmFullName).toBe('');
  });

  it('realmFullName composes realm name + stage from catalog', () => {
    const game = useGameStore();
    game.character = makeCharacter({ realmKey: 'luyenkhi', realmStage: 3 });
    expect(game.realmFullName).toContain('Luyện Khí');
  });

  it('realmFullName falls back to raw key for unknown realm', () => {
    const game = useGameStore();
    game.character = makeCharacter({ realmKey: 'unknown_realm', realmStage: 1 });
    expect(game.realmFullName).toBe('unknown_realm');
  });

  it('expProgress is 0 when character is null', () => {
    const game = useGameStore();
    expect(game.expProgress).toBe(0);
  });

  it('expProgress is exp/expNext clamped to [0, 1]', () => {
    const game = useGameStore();
    game.character = makeCharacter({ exp: '500', expNext: '1000' });
    expect(game.expProgress).toBeCloseTo(0.5, 4);
  });

  it('expProgress returns 1 when expNext is 0 (max realm)', () => {
    const game = useGameStore();
    game.character = makeCharacter({ exp: '0', expNext: '0' });
    expect(game.expProgress).toBe(1);
  });

  it('clearMailBadge resets unreadMail to 0', () => {
    const game = useGameStore();
    game.unreadMail = 5;
    game.clearMailBadge();
    expect(game.unreadMail).toBe(0);
  });

  it('default state has empty character + 0 unread mail + ws disconnected', () => {
    const game = useGameStore();
    expect(game.character).toBeNull();
    expect(game.unreadMail).toBe(0);
    expect(game.wsConnected).toBe(false);
    expect(game.lastTickAt).toBeNull();
    expect(game.lastTickGain).toBeNull();
  });
});
