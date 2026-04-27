import type { Character } from '@prisma/client';
import type { PublicCharacter } from '@xuantoi/shared';
import { getBreakthroughCost, getCultivationExpPerSec, getRealmStageName, realmByKey } from '@xuantoi/shared';

/**
 * Số EXP đang được tu luyện thật-nhưng-chưa-flush vào DB.
 * Tính từ lastCultivationAt → now (hoặc cultivationStartedAt nếu lastCultivationAt null).
 */
export function computePendingExp(char: Character, now: Date = new Date()): bigint {
  if (!char.cultivating) return 0n;
  const anchor = char.lastCultivationAt ?? char.cultivationStartedAt;
  if (!anchor) return 0n;
  const elapsedMs = now.getTime() - anchor.getTime();
  if (elapsedMs <= 0) return 0n;
  const seconds = elapsedMs / 1000;
  const expPerSec = getCultivationExpPerSec(char.realmKey);
  const exp = Math.floor(seconds * expPerSec);
  return BigInt(Math.max(exp, 0));
}

export function toPublicCharacter(char: Character): PublicCharacter {
  const pending = computePendingExp(char);
  const displayExp = char.exp + pending;
  const realm = realmByKey(char.realmKey);
  const cost = getBreakthroughCost(char.realmKey, char.realmStage);
  return {
    id: char.id,
    name: char.name,
    realmKey: char.realmKey,
    realmStage: char.realmStage,
    realmName: realm?.name ?? 'Vô Danh',
    stageName: getRealmStageName(char.realmKey, char.realmStage),
    exp: displayExp.toString(),
    expToBreakthrough: cost.toString(),
    cultivating: char.cultivating,
    cultivationStartedAt: char.cultivationStartedAt
      ? char.cultivationStartedAt.toISOString()
      : null,
    expPerSec: getCultivationExpPerSec(char.realmKey),

    hp: char.hp,
    hpMax: char.hpMax,
    mp: char.mp,
    mpMax: char.mpMax,
    stamina: char.stamina,
    staminaMax: char.staminaMax,
    power: char.power,
    spirit: char.spirit,
    speed: char.speed,
    luck: char.luck,

    linhThach: char.linhThach.toString(),
    tienNgoc: char.tienNgoc,

    createdAt: char.createdAt.toISOString(),
    updatedAt: char.updatedAt.toISOString(),
  };
}
