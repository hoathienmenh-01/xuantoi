# Xuân Tôi — Long-Term Roadmap (Phase 9 → Phase 17)

> **Status**: Long-term roadmap. Source of truth cho **thứ tự build** sau MVP.
> Phase 0..8 (historical MVP roadmap) — xem [`05_KICH_BAN_BUILD_VA_PROMPT_AI.md`](./05_KICH_BAN_BUILD_VA_PROMPT_AI.md).
> Bối cảnh sản phẩm: [`GAME_DESIGN_BIBLE.md`](./GAME_DESIGN_BIBLE.md).

Mục tiêu: AI/dev tiếp theo đọc xong biết **next PR nên làm gì**, **không nên làm gì**, và **làm gì trước khi unlock phase tiếp theo**.

---

## 0. NGUYÊN TẮC ROADMAP

### 0.1 Cách đọc

Mỗi phase có:

1. **Goal**: 1-2 câu mục tiêu.
2. **Entry criteria**: cái gì PHẢI có trước.
3. **Scope**: PR/module trong phase này.
4. **Exit criteria**: bằng chứng phase này đã xong.
5. **Risks**: rủi ro thường gặp.

### 0.2 Quy tắc nhảy phase

- **KHÔNG** mở phase N+1 nếu phase N chưa đủ exit criteria.
- **OK** chạy song song nếu 2 phase độc lập (e.g. phase 10 content scale + phase 11 progression depth có thể parallel nếu giữ data model orthogonal).
- **PR docs / audit / typo fix** lúc nào cũng OK, không phụ thuộc phase.

### 0.3 Quy tắc chia PR

- 1 PR = 1 module / 1 endpoint / 1 mục tiêu rõ ràng.
- PR vượt 500 dòng diff phải có lý do (rare).
- PR tạo Prisma migration phải đi kèm `migration note` (xem section M trong `GAME_DESIGN_BIBLE.md`).
- PR thêm currency/reward path phải đi kèm test idempotency.

---

## Phase 9 — Closed Beta Stabilization

### Goal

Đưa repo từ "chạy được, có test" thành "sẵn sàng mời 50-100 người closed beta thử dài 1-2 tuần mà không vỡ".

### Entry criteria

- ✅ Phase 0-8 done (đã, theo `BETA_CHECKLIST.md`).
- ✅ CI xanh ổn định ≥ 1 tuần.

### Scope

#### 9.1 Audit refresh (recurring)

- Mỗi session đầu phải đọc `AI_HANDOFF_REPORT.md` + `git log` + open PRs.
- Cập nhật snapshot ở đầu `AI_HANDOFF_REPORT.md`.

#### 9.2 Smoke checklist

- `pnpm smoke:beta` — script ở `scripts/smoke-beta.mjs`. Chạy trước mỗi promote release.
- **Mở rộng**: thêm `pnpm smoke:economy` (verify ledger consistency của 1 luồng đầu cuối: cultivate → boss → mail claim → ledger total = 0 ở phía debit-credit).
- **Mở rộng**: thêm `pnpm smoke:admin` (admin grant, mail send, gift code create — tất cả ghi audit).
- **Mở rộng**: thêm `pnpm smoke:ws` (connect WS, nhận tick, reconnect).

#### 9.3 Playwright golden path

- File hiện có: `e2e/golden.spec.ts`.
- Mở rộng: full path từ register → onboarding → home → cultivate 1 tick → đột phá phamnhan → dungeon son_coc → loot → equip → leaderboard.
- Yêu cầu API+Web+Postgres+Redis chạy (E2E_FULL=1 trong CI).

#### 9.4 Bug triage

- Mỗi tuần review issue tracker (GitHub Issues).
- Severity: P0 (block beta) → P3 (cosmetic). P0/P1 fix trong cùng release cycle.

#### 9.5 Mobile/i18n polish

- Test PWA install trên iOS Safari + Android Chrome.
- Verify i18n VI + EN coverage ≥ 95% strings.
- Test dark/light mode (nếu có).
- Test offline fallback (Workbox cache).

