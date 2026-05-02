import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CULTIVATION_METHODS,
  ELEMENTS,
  STARTER_CULTIVATION_METHOD_KEY,
  getCultivationMethodDef,
  realmByKey,
  type CultivationMethodDef,
  type ElementKey,
  type SectKey,
} from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';

/**
 * Phase 11.1.B — Cultivation Method (Công pháp) server-authoritative service.
 *
 * Trách nhiệm:
 *   - `learn(characterId, methodKey, source)` — học công pháp với validate
 *     realm tier + sect lock + forbidden element. Idempotent qua
 *     `@@unique([characterId, methodKey])` (P2002 → return existing).
 *   - `equip(characterId, methodKey)` — switch method đang dùng. Validate
 *     character đã học method này (`CharacterCultivationMethod` row tồn tại).
 *   - `getState(characterId)` — list method đã học + method đang equip.
 *   - `grantStarterIfMissing(characterId)` — auto-grant + auto-equip
 *     `khai_thien_quyet` (idempotent). Gọi từ `CharacterService.onboard`.
 *
 * Tất cả mutate đều trong `prisma.$transaction` để consistency. Không tự
 * cộng/trừ resource ở đây — drop/cost/reward ở caller (boss reward / sect
 * shop / quest milestone). Service này chỉ ghi nhận quyền sở hữu method
 * + chuyển equip flag.
 *
 * KHÔNG implement cooldown 24h re-equip trong MVP — future PR (anti-spam).
 */
@Injectable()
export class CultivationMethodService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Học công pháp (idempotent). Validate realm tier ≥ method.unlockRealm,
   * sect match (nếu method.requiredSect ≠ null), primaryElement không nằm
   * trong forbiddenElements.
   *
   * @returns trạng thái mới sau khi học (gồm method vừa học).
   */
  async learn(
    characterId: string,
    methodKey: string,
    source: string,
  ): Promise<CultivationMethodStateOut> {
    const method = getCultivationMethodDef(methodKey);
    if (!method) {
      throw new CultivationMethodError('METHOD_NOT_FOUND');
    }
    const c = await this.prisma.character.findUnique({
      where: { id: characterId },
      include: { sect: true },
    });
    if (!c) throw new CultivationMethodError('CHARACTER_NOT_FOUND');

    this.validateLearnable(c, method);

    // Idempotent insert — P2002 (unique violation) means already learned,
    // return current state.
    try {
      await this.prisma.characterCultivationMethod.create({
        data: { characterId, methodKey, source },
      });
    } catch (e) {
      if (
        !(e instanceof Prisma.PrismaClientKnownRequestError) ||
        e.code !== 'P2002'
      ) {
        throw e;
      }
    }

    return this.getState(characterId);
  }

  /**
   * Trang bị method đã học (server-authoritative). KHÔNG validate cooldown
   * trong MVP — future enhancement.
   */
  async equip(
    characterId: string,
    methodKey: string,
  ): Promise<CultivationMethodStateOut> {
    const method = getCultivationMethodDef(methodKey);
    if (!method) throw new CultivationMethodError('METHOD_NOT_FOUND');

    const c = await this.prisma.character.findUnique({
      where: { id: characterId },
      include: { sect: true },
    });
    if (!c) throw new CultivationMethodError('CHARACTER_NOT_FOUND');

    // Re-validate (e.g. character đã đổi sect / linh căn → không equip
    // method conflict được).
    this.validateLearnable(c, method);

    const owned = await this.prisma.characterCultivationMethod.findUnique({
      where: { characterId_methodKey: { characterId, methodKey } },
    });
    if (!owned) throw new CultivationMethodError('NOT_LEARNED');

    await this.prisma.character.update({
      where: { id: characterId },
      data: { equippedCultivationMethodKey: methodKey },
    });

    return this.getState(characterId);
  }

  /**
   * Đọc trạng thái công pháp hiện tại của character — list đã học + đang
   * equip. Auto-grant starter `khai_thien_quyet` nếu legacy character
   * (pre-11.1.B) chưa có method nào.
   */
  async getState(characterId: string): Promise<CultivationMethodStateOut> {
    const c = await this.prisma.character.findUnique({
      where: { id: characterId },
    });
    if (!c) throw new CultivationMethodError('CHARACTER_NOT_FOUND');

    const learned = await this.prisma.characterCultivationMethod.findMany({
      where: { characterId },
      orderBy: { learnedAt: 'asc' },
    });

    // Lazy migration cho legacy character — auto-grant starter nếu chưa có
    // bất kỳ method nào.
    if (learned.length === 0) {
      await this.grantStarterIfMissing(characterId);
      return this.getState(characterId);
    }

    return {
      equippedMethodKey: c.equippedCultivationMethodKey,
      learned: learned.map((row) => ({
        methodKey: row.methodKey,
        source: row.source,
        learnedAt: row.learnedAt.toISOString(),
      })),
    };
  }

  /**
   * Idempotent — auto-grant + auto-equip `khai_thien_quyet` starter nếu
   * character chưa có. Gọi từ `CharacterService.onboard` sau khi tạo
   * character. Re-call an toàn (no-op nếu đã có).
   */
  async grantStarterIfMissing(characterId: string): Promise<void> {
    const existing = await this.prisma.characterCultivationMethod.findUnique({
      where: {
        characterId_methodKey: {
          characterId,
          methodKey: STARTER_CULTIVATION_METHOD_KEY,
        },
      },
    });
    if (existing) {
      // Đã có row — đảm bảo equipped key set nếu legacy null.
      const c = await this.prisma.character.findUnique({
        where: { id: characterId },
      });
      if (c && !c.equippedCultivationMethodKey) {
        await this.prisma.character.update({
          where: { id: characterId },
          data: { equippedCultivationMethodKey: STARTER_CULTIVATION_METHOD_KEY },
        });
      }
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.characterCultivationMethod.create({
        data: {
          characterId,
          methodKey: STARTER_CULTIVATION_METHOD_KEY,
          source: 'starter',
        },
      });
      await tx.character.update({
        where: { id: characterId },
        data: { equippedCultivationMethodKey: STARTER_CULTIVATION_METHOD_KEY },
      });
    });
  }

  /**
   * Validate character có thể học/equip method này không. Throw
   * CultivationMethodError với code cụ thể.
   */
  private validateLearnable(
    c: {
      realmKey: string;
      primaryElement: string | null;
      sect: { name: string } | null;
    },
    method: CultivationMethodDef,
  ): void {
    // Realm tier check.
    const charRealm = realmByKey(c.realmKey);
    const reqRealm = realmByKey(method.unlockRealm);
    if (!charRealm || !reqRealm) {
      throw new CultivationMethodError('REALM_NOT_FOUND');
    }
    if (charRealm.order < reqRealm.order) {
      throw new CultivationMethodError('REALM_TOO_LOW');
    }

    // Sect lock check.
    if (method.requiredSect) {
      const charSectKey = c.sect ? sectNameToKey(c.sect.name) : null;
      if (charSectKey !== method.requiredSect) {
        throw new CultivationMethodError('WRONG_SECT');
      }
    }

    // Forbidden element check.
    if (
      method.forbiddenElements &&
      method.forbiddenElements.length > 0 &&
      isValidElement(c.primaryElement) &&
      method.forbiddenElements.includes(c.primaryElement)
    ) {
      throw new CultivationMethodError('FORBIDDEN_ELEMENT');
    }
  }
}

