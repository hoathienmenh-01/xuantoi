# AI Handoff Report — Xuân Tôi

> 👉 **AI/dev mới: ĐỌC [`docs/START_HERE.md`](./START_HERE.md) TRƯỚC.** File đó định tuyến bạn tới đúng doc theo mục đích (trạng thái / vision / roadmap / economy / content / balance / live ops).

## Current Executive Summary

> **30 dòng đầu = đủ context.** Các dòng dưới `## Snapshots` là chi tiết theo session.
> **Cập nhật mỗi PR.** Nếu bạn vừa merge PR mới, sửa block này TRƯỚC, sau đó mới thêm snapshot bên dưới.

- **Current `main` commit**: `e37a71a` post PR #336 (Phase 11.1.D Cultivation method `statBonus.atk/defPercent` wire vào `CombatService.action()`). Phase 11 ~90% done — runtime persistence track (Cultivation Method + Skill Template + Linh căn + Gem + Refine + Tribulation + Buff + Talent + Title + Achievement) đều đã merge service-level B-track. UI track + một số runtime wire đã merge (xem `LONG_TERM_ROADMAP.md` §Phase 11). Còn lại: Phase 11.7.D Talent active wire + Phase 11.3.D UI Linh căn + Phase 11.2.C UI Skill book.
- **Test baseline hiện tại** (verified `pnpm test` post `e37a71a`): **api 1600 + shared 1035 + web 918 = 3553 vitest**. typecheck 3/3, lint 0 warnings, build 3/3 GREEN. Pre-existing flaky: `chat.service.test.ts > ChatService rate limit` (50ms timing window — passes on rerun, NOT regression).
- **Open PRs**: 0 (PR #336 merged thành công).
- **Immediate next tasks** (theo thứ tự khuyến nghị):
  1. **Phase 11.7.D Talent active wire** — wire active talent skill cast vào `CombatService.action(skillKey)` lookup. Fallback `getTalentDef(skillKey)` khi `skillByKey` null + validate `TalentService.listLearned` ownership + MP cost + `simulateActiveTalent` execute.
  2. **Phase 11.3.D UI Linh căn** — reroll dialog + element wheel + grade display + primary/secondary elements + purity bar.
  3. **Phase 11.2.C UI Skill book** — skill grimoire list + mastery upgrade button + tier/element filter + max 4 equipped.
  4. **Phase 11.1.C UI Cultivation Method** — equip switcher (đã merged PR #322).
  5. **Optional smoke polish**: `smoke:cultivation` / `smoke:topup` / `smoke:admin` v2 / `smoke:breakthrough`.
- **Known issues**:
  - `chat.service.test.ts > ChatService rate limit` flaky (50ms window — passes on rerun).
  - Phase 11.X.M Buff DOT runtime damage tick: ý tưởng đã wire vào `CombatService.action()` nhưng chưa stack DOT damage cumulative cross-turn (turn-based DOT chỉ áp 1 lần/turn từ active buff snapshot).
  - Talent active cooldown chưa có schema persist (talent cooldownTurns deferred — Phase 11.7.E hoặc tích hợp khi Phase 11.7.D land).
- **Do NOT build yet** (anti-feature-creep, full list trong [`LONG_TERM_ROADMAP.md`](./LONG_TERM_ROADMAP.md) cuối file):
  - Real-time PvP (cần async PvP — Phase 14 — đi trước, validate 1 season).
  - Party / co-op dungeon (cần async PvE Phase 12 + user demand).
  - Pet / Wife / Companion gacha (cần monetization policy + drop table DB Phase 16).
  - Voice chat (out of scope).
  - NFT / blockchain (KHÔNG bao giờ).
  - Real-money market / real-money trade item (legal pháp lý VN — KHÔNG bao giờ).
  - Multi-region sharding (sau v1.0 + DAU > 10k).
  - Mobile native app (sau v1.0 PWA stable).
- **Required docs to read** trước khi viết PR:
  1. [`docs/START_HERE.md`](./START_HERE.md) — cổng vào, định tuyến tới đúng doc theo mục đích.
  2. **Snapshot trên cùng** trong file này — biết PR vừa rồi đụng cái gì.
  3. [`LONG_TERM_ROADMAP.md`](./LONG_TERM_ROADMAP.md) §0 (dependency rule) + phase tương ứng.
  4. Doc chuyên biệt theo nội dung PR: economy → [`ECONOMY_MODEL.md`](./ECONOMY_MODEL.md), content → [`CONTENT_PIPELINE.md`](./CONTENT_PIPELINE.md), balance → [`BALANCE_MODEL.md`](./BALANCE_MODEL.md), live ops → [`LIVE_OPS_MODEL.md`](./LIVE_OPS_MODEL.md), vision/system → [`GAME_DESIGN_BIBLE.md`](./GAME_DESIGN_BIBLE.md).
  5. `apps/api/prisma/schema.prisma` (schema thật) + `packages/shared/src/*.ts` (catalog) nếu touch.

---

## Recent merged PRs (last 5)

- [#336 feat(combat,character): Cultivation method statBonus.atk/defPercent wire vào CombatService.action() (Phase 11.1.D)](https://github.com/hoathienmenh-01/xuantoi/pull/336) — SMALL backend-only PR wire `methodStatBonusFor(char.equippedCultivationMethodKey)` vào `CombatService.action()` `effPower`/`effDef`. 4 vitest mới. Main bumped `12976aa` → `e37a71a`. CI 5/5 GREEN.
- [#335 feat(web,achievement): Phase 11.10.F Achievement stats summary 4-badge](https://github.com/hoathienmenh-01/xuantoi/pull/335) — TINY frontend-only PR mở rộng AchievementView với 4-badge stats line (total/locked/claimable/claimed). 13 vitest mới web (905 → 918). CI 5/5 GREEN.
- [#334 docs(roadmap): mark Phase 11.6.K Tribulation history stats summary MERGED](https://github.com/hoathienmenh-01/xuantoi/pull/334) — Docs-only roadmap sync.
- [#333 feat(web,tribulation): Phase 11.6.K Tribulation history stats summary 3-badge](https://github.com/hoathienmenh-01/xuantoi/pull/333) — Frontend-only PR mở rộng TribulationView history với 3-badge stats (total/success/fail). 15 vitest mới web. CI 5/5 GREEN.
- [#332 feat(web,tribulation): Phase 11.6.J Tribulation history client-side filter (success/fail/all)](https://github.com/hoathienmenh-01/xuantoi/pull/332) — Frontend-only PR thêm segmented control filter trên history list. 22 vitest mới web. CI 5/5 GREEN.

> Older PRs (#239..#331) — see `## Archive` cuối file hoặc `git log` for full PR detail.

---

## Snapshots

> Snapshot mới nhất ở trên cùng. Mỗi PR thêm 1 snapshot mô tả: PR đụng cái gì, baseline thay đổi thế nào, risk.
> **Giữ tối đa ~5 snapshot gần nhất.** Snapshot cũ hơn — move xuống `## Archive` hoặc xóa (git log đã lưu commit message chi tiết).

> **Snapshot (session 9r-25 resume, PR IN-FLIGHT → MERGED #336 — Phase 11.1.D Cultivation method statBonus combat wire, branched on main `12976aa` → merged to `e37a71a`)**: feat/api — autonomous loop tiếp tục sau khi xác định gap mới: `CultivationMethodDef.statBonus.{atk,def,hpMax,mpMax}Percent` được khai báo cho 12 method catalog (`packages/shared/src/cultivation-methods.ts`) NHƯNG KHÔNG có consumer runtime — combat de facto bỏ qua công pháp stat bonus dù player equip method. Branch `devin/1777721013-phase-11-1-d-method-stat-combat` từ `12976aa`. SMALL backend-only PR. **Anti-duplicate verified**: `grep "methodStatBonusFor\|method.statBonus" apps/api/src` pre-edit → 0 kết quả; `grep "Phase 11.1.D" apps/api` pre-edit → 0 kết quả. **Scope** = (1) `apps/api/src/modules/character/cultivation-method.service.ts` (+34 dòng): pure helper `methodStatBonusFor(equippedMethodKey: string|null): { atkMul, defMul, hpMaxMul, mpMaxMul }` — legacy null/invalid → identity `{1,1,1,1}`; pham starter `khai_thien_quyet` (statBonus all 0%) → identity `{1,1,1,1}`; huyen kim `cuu_cuc_kim_cuong_quyet` (atk +5%, def +12%, hpMax +8%, mpMax 0%) → `{1.05, 1.12, 1.08, 1.0}`. Pattern compose-and-fail-soft khớp `methodExpMultiplierFor` (Phase 11.7.E). (2) `apps/api/src/modules/combat/combat.service.ts` (+18 dòng / -2 dòng): import `methodStatBonusFor`, sau `titleMods` compute `methodStat = methodStatBonusFor(char.equippedCultivationMethodKey)`, `effPower` multiply thêm `methodStat.atkMul` (sau title.atkMul), `effDef` multiply thêm `methodStat.defMul` (sau title.defMul). `hpMaxMul`/`mpMaxMul` defer (stat cap, không phải combat action — Phase 11.1.D scope conservative). (3) `apps/api/src/modules/combat/combat.service.test.ts` (+133 dòng, 4 vitest mới Phase 11.1.D): (a) huyen kim `cuu_cuc_kim_cuong_quyet` (atk +5%) → dmg ≥ legacy baseline; (b) huyen kim def +12% → reply HP loss ≤ legacy baseline (cùng RNG seed mocked 0.5); (c) pham starter `khai_thien_quyet` identity → dmg=19 (same as no method); (d) legacy null `equippedCultivationMethodKey` → identity dmg=19. Test setup dùng raw `prisma.character.update({ equippedCultivationMethodKey })` để set fixture (bypass `CultivationMethodService.equip` realm/element checks — không cần cho unit test fixture). **Test baseline**: api 1596 → 1600 (+4 mới Phase 11.1.D combat) + shared 1035 + web 918 = **3553 total vitest**. typecheck 3/3, lint 0 warnings, build 3/3 GREEN. **Risk** 🟢 low — pure runtime read of existing catalog field; helper fail-soft (key=null/invalid → identity 1.0); no schema; no migration; rollback trivial revert 1 file helper + 1 file wire + 4 tests. **Files changed**: `apps/api/src/modules/character/cultivation-method.service.ts` + `apps/api/src/modules/combat/combat.service.ts` + `apps/api/src/modules/combat/combat.service.test.ts` + `docs/AI_HANDOFF_REPORT.md`.

> **Snapshot (session 9r-26 part 5, PR IN-FLIGHT — Phase 11.6.H Tribulation history pagination "Load more", branched on main `dde1175`)**: feat/web — autonomous loop tiếp tục sau khi PR #329 (Phase 11.6.G) merged. Branch `devin/1777809079-phase-11-6-h-tribulation-history-pagination` từ `dde1175`. SMALL frontend-only PR mở rộng Phase 11.6.G history view với pagination "Load more" (consume cùng endpoint `GET /character/tribulation/log` đã có; backend KHÔNG đụng). **Approach** = expanding-limit (re-fetch with `?limit=N+20` thay vì offset/cursor) — server endpoint chỉ hỗ trợ `?limit` clamp [1,100]; grow incrementally tới MAX 100 → đủ cho MVP, tránh schema/backend changes. 24 vitest mới (web 844 → 868). MERGED PR #330. typecheck 3/3, lint 0 warnings, build 3/3 GREEN. **Risk** 🟢 low — pure FE additive; no backend touch; no schema; no breaking change.

> **Snapshot (session 9r-26 part 4, PR #329 MERGED — Phase 11.6.G Tribulation history view, branched on main `17071b6`)**: Frontend-only SMALL PR consume Phase 11.6.F endpoint (`GET /character/tribulation/log`) → render history list dưới TribulationView. 27 vitest web mới (817 → 844). Main bumped `17071b6` → `dde1175`. CI 5/5 GREEN. **Risk** 🟢 low — frontend additive only.

> **Snapshot (session 9r-26 part 3, PR #328 MERGED — Phase 11.6.F Tribulation log endpoint, branched on main `fc448df`)**: Backend-only SMALL PR add `GET /character/tribulation/log` endpoint return `TribulationAttemptLog` rows ordered by `attemptedAt desc` clamp `?limit=N` [1,100] default 20. Vitest cover happy path + auth gate + limit clamp. CI 5/5 GREEN.

> **Snapshot (session 9r-26 part 2, PR IN-FLIGHT — Phase 11.6.E Tribulation state expose, branched on main `dfb4ee7`)**: Backend-only SMALL PR mở rộng `CharacterService.findByUser` payload với `tribulationLatestAttempt` summary cho FE display fail/success badge ngay trên home. Vitest verify payload shape + nullable cho character chưa attempt. MERGED PR #327. CI 5/5 GREEN.

---

## Archive

> Older snapshots (PR #33..#327) collapsed — see git log + GitHub PR list for full detail. Each PR commit message contains the snapshot text written at PR-author time.
>
> Quick reference of major milestones:
> - **PR #33..#80** (sessions 1..6): Phase 0..8 MVP scaffold (auth, character, cultivation, combat, market, sect, mail, mission, ledger, admin).
> - **PR #81..#160** (sessions 7..9m): Phase 9 closed beta stabilization (smoke scripts, Playwright golden path, ledger audit, anti-cheat hardening, missions tz, daily login, gift code).
> - **PR #161..#210** (sessions 9n..9q-8): Phase 9 polish + Phase 10 prep (UI atoms, skeleton loaders, locale switcher, Playwright golden path expand to 16 spec).
> - **PR #211..#220** (sessions 9q-9..9r-8): Phase 10 content scale CLOSED (5/5 PR — items 31→81, skills 10→25, monsters 9→29 + dungeons 3→9, missions 12→66, boss 2→12).
> - **PR #221..#246** (sessions 9r-8..9r-19): Phase 11 catalog foundations (Spiritual Root, Cultivation Method, Skill Template, Gem, Refine, Tribulation, Alchemy, Talent, Buff, Title, Achievement) + early runtime persistence MVP (B-track 11.4.B/11.5.B/11.6.B/11.7.B/11.8.B/11.9.B/11.10.B).
> - **PR #247..#290** (sessions 9r-19..9r-23): Phase 11 runtime wire (`composePassiveTalentMods`/`composeBuffMods`/`composeTitleMods` vào `CombatService.action()` + `CharacterStatService.computeStats`). Catalog metadata expansion (5-element atk/def/spirit/hpMax coverage producers).
> - **PR #291..#310** (sessions 9r-24..9r-25): Phase 11 catalog expansion (5-element mpMax/mpRegen/hpRegen + damage_bonus producers) + small runtime tweaks.
> - **PR #311..#327** (session 9r-26 part 1..2): Phase 11.6.B-F Tribulation runtime + HTTP wire + UI + state expose + log endpoint. Phase 11.5.C/11.4.C/11.10.E/11.11.D UI batch (Refine UI, Gem UI, Achievement UI, Alchemy UI).
> - **PR #328..#336** (session 9r-26 part 3..9r-25 resume): Phase 11.6.F-K Tribulation history + filter + stats summary. Phase 11.10.F Achievement stats summary. Phase 11.1.D Cultivation method statBonus combat wire.

For Sections 1-19 (Project Overview, Tech Stack, Repository Structure, Backend Architecture, Frontend Architecture, Shared Package, Database / Prisma Schema, Core Gameplay Flows, WebSocket / Realtime, Economy / Ledger / Anti-Fraud, Tests, Seed Data / Balance / Content, i18n / PWA / UX, Docs, Known Issues / Risks, Missing Pages / Missing APIs, How To Run Locally, How To Promote Admin / Test Admin) — see git log for PR #33-#210 details, or read source code on `main` (which is the source of truth per [`docs/START_HERE.md`](./START_HERE.md) §0). Concrete entry points:

- **Backend**: `apps/api/src/modules/` (NestJS modules — auth, character, combat, inventory, market, sect, mission, mail, chat, admin, etc.).
- **Frontend**: `apps/web/src/views/` (Vue 3 SFC + Pinia stores in `src/stores/`).
- **Shared catalogs**: `packages/shared/src/` (skills, items, dungeons, missions, talents, titles, achievements, buffs, etc.).
- **Schema**: `apps/api/prisma/schema.prisma`.
- **WebSocket events**: `packages/shared/src/ws-events.ts` + `apps/api/src/modules/realtime/`.

## Rules For The Next AI

1. **Đọc Snapshot trên cùng + Executive Summary 30 dòng đầu trước.** Sau đó đọc [`docs/START_HERE.md`](./START_HERE.md) định tuyến.
2. **Cập nhật Executive Summary + thêm 1 Snapshot mới đầu `## Snapshots` mỗi khi merge PR.** Không append vào snapshot cũ.
3. **KHÔNG** mở phase mới khi phase hiện tại chưa đủ exit criteria (xem `LONG_TERM_ROADMAP.md` §0.2).
4. **KHÔNG** build module trong `## DO-NOT-BUILD-YET LIST` (cuối `LONG_TERM_ROADMAP.md`).
5. **Mọi currency/item mutation** PHẢI qua `CurrencyService.applyTx` / `ItemLedger` — xem `ECONOMY_MODEL.md` §3 (5 hard invariants).
6. **Mọi balance change** PHẢI nằm trong band của `BALANCE_MODEL.md` + có dial registry entry.
7. **Migration** PHẢI có rollback note + idempotency test cho reward path.
8. **PR > 500 dòng diff** phải có lý do (rare). Bias toward MEDIUM/SMALL PRs.
9. **CI phải xanh** trước khi report task complete.
10. **Đừng** sửa `docs/04_TECH_STACK_VA_DATA_MODEL.md` / `docs/05_KICH_BAN_BUILD_VA_PROMPT_AI.md` (Phase 0..8 historical blueprint — KHÔNG phải nguồn sự thật hiện tại).

## Appendix — Quick commands cheat sheet

```bash
# Setup local
pnpm install
pnpm infra:up                                   # Postgres + Redis + MinIO + Mailhog
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm --filter @xuantoi/api prisma:generate
pnpm --filter @xuantoi/api prisma:migrate
pnpm --filter @xuantoi/api bootstrap            # idempotent — admin + 3 sects
pnpm dev                                        # web :5173 + api :3000

# Test / lint / typecheck / build
pnpm test                                       # api + shared (web filtered separately)
pnpm --filter @xuantoi/web test                 # web vitest
pnpm typecheck
pnpm lint
pnpm build

# Smoke (cần dev server chạy)
pnpm smoke:beta
pnpm smoke:economy
pnpm smoke:ws
pnpm smoke:combat
pnpm smoke:admin

# Playwright golden path (cần `vite preview` ở 4173)
pnpm --filter @xuantoi/web test:e2e
E2E_FULL=1 pnpm --filter @xuantoi/web test:e2e  # full path (cần api+pg+redis chạy đồng thời)
```

## Appendix — Key file paths for quick orientation

- `apps/api/src/modules/combat/combat.service.ts` — combat encounter action flow (skill resolve, element multiplier, talent mods, buff mods, title mods, method stat bonus).
- `apps/api/src/modules/character/character.service.ts` — character core (onboard, profile, breakthrough, cultivation tick state).
- `apps/api/src/modules/character/character-skill.service.ts` — Phase 11.2.B skill mastery (learn, equip, upgrade, getEffectiveSkillFor).
- `apps/api/src/modules/character/cultivation-method.service.ts` — Phase 11.1.B method (learn, equip, methodExpMultiplierFor, methodStatBonusFor).
- `apps/api/src/modules/character/talent.service.ts` — Phase 11.7.B talent persistence (learnTalent, listLearned, getMods, getRemainingTalentPoints).
- `apps/api/src/modules/character/buff.service.ts` — Phase 11.8.B buff/debuff persistence.
- `apps/api/src/modules/character/title.service.ts` — Phase 11.9.B title persistence.
- `apps/api/src/modules/character/achievement.service.ts` — Phase 11.10.B achievement persistence + claimReward + trackEvent.
- `apps/api/src/modules/character/spiritual-root.service.ts` — Phase 11.3.A linh căn rollOnboard + getState.
- `apps/api/src/modules/inventory/inventory.service.ts` — Phase 11.4/11.5 gem socket + refine wire (`equipBonus`).
- `packages/shared/src/talents.ts` — TALENTS catalog + helpers (`getTalentDef`, `composePassiveTalentMods`, `simulateActiveTalent`).
- `packages/shared/src/buffs.ts` — BUFFS catalog + `composeBuffMods`.
- `packages/shared/src/titles.ts` — TITLES catalog + `composeTitleMods`.
- `packages/shared/src/cultivation-methods.ts` — METHODS catalog + `methodExpMultiplierFor`.
- `packages/shared/src/spiritual-roots.ts` — `SPIRITUAL_ROOT_GRADES` + `getSpiritualRootGradeDef`.
- `apps/web/src/views/` — Vue 3 SFC views (HomeView, CombatView, InventoryView, MarketView, MissionView, AchievementView, TribulationView, etc.).
- `apps/web/src/stores/` — Pinia stores (game, character, mission, etc.).
- `apps/web/src/api/` — typed API clients consume backend REST.