#### 9.6 Release checklist

- Cập nhật `docs/QA_CHECKLIST.md` per release.
- Cập nhật `docs/RELEASE_NOTES.md` per release.
- Cập nhật `docs/CHANGELOG.md` per release.

### Exit criteria

- [ ] `pnpm smoke:beta` pass đầu cuối.
- [ ] `pnpm smoke:economy` pass.
- [ ] Playwright golden path pass trên CI (real DB+Redis).
- [ ] Backlog P0 = 0, P1 ≤ 3.
- [ ] CI xanh 14 ngày liên tục.
- [ ] `BETA_CHECKLIST.md` ≥ 95% tick.

### Risks

- **Flaky test** kéo dài → mất tin tưởng. Fix root cause, không retry blindly.
- **i18n drift** — VI thêm key mới mà quên EN. Cần lint script verify parity.
- **Real DB integration test slow** — cân nhắc dùng pg-mem cho unit, postgres real cho integration.

---

## Phase 10 — Content Scale 1

### Goal

Nâng catalog item / skill / monster / dungeon / mission / boss lên 2-3× để người chơi không cảm thấy "chỉ có 3 dungeon".

### Entry criteria

- Phase 9 exit criteria.
- `CONTENT_PIPELINE.md` approved.

### Scope

| Hiện trạng | Target phase 10 |
|---|---|
| 30 item | 80-100 item (phủ 28 realm × 9 slot + pill/ore/artifact mở rộng) |
| 10 skill | 25-30 skill (phủ 3 sect × 8 skill + universal + passive) |
| 9 monster | 30 monster (phủ realm pham → late pham) |
| 3 dungeon | 8-10 dungeon (phủ realm pham → nhan_tien sơ kỳ) |
| 12 mission | 30+ daily, 15+ weekly, 20+ once |
| 0 named boss catalog | 10 named boss (Huyết Ma Chúa, Thiên Ma, Yêu Long Vương, …) |

#### 10.1 PR: items pack 1

- File: `packages/shared/src/items.ts`.
- Thêm 50 item mới (50% PHAM, 25% LINH, 15% HUYEN, 8% TIEN, 2% THAN).
- Mỗi item có VI/EN name + balance note.
- Test catalog update.

#### 10.2 PR: skills pack 1

- File: `packages/shared/src/combat.ts`.
- Thêm 15 skill (5 per sect).
- Phải có `mpCost`, `cooldownTurns` (nếu phase 11 schema cooldown đã merge).

#### 10.3 PR: monsters & dungeons pack 1

- 20 monster mới + 6 dungeon mới.
- `DUNGEON_LOOT` cập nhật weight.

#### 10.4 PR: missions pack 1

- 30+ mission mới.
- Phải tham chiếu tới item/dungeon đã catalog.

#### 10.5 PR: boss catalog

- File mới: `packages/shared/src/boss-catalog.ts` (hoặc mở rộng `boss.ts`).
- 10 named boss với HP curve, drop table, spawn rule (admin manual ở phase 10, auto ở phase 12).

#### 10.6 PR: catalog test consolidation

- `pnpm test:catalog` script tổng (alias `pnpm --filter @xuantoi/shared test`).

### Exit criteria

- [ ] Catalog ≥ 80 item, ≥ 25 skill, ≥ 30 monster, ≥ 8 dungeon, ≥ 65 mission, ≥ 10 boss.
- [ ] Catalog test pass 100%.
- [ ] Power curve tự động compute power_at_realm(realm) từ best-equip available không break BALANCE_MODEL.
- [ ] Drop table balance test (xem `BALANCE_MODEL.md` §3).

### Risks

- **Power inflation**: thêm item mạnh phá curve. Mitigation: balance note + curve test.
- **i18n debt**: chỉ thêm VI mà quên EN. Mitigation: i18n parity test.

### Module phụ thuộc cần xong trước phase 10