/**
 * Compose multiplier `getCultivationMethodDef(key).expMultiplier`. Legacy
 * character (key=null hoặc invalid) → fallback 1.0. Pure helper, dùng trong
 * `CultivationProcessor`.
 */
export function methodExpMultiplierFor(
  equippedMethodKey: string | null,
): number {
  if (!equippedMethodKey) return 1.0;
  const def = getCultivationMethodDef(equippedMethodKey);
  if (!def) return 1.0;
  return def.expMultiplier;
}

function isValidElement(e: string | null): e is ElementKey {
  return e !== null && (ELEMENTS as readonly string[]).includes(e);
}

const SECT_NAME_TO_KEY: Record<string, SectKey> = {
  'Thanh Vân Môn': 'thanh_van',
  'Huyền Thuỷ Cung': 'huyen_thuy',
  'Tu La Tông': 'tu_la',
};

function sectNameToKey(name: string): SectKey | null {
  return SECT_NAME_TO_KEY[name] ?? null;
}

export class CultivationMethodError extends Error {
  constructor(
    public code:
      | 'METHOD_NOT_FOUND'
      | 'CHARACTER_NOT_FOUND'
      | 'REALM_NOT_FOUND'
      | 'REALM_TOO_LOW'
      | 'WRONG_SECT'
      | 'FORBIDDEN_ELEMENT'
      | 'NOT_LEARNED',
  ) {
    super(code);
  }
}

export interface CultivationMethodLearnedRow {
  methodKey: string;
  source: string;
  learnedAt: string;
}

export interface CultivationMethodStateOut {
  equippedMethodKey: string | null;
  learned: CultivationMethodLearnedRow[];
}

// Re-export catalog for module consumers (avoid double import).
export { CULTIVATION_METHODS };
