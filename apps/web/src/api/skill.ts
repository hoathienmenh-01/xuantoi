import { i18n } from '@/i18n';
import { apiClient } from './client';

/**
 * Phase 11.2.C — Skill book UI API client.
 *
 * Wire 4 endpoint server-authoritative đã có ở Phase 11.2.B:
 *   - `GET /character/skill` (`{ skill: { maxEquipped, learned[] } }`).
 *   - `POST /character/skill/equip` body `{ skillKey }`.
 *   - `POST /character/skill/unequip` body `{ skillKey }`.
 *   - `POST /character/skill/upgrade-mastery` body `{ skillKey }`.
 *
 * Server-authoritative: client KHÔNG decide masteryLevel / cost / equipped
 * cap — server validate `MAX_EQUIPPED_SKILLS` + LinhThach cost qua
 * `CurrencyService.applyTx({reason:'SKILL_UPGRADE'})` + atomic commit.
 *
 * Type mirror `apps/api/src/modules/character/character-skill.service.ts`
 * `CharacterSkillStateOut` + `CharacterSkillView` + `CharacterSkillUpgradeOut`.
 */

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

function fallbackError(op: string): Error {
  return new Error(i18n.global.t(`common.apiFallback.${op}`));
}

/** Match `SkillTier` từ `@xuantoi/shared/skill-templates`. */
export type SkillTier =
  | 'basic'
  | 'intermediate'
  | 'advanced'
  | 'master'
  | 'legendary';

export interface SkillView {
  skillKey: string;
  tier: SkillTier;
  masteryLevel: number;
  maxMastery: number;
  isEquipped: boolean;
  source: string;
  learnedAt: string;
  effective: {
    atkScale: number;
    mpCost: number;
    cooldownTurns: number;
  } | null;
  nextLevelLinhThachCost: number | null;
  nextLevelShardCost: number | null;
}

export interface SkillState {
  maxEquipped: number;
  learned: SkillView[];
}

export interface SkillUpgradeOut {
  skillKey: string;
  previousLevel: number;
  newLevel: number;
  linhThachSpent: number;
  shardSpent: number;
}

export async function getSkillState(): Promise<SkillState> {
  const { data } = await apiClient.get<Envelope<{ skill: SkillState }>>(
    '/character/skill',
  );
  if (!data.ok || !data.data) throw data.error ?? fallbackError('skillState');
  return data.data.skill;
}

export async function equipSkill(skillKey: string): Promise<SkillState> {
  const { data } = await apiClient.post<Envelope<{ skill: SkillState }>>(
    '/character/skill/equip',
    { skillKey },
  );
  if (!data.ok || !data.data) throw data.error ?? fallbackError('skillEquip');
  return data.data.skill;
}

export async function unequipSkill(skillKey: string): Promise<SkillState> {
  const { data } = await apiClient.post<Envelope<{ skill: SkillState }>>(
    '/character/skill/unequip',
    { skillKey },
  );
  if (!data.ok || !data.data) throw data.error ?? fallbackError('skillUnequip');
  return data.data.skill;
}

export async function upgradeSkillMastery(
  skillKey: string,
): Promise<SkillUpgradeOut> {
  const { data } = await apiClient.post<Envelope<{ upgrade: SkillUpgradeOut }>>(
    '/character/skill/upgrade-mastery',
    { skillKey },
  );
  if (!data.ok || !data.data) throw data.error ?? fallbackError('skillUpgrade');
  return data.data.upgrade;
}