- Không có phụ thuộc cứng. Phase 10 chỉ thêm data, không thêm logic mới.

---

## Phase 11 — Progression Depth

### Goal

Thêm depth cho progression: công pháp, skill upgrade, linh căn, thể chất, alchemy, refinery, thiên kiếp/tâm ma, talent.

### Entry criteria

- Phase 9 exit criteria.
- Phase 10 exit criteria (cần data depth trước khi thêm logic depth).

### Scope

#### 11.1 PR: CultivationMethod model

- Prisma model mới `CultivationMethod` (catalog static initially) + `CharacterCultivationMethod` (DB).
- Service: `learnCultivationMethod(characterId, methodKey)`.
- Effect: multiplier `cultivationRate` + skill unlock.
- Migration + rollback note.

#### 11.2 PR: SkillTemplate + CharacterSkill DB

- Migrate skill từ pure static sang catalog static + DB row per character.
- Field: `skillKey`, `level (1..10)`, `xp`.
- Skill book item upgrade level.

#### 11.3 PR: Linh căn + Thể chất

- Add column `Character.spiritualRoot` (enum 5-tier) + `Character.physique` (Int).
- Roll spiritualRoot khi tạo character (RNG seed-by-userId immutable).
- Item `linh_can_dan` reroll (cost cao).
- Migration + rollback.

#### 11.4 PR: Thiên kiếp + Tâm ma

- Trigger khi break realm `pham → nhan_tien`, `nhan_tien → tien_gioi`, `tien_gioi → hon_nguyen`.
- Combat 1 lượt vs "Thiên Kiếp Lôi" deterministic theo character power.
- Fail: rớt EXP về stage 9 + cooldown 1h.
- Tâm ma: 3-10% chance set debuff `cultivating: false` 30p.

#### 11.5 PR: Alchemy (Luyện đan)

- Module mới `apps/api/src/modules/alchemy/`.
- Recipe catalog static (`packages/shared/src/alchemy.ts`).
- Process: chọn recipe + nguyên liệu (item) → consume → roll success → grant pill.
- Ledger: `ItemLedger` consume + grant.

#### 11.6 PR: Refinery (Luyện khí)

- Tương tự alchemy nhưng cho weapon/armor.
- Refine 0..15 level. % fail tăng theo level.
- Material: `nguyenThach` + `linhThach`.

#### 11.7 PR: Talent / Thần thông

- 5-7 talent passive grand.
- Unlock qua "ngộ đạo" milestone (mỗi 3 realm trigger 1 ngộ đạo cho talent point).
- DB: `CharacterTalent`.

#### 11.8 PR: Buff/Debuff system

- Model `CharacterBuff(key, expiresAt, source, stackable)`.
- Apply qua: pill, sect aura, event.
- Decay tự động qua cron prune.

### Exit criteria

- [ ] Tất cả 8 sub-PR merged + CI xanh.
- [ ] Test idempotency cho mọi reward path mới (alchemy result, talent unlock, …).
- [ ] BALANCE_MODEL.md cập nhật curve.
- [ ] Migration đã chạy thử rollback.

### Risks

- **Migration data loss** — schema mở rộng có default value, không xoá field cũ. Backup DB trước khi deploy.
- **Power explosion** — refine + talent + cultivation method chồng nhau → power × 5-10. Mitigation: cap formula + curve test.
- **Cheat surface tăng** — alchemy/refine RNG có thể bị manipulate. Mitigation: server RNG, log mọi roll.

### Module phụ thuộc cần xong trước phase 11

- ItemLedger 100% coverage (đã có cơ bản từ Phase 9, cần verify mọi consume path đã ghi).
- Migration tooling tested với rollback.
- Time-to-power curve baseline đã document trong `BALANCE.md`.

---

## Phase 12 — Dungeon & World Map

### Goal

Mở rộng từ "3 dungeon flat" sang "8-12 region với dungeon, encounter, boss riêng".

### Entry criteria

- Phase 9 + 10. (Phase 11 không bắt buộc nhưng khuyến nghị).

### Scope

#### 12.1 PR: MapRegion model

- DB model `MapRegion(key, nameVi, nameEn, unlockRealmKey, flavor, sortOrder)`.
- Seed 8-12 region.

#### 12.2 PR: DungeonTemplate + DungeonRun

- DB model `DungeonTemplate(key, regionId, recommendedRealm, encounterCount, lootTableKey)`.
- DB model `DungeonRun(characterId, templateKey, status, seed, currentEncounterIndex)`.
- Service: `startRun(characterId, templateKey)`, `nextEncounter(runId)`, `claimRun(runId)`.

#### 12.3 PR: Encounter mở rộng

- Encounter hiện đã có. Mở rộng để link tới `DungeonRun` (1 run = 1-N encounter sequential).
- Encounter có boss-encounter type cho boss-of-region.

#### 12.4 PR: MonsterTemplate (optional move static → DB)

- Cân nhắc: giữ static (`MONSTERS` array) hay move sang DB? Quyết định theo content cadence — nếu admin cần tune monster mà không deploy → move sang DB.
- **Default decision**: giữ static phase 12; chỉ move sang DB nếu phase 15 cần admin tune live.

#### 12.5 PR: DropTable + LootRoll (DB)

- DB model `DropTable(key, entries Json)` thay thế `DUNGEON_LOOT` static (hoặc co-exist).
- DB model `LootRoll(characterId, sourceType, sourceKey, itemKey, qty, rolledAt)` — audit trail mọi loot.

#### 12.6 PR: Boss-by-region auto-spawn

- BullMQ repeatable job `bossSpawnJob` per region.
- Schedule: e.g. Hắc Lâm Huyết Ma Chúa mỗi 3h.
- Idempotent: nếu region đã có boss ACTIVE thì skip spawn.

#### 12.7 PR: Bí cảnh (Secret realm — endgame dungeon)

- Special dungeon-template type `BI_CANH`. Yêu cầu `secret_key` item để vào.
- Drop tier `TIEN`/`THAN`.

### Exit criteria

- [ ] 10+ region seeded.
- [ ] 20+ dungeon template.
- [ ] Auto-spawn boss working with idempotency test.
- [ ] LootRoll audit query working.

### Risks

- **DB scale**: `LootRoll` có thể phình to. Cần partition theo `createdAt` (postgres declarative partition) hoặc archive cron.
- **Region unlock UX**: phải onboard rõ "vùng này yêu cầu Kim Đan" nếu không người mới confused.

---

## Phase 13 — Sect 2.0

### Goal

Chuyển sect từ "1 model rỗng" sang "ecosystem có role, mission, shop, treasury, war".

### Entry criteria

- Phase 9 + 10.
- World boss reward idempotency confirmed (phase 12 task 12.6 hoặc earlier).

### Scope

#### 13.1 PR: SectMember + Role

- Tách `Character.sectId` sang model `SectMember(sectId, characterId, role: SectRole, joinedAt)`.
- `SectRole` enum: `LEADER`, `ELDER`, `CORE`, `DISCIPLE`.
- Migration: backfill từ `Character.sectId` + `Sect.leaderId`.

#### 13.2 PR: SectContributionLedger

- DB model audit mọi gain/spend `congHien`.
- Reuse pattern từ `CurrencyLedger`.

#### 13.3 PR: SectTreasuryLedger

- DB model audit mọi gain/spend `Sect.treasuryLinhThach`.

#### 13.4 PR: SectMission

- Static catalog `SECT_MISSIONS` (`packages/shared/src/sect-missions.ts`).
- DB `SectMissionProgress(sectMemberId, missionKey, ...)`.
- Reset cron tương tự daily/weekly.

#### 13.5 PR: SectShop

- Catalog `SECT_SHOP` static.
- Endpoint `POST /api/sect/shop/buy` consume `congHien`.
- Ledger `SectContributionLedger` ghi spend.

#### 13.6 PR: SectBoss

- Reuse `WorldBoss` schema with `scopeKey` field. `WORLD` boss = `scopeKey: 'world'`. `SECT` boss = `scopeKey: sectId`.
- Migration: thêm `scopeKey` field default `'world'`.

#### 13.7 PR: SectWar (async, season-based)

- DB model `SectWar(seasonId, status, startsAt, endsAt)`.
- DB model `SectWarMatch(warId, sectAId, sectBId, scoreA, scoreB, status)`.
- Người chơi attack sect war qua "tấn công đại trận" — deterministic combat dùng character snapshot.
- Reward season: top sect → mail + title.

#### 13.8 PR: Permission audit

- Mọi action role/promote/demote/kick → ghi `AdminAuditLog` với `actor = leader characterId` (cần extend audit log để hỗ trợ non-admin actor, hoặc tạo `SectAuditLog` riêng).

### Exit criteria

- [ ] 4 role split working.
- [ ] Sect mission claim idempotent.
- [ ] Sect treasury chỉ leader/elder spend được, có log.
- [ ] Sect war season chạy 1 vòng end-to-end (test environment).

### Risks

- **Permission bug** = critical. Test mọi guard.
- **Sect war balance** = khó tune. Plan: cho 1 season test trước khi public.

---

## Phase 14 — Arena Season

### Goal

Async PvP có thể chơi "fair" với người không chơi cùng giờ.

### Entry criteria

- Phase 11 (cần combat snapshot deterministic).
- Phase 13 (không hard, nhưng arena dùng cùng infra `Season`).

### Scope

#### 14.1 PR: CombatSnapshot

- Khi character submit defensive snapshot → save `CharacterCombatSnapshot(characterId, seasonId, snapshotJson, createdAt)`.
- Snapshot lock state: power, equip bonuses, skills, talents tại thời điểm submit.

#### 14.2 PR: Arena queue + match

- Service `ArenaService.findOpponent(characterId)` — tìm 5 opponent theo ELO close.
- DB `ArenaMatch(seasonId, attackerId, defenderId, snapshotA, snapshotB, result, createdAt)`.
- Combat: deterministic turn-based dùng 2 snapshot.

#### 14.3 PR: Season + ELO

- Model `Season(key, kind, status, startsAt, endsAt)`.
- Model `SeasonProgress(seasonId, characterId, eloRating, wins, losses)`.
- Reset season → ELO reset về 1500, không reset progression.

#### 14.4 PR: Arena reward

- DB `SeasonRewardClaim(seasonId, characterId, tier, claimedAt)` unique.
- End-of-season cron: tính tier per character (top 10 / top 100 / others) → mail reward.

#### 14.5 PR: Anti-wintrade

- Rule: 1 cặp `(attacker, defender)` trong cùng season, sau 3 trận liên tiếp → no ELO change.
- Detection: cron quét same-pair frequency.

### Exit criteria

- [ ] 1 season test 1 tuần end-to-end.
- [ ] Combat deterministic verified (re-run cùng snapshot → cùng kết quả).
- [ ] No double-claim reward.

### Risks

- **Snapshot drift**: nếu schema char thay đổi giữa season → snapshot không decode. Mitigation: version snapshot.
- **ELO meta**: dễ bị hard counter. Mitigation: tier reward không quá chênh lệch.

---

## Phase 15 — Live Ops / Event

### Goal

Admin có thể schedule event mà không deploy code.

### Entry criteria

- Phase 9.
- RewardClaimLog universal (xem ECONOMY_MODEL.md).

### Scope

#### 15.1 PR: EventConfig + EventProgress

- DB `EventConfig(key, kind, configJson, status, startsAt, endsAt, createdByAdminId)`.
- DB `EventProgress(eventId, characterId, progressJson)`.
- DB `EventRewardClaim(eventId, characterId, tier, claimedAt)` unique.

#### 15.2 PR: Event scheduler UI (admin)

- Trang admin tạo / chỉnh / kết thúc event.
- Validation: không 2 event cùng kind overlap.

#### 15.3 PR: Announcement

- DB `Announcement(message, level, startsAt, endsAt)`.
- WS broadcast tới online users.
- Marquee FE.

#### 15.4 PR: FeatureFlag

- DB `FeatureFlag(key, value: bool, scope: 'global'|'role'|'user')`.
- Service `FeatureFlagService.isEnabled(key, context)`.
- Cache Redis 30s TTL.

#### 15.5 PR: MaintenanceWindow

- DB `MaintenanceWindow(startsAt, endsAt, message)`.
- Middleware: nếu trong window → 503 trừ `/api/healthz` + admin route.

#### 15.6 PR: ConfigVersion (snapshot)

- Mọi thay đổi config (FeatureFlag, EventConfig, balance dial) snapshot lưu `ConfigVersion(key, payloadJson, createdAt, createdBy)`.
- Rollback bằng cách revert tới version cũ.

#### 15.7 PR: Battle pass (optional, evaluate gating)

- **Gated**: chỉ build sau khi `FeatureFlag` + `EventConfig` stable + monetization policy approved.
- Catalog tier 1..30 reward. Gain XP qua daily mission + event.

### Exit criteria

- [ ] Admin có thể schedule 1 event end-to-end (create → start → progress → claim → end).
- [ ] Maintenance mode tested.
- [ ] FeatureFlag rollout 1 module thử.

### Risks

- **Config drift**: prod config khác staging. Mitigation: ConfigVersion + diff tool.
- **Battle pass = monetization**: cần policy review trước.

---

## Phase 16 — Economy & Anti-cheat

### Goal

Phát hiện + phản ứng economy abuse, không để vỡ market hoặc inflation runaway.

### Entry criteria

- Phase 9.
- Ledger 100% (mọi mutation đều ghi).

### Scope

#### 16.1 PR: Ledger checker (CLI + cron)

- Mở rộng `apps/api/scripts/audit-ledger.ts` (đã có).
- CLI: `pnpm audit:ledger --json` để CI consume.
- Cron daily: chạy + alert qua admin email/mail nếu có lệch.

#### 16.2 PR: Economy report

- Endpoint admin `GET /api/admin/economy-report?from&to`.
- Trả về: tổng linhThach in/out theo source, top 10 character với delta lớn nhất, market volume.

#### 16.3 PR: Anomaly detection

- DB model `EconomyAnomaly(kind, evidence Json, severity, status, detectedAt)`.
- Cron `economy-anomaly-scanner` scan ledger 24h, flag pattern:
  - 1 character +>X linhThach từ 1 source duy nhất.
  - 1 cặp seller-buyer wash trade > N lần.
  - Topup velocity bất thường.

#### 16.4 PR: Market price band

- Catalog `MARKET_PRICE_BAND[itemKey]` (min, max).
- List ngoài band → reject với error code `PRICE_OUT_OF_BAND`.

#### 16.5 PR: Daily reward cap

- Per character: tối đa X linhThach/day từ "soft source" (cultivation+dungeon+mission).
- Vượt → log + cap (không grant thêm).

#### 16.6 PR: Admin suspicious action alert

- Khi admin grant > X linhThach hoặc tienNgoc trong 1 lần → alert mail tới super-admin (ngăn admin compromised).

### Exit criteria

- [ ] Cron scanner chạy daily, output stored DB.
- [ ] Admin dashboard tab "Economy" hiển thị anomaly.
- [ ] Test inject 1 anomaly giả → bị flag đúng.

### Risks

- **False positive**: scanner bắt nhầm → admin mất tin tưởng. Mitigation: threshold tunable + manual review.
- **Performance**: scan 24h ledger có thể chậm. Mitigation: index `(reason, createdAt)` đã có; cân nhắc partition.

---

## Phase 17 — Production Operations

### Goal

Vận hành prod ổn định: deploy, backup, monitor, runbook, release process.

### Entry criteria

- Phase 9 (closed beta stable ≥ 1 tháng).

### Scope

#### 17.1 PR: Deploy script consolidation

- `docs/DEPLOY.md` đã có. Mở rộng script `scripts/deploy-prod.sh` với verify step (smoke + ledger check post-deploy).

#### 17.2 PR: Backup/Restore verify

- `pnpm backup:db` + `pnpm restore:db` đã có.
- Cron weekly: backup → restore vào staging → run smoke → verify.

#### 17.3 PR: Monitoring (Sentry / Pino + Loki)

- `apps/api` integrate Sentry (error tracking).
- Pino → Loki (or Datadog Logs).
- Alert rule: error rate > X/min.

#### 17.4 PR: Runbook

- File mới `docs/RUNBOOK.md`:
  - Postgres down → step gì.
  - Redis down → step gì.
  - WS gateway crash → step gì.
  - Topup payment provider down → step gì.
  - Economy anomaly P0 alert → step gì.

#### 17.5 PR: Release process (semver + tagging)

- File mới hoặc cập nhật `docs/RELEASE_NOTES.md`:
  - v0.x for closed beta.
  - v1.0 for public launch.
  - Mỗi release: migration note, seed note, rollback plan, smoke pass, known risks, balance change.

### Exit criteria

- [ ] Sentry capturing errors prod.
- [ ] Backup-restore verified weekly.
- [ ] Runbook reviewed by ≥ 2 maintainer.
- [ ] v0.6 → v1.0 release plan approved.

---

## RELEASE TRACK (semver)

| Version | Phase tracker | Mục tiêu | ETA (rough) |
|---|---|---|---|
| **v0.1** closed beta launch | Phase 9 done | First 50-100 player feedback | T0 |
| **v0.2** content scale | Phase 10 done | 80+ item, 8+ dungeon | T0+1 month |
| **v0.3** progression depth | Phase 11 done | Công pháp + alchemy + refinery | T0+2-3 months |
| **v0.4** sect 2.0 + map | Phase 12 + 13 done | Region + sect war | T0+4-5 months |
| **v0.5** arena season | Phase 14 done | First arena season run | T0+6 months |
| **v0.6** live ops | Phase 15 done | Event scheduler + battle pass evaluation | T0+7-8 months |
| **v1.0** public launch | Phase 16 + 17 done | Anti-cheat + ops + payment integration | T0+9-12 months |

**Release checklist mỗi version** (xem `docs/RELEASE_NOTES.md`):

- Migration note (nếu có).
- Seed note (nếu có).
- Rollback plan (mọi migration phải có).
- Smoke pass (smoke:beta + smoke:economy + smoke:admin).
- Known risks.
- Balance change summary.
- Admin guide update (nếu có).
- AI_HANDOFF_REPORT update.

---

## DO-NOT-BUILD-YET LIST (anti-feature-creep)

> AI/dev sau ĐỪNG build các thứ dưới đây trừ khi có user/PM yêu cầu rõ ràng + dependency đã sẵn.

| Feature | Lý do hoãn | Khi nào unlock |
|---|---|---|
| **Real-time PvP** | Tốn infra, async chưa xong | Sau Phase 14 + 1 season validation |
| **Party / co-op dungeon** | Tốn infra, async PvE đủ dùng | Sau Phase 12 + người chơi yêu cầu mạnh |
| **Pet / Wife / Companion gacha** | Loot box, legal risk | Sau Phase 16 + monetization policy + drop table DB-backed |
| **Voice chat** | Out of scope | Có thể không bao giờ |
| **Mobile native app** | PWA đủ, native = tốn rebuild | v1.0 + sau khi PWA stable |
| **NFT / blockchain** | KHÔNG | Không bao giờ |
| **Real-money market** | Legal pháp lý VN không cho | Không bao giờ |
| **Real-money trade item** | Legal | Không bao giờ |
| **Multi-region (server) sharding** | Quá đắt cho ROI | Sau v1.0 + DAU > 10k |

---

## CHANGELOG

- **2026-04-30** — Initial creation. Author: Devin AI session 9q (docs blueprint refresh).
