# Xuân Tôi Deep Feature Audit Report

> **Author**: AI deep audit pass — Kiro session 2026-05-17.
> **Scope**: end-to-end audit of player-facing surfaces on `main`. Code is the source of truth (per `docs/AI_WORKFLOW_RULES.md` §0). Documentation gaps are noted but were not used as the authoritative claim of feature state.
> **Output**: this file is a Markdown audit report. A companion script `scripts/export-audit-docx.sh` is provided to convert it to `.docx` locally (the sandbox running this audit cannot reach `pip`/`pandoc`, so the conversion is left to the operator).

---

## 1. Executive Summary

**What is already solid (production-grade or close)**:

- Auth, onboarding (legacy), wallet, mail, inventory, market (v1 + v2 auction), shop, top-up, gift code, daily login (`DailyLoginCard`), quests, missions, NPC affinity, story dungeons, story V2 (book II–IV), tribulation flow (foundation + encounter + mini-battle), spiritual root, cultivation method v1 + v2, body cultivation, breakthrough, alchemy, skill book, talent catalog, achievements, titles, reputation, sect, sect war, territory war, world boss, world content (farm maps, dungeon hub v2, boss hub, sect content, trial tower), pets (full Phase 35.0 system), monetization (foundation + extras + dac quyen), arena (with seasons + leaderboard + rewards), pvp, social (friends + private chat + group chat + co-cultivation), mentor (foundation + milestones), returner, secret realm (Phase 34.2), daily encounter (Phase 34.1), 7-day onboarding quest (Phase 34.0), homestead, cosmetics, codex, leaderboard, support feedback / report-player / logs, notification settings (web push), seasons, settings (player experience).
- Live ops surface (announcement marquee, today panel, active events panel, maintenance overlay/banner, feature flag gating). Maintenance overlay + announcement broadcast are wired to the API.
- Admin Control Center, Event Builder, Hall of Fame, System Status, PvP, Market V2, Codex, Pets, Achievement/Reputation, Mail, Feedback, Reports admin views all real and read-only or audit-driven.

**What is still incomplete or fragile (player-visible)**:

- **`/home` luxury dashboard mixes live and mock data.** Phase 15.10 wired the *header*, *resource strip*, *stat tiles*, *sect chat*, and *mail badge* to real stores, but the bottom panels (recent quests, equipment slots, inventory panel, daily reward 6/10), the desktop feature grid badges (mail "3", missions "1"), and the mobile icon grid badges (mail "3", friends "1", equipment "1", missions "3") are still hard-coded values from `apps/web/src/data/homeDashboardMock.ts`. Any logged-in player sees the same fake numbers.
- **`/character` and `/cultivation` are *redirects*, not real surfaces.** Tapping "Nhân vật" sends the player to `/dashboard`; tapping "Tu luyện" sends them to `/cultivation-method-v2`. There is no first-class character profile screen or generic cultivation hub. The doc `docs/FRONTEND_ROUTE_MAPPING.md` still labels these as "safe placeholder", which is stale.
- **`/notifications` is a redirect to `/mail`.** Acceptable as a stopgap, but the row "Notifications center" in the route mapping doc is also stale.
- **`tuTinh` (Tử tinh) and `danhVong` (Danh vọng) currencies on `/home` are always `0`** because the backend `Character` payload does not expose those fields yet. This is server-data-missing, not a UI bug, but it is visible to players.
- **`XianxiaPlaceholderView.vue` is dead code** — no route binds it on `main`. The `FRONTEND_ROUTE_MAPPING.md` doc still refers to it as the fallback.
- **`/dev/effects-preview` is now admin-gated** (Phase 15.13 added `auth.isAdmin` guard). Confirmed safe.
- **Hero quick actions ("Tu luyện nhanh", "Nhận thưởng", "Hồi phục", "Truyền tống")** in the home hero only `router.push` to other routes; they do not call any cultivate/claim/restore action server-side. They look interactive but are pure navigation shortcuts.
- **Backend modules without dedicated player surface**: `party`, `party-dungeon`, `coop-boss`, `presence`, `system-gift`, `email`, `player-navigation`. Their FE consumption today is via embedded panels (e.g. `PartyPanel`, `CoopBossPanel`) inside other views, or implicit (no UI). A new player has no way to discover these directly.
- **Several feature cards on `/home` (e.g. "Sự kiện", "Mùa giải") link to real views but show fake "đang diễn ra" / "Mùa 7 - Huyền Thiên" text** unrelated to the live LiveOps store.

**What is risky for players right now**:

- Fake mail / friends / mission badge counts on `/home` will mislead players the moment they have **0** unread mail or **0** pending missions.
- Hard-coded "Thanh Vân Tông / 12.568.890 Linh Thạch" mock data has been removed from header/resources/stat tiles (Phase 15.10), but the rest of the dashboard panels still ship a similar VIP-flavored fake state.

**What should be fixed first (priority order)**:

1. **P0** — Wire `/home` recent quests, equipment slots, inventory panel, daily reward, feature card badges, and mobile icon grid badges to real stores; or hide them entirely if no real data is available. (Phase 15.14 follow-up to the existing 15.10–15.13 sweep.)
2. **P0** — Replace `/character` and `/cultivation` redirects with first-class views (or at minimum repoint the menu/sidebar entries to `/dashboard` and `/cultivation-method-v2` directly so the redirect intermediate is invisible) and update `docs/FRONTEND_ROUTE_MAPPING.md`.
3. **P1** — Add a `/party` (or `/coop`) dedicated surface for `party` + `party-dungeon` + `coop-boss` so the gameplay loop is discoverable.
4. **P1** — Surface `tuTinh` + `danhVong` from the backend `Character` payload (or remove the tiles).
5. **P2** — Delete `XianxiaPlaceholderView.vue` and update `FRONTEND_ROUTE_MAPPING.md`.

---

## 2. Audit Date, Branch, Commit

| Field | Value |
|---|---|
| Audit date | 2026-05-17 |
| Audit branch | `devin/audit-deep-feature-2026-05-17` |
| Base | `main` |
| Main commit SHA | `79fcc530b3177c3e057bcd0a598e305917ad51fb` |
| Last merged PR | **#621** — "Phase 15.11–15.13 Home Dashboard Polish" (merge commit message: "Merge pull request #621 from hoathienmenh-01/devin/1778967631-home-dashboard-polish") |
| PR #621 status | Merged |
| PRs after #621 | None (this audit is the first activity on `main` after #621). |

---

## 3. Route Audit Table

Routes are listed in the order they are declared in `apps/web/src/router/index.ts`. Status codes: **A** complete enough for beta · **B** partial but usable · **C** UI shell only · **D** mock/demo data still visible · **E** redirect placeholder · **F** broken or likely broken · **G** admin/dev only.

| # | Route | View / Component | Current behavior | Data source | Status | Problem | Recommended fix | Priority |
|---:|---|---|---|---|:-:|---|---|:-:|
| 1 | `/` | router redirect → `/home` | redirect | n/a | E | none | leave | — |
| 2 | `/auth` | `AuthView.vue` | login + register | `useAuthStore`, `auth` API | A | none | — | — |
| 3 | `/auth/forgot-password` | `ForgotPasswordView.vue` | email reset form | `auth` API | A | none | — | — |
| 4 | `/auth/reset-password` | `ResetPasswordView.vue` | reset with token | `auth` API | A | none | — | — |
| 5 | `/home` | `HomeView.vue` + `XTHomeDashboard.vue` | tabs Overview / Events / Character + luxury dashboard | `useGameStore`, `useStoryDungeonStore`, `useBadgesStore`, `homeDashboardMock` (legacy) | **D** | recent quests / equipment slots / inventory panel / daily reward / feature card badges / mobile icon grid badges still mock | wire to real stores or hide | **P0** |
| 6 | `/character` | redirect → `/dashboard` | redirect | n/a | E | menu/sidebar still labels this "Nhân vật"; doc says "safe placeholder" but actually redirects | repoint nav directly to `/dashboard` and remove redirect; or build a real Character profile view | **P0** |
| 7 | `/cultivation` | redirect → `/cultivation-method-v2` | redirect | n/a | E | menu/bottom-nav labels "Tu luyện"; redirect lands on Method V2, not a generic cultivation hub | repoint nav, or build a "Tu luyện" hub aggregating breakthrough + body + method + spiritual root | **P0** |
| 8 | `/onboarding` | `OnboardingView.vue` | name + sect choice → `onboard()` | `character` API, `useAuthStore` | A | — | — | — |
| 9 | `/dungeon` | `DungeonView.vue` | dungeon list | `combat`/`dungeon` API | A | — | — | — |
| 10 | `/dungeon-run` | `DungeonRunView.vue` | active run + claim | `dungeonRun` store | A | — | — | — |
| 11 | `/roguelike` | `RoguelikeView.vue` | roguelike realms | `roguelike` store | A | — | — | — |
| 12 | `/roguelike-realms` | redirect → `/roguelike` | redirect | n/a | E | none | leave | — |
| 13 | `/seasons` | `SeasonsView.vue` | server seasons + leaderboards + claim | `seasons` store | A | — | — | — |
| 14 | `/story-dungeons` | `StoryDungeonView.vue` | story dungeon catalog + run | `storyDungeon` store | A | — | — | — |
| 15 | `/inventory` | `InventoryView.vue` | inventory + equip + sockets + refine + reforge | `inventory`, `loadout`, `phapBao` API | A | — | — | — |
| 16 | `/equipment` | redirect → `/inventory` | redirect | n/a | E | nav still says "Trang bị"; user expects dedicated equipment screen | repoint or build separate `EquipmentView` | **P2** |
| 17 | `/loadouts` | `LoadoutView.vue` | loadout presets | `loadout` API | A | — | — | — |
| 18 | `/notification-settings` | `NotificationSettingsView.vue` | web push toggles | `webPush` API | A | — | — | — |
| 19 | `/market` | `MarketView.vue` | market v1 (sell/buy) + price band | `market` API, `inventory` API | A | — | — | — |
| 20 | `/auction` | redirect → `/market` (gated) | redirect with `featureFlagGuard('AUCTION_HOUSE_ENABLED')` | n/a | E | feature flag also flips Market V2; OK | leave | — |
| 21 | `/shop` | `ShopView.vue` | NPC shop list + buy | `shop` API | A | — | — | — |
| 22 | `/sect` | `SectView.vue` | join/create/contribute, list, mine | `sect` API | A | — | — | — |
| 23 | `/sect-war` | `SectWarView.vue` | sect war activity | `sectWar` API + leaderboard | A | — | — | — |
| 24 | `/territory` | `TerritoryView.vue` | territory list, leaderboards, war tab | `territory` store | A | — | — | — |
| 25 | `/boss` | `BossView.vue` | active bosses + attack with skill | `boss` + `combat` API | A | — | — | — |
| 26 | `/missions` | `MissionView.vue` | daily / weekly missions, claim | `mission` API + WS | A | — | — | — |
| 27 | `/mail` | `MailView.vue` | inbox, claim, claim-all | `mail` API | A | — | — | — |
| 28 | `/giftcode` | `GiftCodeView.vue` | redeem code | `giftcode` API | A | — | — | — |
| 29 | `/topup` | `TopupView.vue` | bank packages + history | `topup` API | A | — | — | — |
| 30 | `/monetization` | `MonetizationView.vue` | wallet + extras overview | `monetization` API | A | — | — | — |
| 31 | `/wallet` | `WalletView.vue` | 6-currency grid + ledger + entitlements | `monetization` API | A | — | — | — |
| 32 | `/monetization-shop` | `MonetizationShopView.vue` | shop products by type | `monetization` API | A | — | — | — |
| 33 | `/dac-quyen` | `MonetizationDacQuyenView.vue` | 7-tab privilege overview | `monetizationSystems` store | A | — | — | — |
| 34 | `/shop-packs` | `ShopPacksView.vue` | limited resource packs | `shopPacks` API | A | — | — | — |
| 35 | `/cosmetics` | `CosmeticView.vue` | wardrobe (titles, auras, frames) | `cosmetics` store | A | — | — | — |
| 36 | `/admin` | `AdminView.vue` | full admin console | many admin APIs | G | players cannot navigate to it (sidebar entry is `staffOnly`); BE guard exists | leave | — |
| 37 | `/admin/control-center` | `AdminControlCenterView.vue` | 6-tab control center | `adminControlCenter` API | G | comment says "form editor sẽ ở PR2 — chỉ read-only + validator demo cho admin" | continue PR2-6 per `ADMIN_GUIDE.md` §13.4 | — |
| 38 | `/admin/event-builder` | `AdminEventBuilderView.vue` | 8-tab event builder | `eventBuilder` API | G | read-only foundation; full form editor still pending | continue per Phase 28.0 followup | — |
| 39 | `/events` | `EventsView.vue` | active events + personal milestones | `eventBuilder` API | A | — | — | — |
| 40 | `/pvp` | `PvpView.vue` | policy + defense + challenge + battle log | `pvp` API | A | — | — | — |
| 41 | `/admin/pvp` | `AdminPvpCenterView.vue` | admin pvp ops | `pvp` admin API | G | — | — | — |
| 42 | `/market-v2` | `MarketV2View.vue` | auction v2 + claim box | `marketV2` API (gated) | A | — | — | — |
| 43 | `/codex` | `CodexView.vue` | bestiary / guidebook | `codex` API | A | — | — | — |
| 44 | `/admin/market-v2` | `AdminMarketV2View.vue` | admin auction ops | `marketV2` admin API | G | — | — | — |
| 45 | `/admin/codex` | `AdminCodexView.vue` | admin codex audit | `codex` admin API | G | — | — | — |
| 46 | `/admin/achievement-reputation` | `AdminAchievementReputationView.vue` | admin achievement/reputation read-only | `admin/achievement-reputation` API | G | — | — | — |
| 47 | `/pets` | `PetsView.vue` | 6-tab pet system | `pet` API | A | — | — | — |
| 48 | `/admin/pets` | `AdminPetsView.vue` | admin pet ops | `pet` admin API | G | — | — | — |
| 49 | `/profile/:id` | `ProfileView.vue` | public profile + cosmetic loadout | `character` + `cosmetics` API | A | — | — | — |
| 50 | `/activity` | `ActivityView.vue` | self audit log (currency / item) | `logs` API | A | — | — | — |
| 51 | `/leaderboard` | `LeaderboardView.vue` | power / topup / sect leaderboards | `leaderboard` API | A | — | — | — |
| 52 | `/arena` | `ArenaView.vue` | arena profile / season / leaderboard / rewards / opponents / history / last-result | `arena` store | A | — | — | — |
| 53 | `/settings` | `SettingsView.vue` | account, password, locale, theme, audio, player settings, logout-all | `auth`, `playerExperience`, `playerSettings` | A | — | — | — |
| 54 | `/talents` | `TalentCatalogView.vue` | talent catalog + learn | `talents` store | A | — | — | — |
| 55 | `/alchemy` | `AlchemyView.vue` | recipes + craft + sources | `alchemy` store | A | — | — | — |
| 56 | `/homestead` | `HomesteadView.vue` | homestead resource production | `homestead` store | A | — | — | — |
| 57 | `/cultivation-method` | `CultivationMethodView.vue` | learned methods + equip | `cultivationMethod` store | A | — | — | — |
| 58 | `/artifact-v2` | `ArtifactV2View.vue` | artifact v2 (pháp bảo) progression | `artifactsV2` API | A | — | — | — |
| 59 | `/cultivation-method-v2` | `CultivationMethodV2View.vue` | method v2 progression | `cultivationMethodV2` store | A | — | — | — |
| 60 | `/body-cultivation` | `BodyCultivationView.vue` | body cultivation parallel axis | `bodyCultivation` store | A | — | — | — |
| 61 | `/spiritual-root` | `SpiritualRootView.vue` | linh căn + element build hint | `spiritualRoot` store | A | — | — | — |
| 62 | `/skill-book` | `SkillBookView.vue` | learned skills + tags + element identity | `skill` store | A | — | — | — |
| 63 | `/skills` | redirect → `/skill-book` | redirect | n/a | E | none | leave | — |
| 64 | `/methods` | redirect → `/cultivation-method` | redirect | n/a | E | none | leave | — |
| 65 | `/cultivation-methods` | redirect → `/cultivation-method` | redirect | n/a | E | none | leave | — |
| 66 | `/spiritual-roots` | redirect → `/spiritual-root` | redirect | n/a | E | none | leave | — |
| 67 | `/achievements` | `AchievementView.vue` | achievement list + claim | `achievements` store | A | — | — | — |
| 68 | `/titles` | `TitleView.vue` | title list + equip | `titles` API | A | — | — | — |
| 69 | `/reputation` | `ReputationView.vue` | reputation + long-term goals | `reputationGoals` store | A | — | — | — |
| 70 | `/tribulation` | `TribulationView.vue` | thiên kiếp encounter / mini battle | `tribulation` store | A | — | — | — |
| 71 | `/breakthrough` | `BreakthroughView.vue` | breakthrough flow | `breakthrough` store | A | — | — | — |
| 72 | `/npcs` | `NpcView.vue` | NPC list + dialogue + affinity | `npc`, `npcAffinity`, `storyDialogue` stores | A | — | — | — |
| 73 | `/quests` | `QuestView.vue` | quest list (main/side/branch/hidden/realm/sect/npc/grind) + accept + claim | `quest` store | A | — | — | — |
| 74 | `/story-v2` | `StoryV2View.vue` | story V2 (Quyển II–IV) | `storyV2` store (gated) | A | — | — | — |
| 75 | `/onboarding-quest` | `OnboardingQuestView.vue` | 7-day onboarding quest | `onboardingQuest` store | A | — | — | — |
| 76 | `/encounter` | `EncounterView.vue` | daily random encounter | `dailyEncounter` store | A | — | — | — |
| 77 | `/secret-realm` | `SecretRealmView.vue` | secret realm runs | `secretRealm` store | A | — | — | — |
| 78 | `/secret-realms` | redirect → `/secret-realm` | redirect | n/a | E | none | leave | — |
| 79 | `/spirit-pets` | redirect → `/pets` | redirect | n/a | E | none | leave | — |
| 80 | `/notifications` | redirect → `/mail` | redirect | n/a | E | nav says "Thông Báo"; user expects an in-game notification list separate from mail | build `NotificationsView` consuming `notifications` store + WS, or rename nav entry to "Hộp Thư" | **P2** |
| 81 | `/inventory-auto-sort` | `InventoryAutoSortView.vue` | qol auto-sort settings | `inventory` API | A | — | — | — |
| 82 | `/social` | `SocialView.vue` | friends / private chat / group chat / co-cultivation | `social`, `chatPrivate`, `chatGroup`, `coCultivation` stores | A | — | — | — |
| 83 | `/mentor` | `MentorView.vue` | mentor + milestones | `mentor` API | A | — | — | — |
| 84 | `/returner` | `ReturnerView.vue` | returner reward state | `returner` API | A | — | — | — |
| 85 | `/admin/mail` | `AdminMailView.vue` | admin mail ops | `adminMail` API | G | — | — | — |
| 86 | `/world` | `WorldContentView.vue` | world content summary | `worldContent` store | A | — | — | — |
| 87 | `/world/farm-maps` | `FarmMapView.vue` | farm session start + claim | `worldContent` store | A | — | — | — |
| 88 | `/world/dungeons` | `DungeonHubV2View.vue` | dungeon hub v2 | `worldContent` store | A | — | — | — |
| 89 | `/dungeons` | redirect → `/world/dungeons` | redirect | n/a | E | none | leave | — |
| 90 | `/world/bosses` | `BossHubView.vue` | world boss hub | `worldContent` store | A | — | — | — |
| 91 | `/world/sect` | `SectContentView.vue` | sect dungeons + sect bosses | `worldContent` store | A | — | — | — |
| 92 | `/world/towers` | `TrialTowerView.vue` | trial towers | `worldContent` store | A | — | — | — |
| 93 | `/tower` | redirect → `/world/towers` | redirect | n/a | E | none | leave | — |
| 94 | `/dashboard` | `DashboardView.vue` | dashboard hero + quick actions + checklist + featured | `playerExperience` API | A | — | — | — |
| 95 | `/support/feedback` | `FeedbackView.vue` | feedback form | `playerExperience` API | A | — | — | — |
| 96 | `/support/report-player` | `ReportPlayerView.vue` | report-player form | `playerExperience` API | A | — | — | — |
| 97 | `/support/logs` | `PlayerLogsView.vue` | self logs | `playerExperience` API | A | — | — | — |
| 98 | `/admin/feedback` | `AdminFeedbackView.vue` | admin feedback | admin API | G | — | — | — |
| 99 | `/admin/reports` | `AdminReportsView.vue` | admin reports | admin API | G | — | — | — |
| 100 | `/dev/effects-preview` | `EffectsPreviewView.vue` | effect preview (admin gated) | `playerExperience` API | G | non-admin sees forbidden empty state (Phase 15.13) | leave | — |
| 101 | `/admin/system-status` | `AdminSystemStatusView.vue` | admin health/version/error/integrity | `systemStatus` API | G | — | — | — |
| 102 | `/admin/hall-of-fame` | `AdminHallOfFameView.vue` | sect season hall of fame | `adminSectSeason` API | G | — | — | — |
| 103 | `/:pathMatch(.*)*` | `NotFoundView.vue` | 404 | n/a | A | — | — | — |

---

## 4. Player-Facing Feature Audit

### 4.1 Home Dashboard (`/home`)

- **Status**: **D — mock/demo data still visible** alongside live data.
- **What works**:
  - Hero player header (name, realm full name, "Bậc N", power) is wired to `useGameStore.character` and falls back to `'—'` when empty.
  - Resource strip shows real `linhThach` and `tienNgoc` from store.
  - Stat tiles desktop (6 ô) and mobile (4 ô) read tu vi (exp), lực chiến (power), linh thạch, tiên ngọc, sect (from `useGameStore.currentSect`).
  - Sect chat panel loads `chatHistory('SECT')`, subscribes to WS `chat:msg`, sends via `chatSendSect` (Phase 15.11).
  - Mail badge wired to `game.unreadMail`.
  - `XTHomeDashboard.vue` is mounted under `chrome="embedded"`, so AppShell sidebar/topbar/bottom-nav are not duplicated.
  - `Overview` tab keeps `DailyLoginCard`, `OnboardingChecklist`, `NextActionPanel`, `LiveOpsActiveEventsPanel`, `LiveOpsTodayPanel`, `LiveOpsAnnouncementMarquee`, `LiveOpsNotice`. All wired.
- **What is missing**:
  - **Recent quests panel** still reads `recentQuests` from `homeDashboardMock.ts` ("Đột Phá Đại Thừa Đại Thừa Kỳ Bậc 10", "Linh Thú Xuất Thế", etc.). It is rendered for *every* player regardless of their actual quest state.
  - **Equipment slots** (helm +12, weapon +10, ring +11 …) are mock and unrelated to inventory store.
  - **Inventory panel** (`86 / 120 capacity`, gear power `2.156.780`) is mock.
  - **Daily reward** card on the hero (`claimed 6 / 10`, "Mở rương") is mock — the real daily login claim lives in `DailyLoginCard` lower in the page.
  - **Feature grid badges** ("Nhiệm vụ" badge `1`, "Boss & Phụ bản" badge `1`, "Mail" badge `3`) are mock. They look like live counters but never change.
  - **Mobile icon grid badges** (mail `3`, friends `1`, equipment `1`, missions `3`) mock.
  - **Hero quick actions** ("Tu luyện nhanh", "Nhận thưởng", "Hồi phục", "Truyền tống") are pure `router.push` shortcuts; no server action wired.
  - **`tuTinh` (Tử tinh)** and **`danhVong` (Danh vọng)** are always `0` because the backend `Character` payload does not include them.
  - **Sect panel members** is rendered as `${sect.memberCount}` raw (no `/sect.maxMembers`); empty fallback `'0 / 0'`.
- **What may be wrong**:
  - The mock badges actively deceive new players ("you have 3 unread mail" when they actually have 0).
  - Mock recent quests can confuse new players who haven't unlocked Đại Thừa Kỳ.
- **Real data vs mock**: ~50% real, ~50% mock.
- **Files inspected**:
  - `apps/web/src/views/HomeView.vue`
  - `apps/web/src/components/xianxia/XTHomeDashboard.vue`
  - `apps/web/src/components/xianxia/XTHomeQuestPanel.vue`, `XTHomeInventoryPanel.vue`, `XTHomeSectChatPanel.vue`, `XTHomeFeatureGrid.vue`, `XTHomeStatTiles.vue`, `XTHomeHeroBanner.vue`, `XTHomeMobileHero.vue`, `XTHomeMobileHeader.vue`, `XTHomeTopBar.vue`
  - `apps/web/src/data/homeDashboardMock.ts`
  - `apps/web/src/stores/game.ts`
- **Recommended PR**: **PR-A1** (P0) "Wire `/home` bottom panels + feature grid + mobile icon grid badges to real stores".

### 4.2 Character (`/character`)

- **Status**: **E — redirect placeholder** (to `/dashboard`).
- **What works**: Redirect resolves to a real Dashboard view.
- **What is missing**: No first-class character profile screen showing realm, EXP curve, full attribute breakdown, equipped cosmetic loadout, equipment summary, talents, achievements, badges. A player who taps "Nhân vật" expects a profile page.
- **What may be wrong**: `docs/FRONTEND_ROUTE_MAPPING.md` calls this row "safe placeholder" but the router actually redirects (router.ts line 78–82) — the doc is stale.
- **Real data vs mock**: n/a (no own view).
- **Files inspected**: `router/index.ts`, `FRONTEND_ROUTE_MAPPING.md`, `XianxiaPlaceholderView.vue` (orphaned).
- **Recommended PR**: **PR-A2** (P0) "Replace `/character` redirect with a real `CharacterProfileView` (or repoint nav/sidebar straight to `/dashboard` and remove redirect)".

### 4.3 Cultivation (`/cultivation`)

- **Status**: **E — redirect placeholder** (to `/cultivation-method-v2`).
- **What works**: redirect goes to real Method V2 view.
- **What is missing**: No "Tu luyện" hub aggregating breakthrough + body cultivation + cultivation method + spiritual root + skill book in one entry point.
- **What may be wrong**: Same stale mapping doc.
- **Recommended PR**: **PR-A3** (P0) "Build `/cultivation` hub view aggregating cultivation surfaces, or repoint nav directly to `/cultivation-method-v2`".

### 4.4 Inventory (`/inventory`)

- **Status**: **A — complete enough for beta**.
- **What works**: full inventory list + filter by kind + sort presets + equip/unequip + socket gem + combine gem + refine + reforge + lock/unlock + use item + auto-sort entrypoint. Wires to `inventory` API + `loadout` API. Bottom sheet filter UI.
- **What is missing**: nothing critical.
- **Real data**: yes.
- **Files inspected**: `InventoryView.vue`, `apps/web/src/api/inventory.ts`, `apps/web/src/components/EquipmentBuildPanel.vue`, `EquipmentEconomyPanel.vue`, `EquipmentUpgradePanel.vue`, `PhapBaoPanel.vue`.

### 4.5 Equipment (`/equipment`)

- **Status**: **E — redirect placeholder** (to `/inventory`).
- **What works**: redirect.
- **What is missing**: nav entry "Trang bị" routes to inventory directly. Equipment-only filtered view (slot grid + ranking by power) is not separated.
- **Recommended PR**: **PR-A4** (P2) "Either repoint nav to `/inventory?kind=WEAPON,ARMOR,...` or add a dedicated `EquipmentView`".

### 4.6 Missions / Quests

- **Status**: **A — complete enough for beta** (both `/missions` and `/quests`).
- **What works**:
  - `/missions`: daily / weekly missions with WS-based real-time progress (`mission:progress` frame), claim, daily-cap toast.
  - `/quests`: main / side / branch / hidden / realm / sect / npc / grind quests with accept + claim + dungeon hint + relationship chain badge.
- **Real data**: yes.

### 4.7 Story

- **Status**: **A — complete enough for beta**.
- **Surfaces**:
  - `/npcs` — NPC list + dialogue modal (legacy + story_v2).
  - `/quests` — quest list.
  - `/story-dungeons` — story dungeon catalog + run + dialogue + reward modal.
  - `/story-v2` — Quyển II–IV story (gated by `STORY_V2_ENABLED`).
  - `/onboarding-quest` — 7-day onboarding.
- **What is missing**: chapter map / world map view to visualize story progression. Currently scattered across NPC + quest + story-v2 views.
- **Recommended PR**: optional **PR-A5** (P3) "Add `StoryMapView` aggregating the 27 chapters with completion progress."

### 4.8 Daily Loop

- **Status**: **A**.
- **Components**: `DailyLoginCard.vue`, `LiveOpsTodayPanel.vue`, `OnboardingChecklist.vue`, `NextActionPanel.vue`, `EncounterView.vue`, `LiveOpsActiveEventsPanel.vue`. All wired.
- **Note**: hero `dailyReward` widget on `XTHomeDashboard` is a mock 6/10 strip and *not* the real `DailyLoginCard`. See §4.1.

### 4.9 Notifications / Mail

- **Status**: `/mail` **A**, `/notifications` **E**, `/notification-settings` **A**.
- **Issue**: `/notifications` redirects to `/mail`. Mail is in-game system mail with rewards; modern game UX expects a separate "notifications" feed (boss spawn, friend request, mention, achievement unlocked) — currently those signals only surface as toast / WS push / `NotificationBell` component. There is no list view.
- **Recommended PR**: **PR-A6** (P2) "Build a real `NotificationsView` consuming `useNotificationStore` (already exists in `apps/web/src/stores/notifications.ts`) + WS feed."

### 4.10 Sect

- **Status**: **A**. Join, create, leave, contribute, view detail, mine. `/sect-war` works. `/world/sect` (sect content) works.

### 4.11 Sect Chat

- **Status**: **A** (Phase 15.11). Surfaced in `XTHomeSectChatPanel` on `/home` + global `ChatPanel` right rail (toggle WORLD/SECT). Players not in a sect see disabled input + empty state.

### 4.12 World Chat

- **Status**: **A**. Surfaced via `apps/web/src/components/shell/ChatPanel.vue`. WS pubsub + send + history.

### 4.13 Boss / Dungeon

- **Status**: **A**. `/boss`, `/world/bosses`, `/world/dungeons`, `/dungeon`, `/dungeon-run` are all wired. Element identity tooltip works. Coop boss surfaces via `CoopBossPanel.vue` but is **not exposed via a top-level route** — see §8.

### 4.14 PvP / Arena

- **Status**: **A**. `/arena` wired with seasons/standing/leaderboard/reward preview/last-result/history; `/pvp` wired with policy/defense/challenge/battle log. Feature flag `ARENA_ENABLED` gating recognized.

### 4.15 Market / Auction

- **Status**: **A**. `/market` (v1) + `/market-v2` (v2 auction + claim box + price snapshots) both wired. `/auction` redirect handled by feature flag guard.

### 4.16 Shop / Topup / Wallet

- **Status**: **A**. `/shop`, `/shop-packs`, `/monetization-shop`, `/dac-quyen`, `/monetization`, `/wallet`, `/topup`, `/giftcode` all wired.

### 4.17 Pets

- **Status**: **A** (Phase 35.0). `/pets` 6-tab full system wired. `/admin/pets` admin view ready.

### 4.18 Achievements / Titles / Reputation

- **Status**: **A**. `/achievements`, `/titles`, `/reputation` (long-term goals). Phase 46.0 catalog complete.

### 4.19 Events / Seasons

- **Status**: **A**. `/events` (event builder + personal milestones) + `/seasons` (server seasons) wired.

### 4.20 Onboarding

- **Status**: **A**. `/onboarding` legacy 4-step funnel + `/onboarding-quest` 7-day wired.

### 4.21 Social / Friends / Mentor

- **Status**: **A**. `/social` (friends, private chat, group chat, co-cultivation), `/mentor`, `/returner` all wired.
- **What is missing**: no "online friends" presence widget on `/home`. `presence` BE module exists; only consumed via `PublicPlayerProfileModal` for the current state.
- **Recommended PR**: **PR-A7** (P3) "Add online presence indicator on social tab" — optional polish.

### 4.22 Settings / Profile

- **Status**: **A**. `/settings` (theme, audio, locale, password, player settings, font/appearance/number-format/compact/reduce-motion/effect settings, logout-all). `/profile/:id` public profile view.

---

## 5. Mock / Demo / Fake Data Audit

> All paths relative to `apps/web/src/data/homeDashboardMock.ts` unless otherwise noted.

| File | Exported variable / component | Fake values | Visible on player route? | Recommended replacement source |
|---|---|---|---|---|
| `apps/web/src/data/homeDashboardMock.ts` | `recentQuests` | "Đột Phá Đại Thừa", "Linh Thú Xuất Thế", "Nhiệm Vụ Tông Môn" 14/20, "Tu Luyện Hằng Ngày" 85/120 | **Yes — `/home` `XTHomeQuestPanel`** | `useQuestStore` filtered by ACCEPTED + COMPLETED, top 4 |
| `apps/web/src/data/homeDashboardMock.ts` | `equipmentSlots` | helm +12, amulet +12, armor +11, ring +11, weapon +10, boots +10 | **Yes — `/home` `XTHomeInventoryPanel`** | `useInventoryStore` equipped rows mapped by slot |
| `apps/web/src/data/homeDashboardMock.ts` | `inventoryPanel` | `capacity 86/120`, `gearPower 2.156.780` | **Yes — `/home` `XTHomeInventoryPanel`** | `inventory.length` + `summarizeEquipmentBuild()` |
| `apps/web/src/data/homeDashboardMock.ts` | `dailyReward` | `claimed 6 / 10`, label "Phúc lợi hôm nay", cta "Mở rương" | **Yes — `/home` `XTHomeHeroBanner`** | `useDailyLoginStore` (BE: `daily-login` module). Or hide and rely on `DailyLoginCard` below |
| `apps/web/src/data/homeDashboardMock.ts` | `featureCards[].badge` | mail badge `3`, missions `1`, boss `1` | **Yes — `/home` `XTHomeFeatureGrid` desktop** | `useGameStore.unreadMail`, `useBadgesStore.missionClaimable`, `useBadgesStore.bossActive` |
| `apps/web/src/data/homeDashboardMock.ts` | `mobileIconGrid[].badge` | missions `3`, equipment `1`, mail `3`, friends `1` | **Yes — `/home` `XTHomeFeatureGrid` mobile** | same store sources as above |
| `apps/web/src/data/homeDashboardMock.ts` | `heroQuickActions` | claim-reward badge `1` (cosmetic) | Yes — `/home` hero | wire to real reward count or remove badge |
| `apps/web/src/data/homeDashboardMock.ts` | `heroBanner.subtitle/tagline` | "Cửu Thiên Mộng", "Tu chí vô thượng, độc tôn cửu thiên" | Yes — `/home` | leave (purely cosmetic copy) |
| `apps/web/src/data/homeDashboardMock.ts` | `sidebarGroups` | static labels + paths + hardcoded badge counts (mail `3`, missions `1`, activity `1`) | **No** in production (`HomeView` mounts `chrome="embedded"`); rendered only when component is used `chrome="standalone"` (preview/dev) | n/a — already isolated, but should still be deleted to avoid leakage |
| `apps/web/src/data/homeDashboardMock.ts` | `bottomNavItems` | character badge `1` | **No** in production (standalone preview only) | n/a — keep doc-block notice |
| `apps/web/src/data/homeDashboardMock.ts` | `sectPanel.title` | "Tông môn & Đạo hữu" | Yes — `/home` `XTHomeSectChatPanel` (used as title prop) | i18n key |
| `XTHomeDashboard.vue` `liveResources.tuTinh.value`, `liveResources.danhVong.value` | always `'0'` | hardcoded zero (BE has no field) | Yes — `/home` resource strip | extend `Character` payload OR remove tiles |
| `XTHomeDashboard.vue` `liveStatTiles[4]` (danhVong) and `liveStatTilesMobile[2]` (danhVong) | always `'0'` | hardcoded zero | Yes — `/home` stat tiles | same |
| `apps/web/src/components/xianxia/XianxiaPlaceholderView.vue` | n/a | view body still says "Chức năng đang được phát triển" | **No** — no router entry | delete file, fix `FRONTEND_ROUTE_MAPPING.md` |
| `apps/web/src/components/visual-effects/EffectPreviewPanel.vue` | demo effect events | "demo" sample events | Only `/dev/effects-preview` (admin-gated) | leave — admin-only |

---

## 6. Placeholder / Redirect / Shell-Only Audit

Routes that are not real first-class views yet:

| Route | Class | Resolves to | Recommendation |
|---|---|---|---|
| `/character` | redirect | `/dashboard` | **P0** — build a real `CharacterProfileView` or repoint nav directly. |
| `/cultivation` | redirect | `/cultivation-method-v2` | **P0** — build cultivation hub or repoint nav. |
| `/notifications` | redirect | `/mail` | **P2** — build `NotificationsView` (notifications store already exists). |
| `/equipment` | redirect | `/inventory` | **P2** — repoint nav or build dedicated equipment view. |
| `/skills`, `/methods`, `/cultivation-methods`, `/spiritual-roots`, `/secret-realms`, `/spirit-pets`, `/dungeons`, `/tower`, `/roguelike-realms` | redirect (alias) | live views | leave; aliases are fine. |
| `/auction` | redirect (gated) | `/market` | leave; flag-aware. |
| `XianxiaPlaceholderView.vue` (file) | dead view | n/a | **P2** — delete file; update `FRONTEND_ROUTE_MAPPING.md`. |

---

## 7. Broken or Risky Behavior

> Severity: **P0** = player sees broken/fake/wrong behavior now · **P1** = core gameplay incomplete · **P2** = important polish · **P3** = nice-to-have.

| # | Surface | Issue | Severity |
|---|---|---|---|
| 1 | `/home` desktop feature grid + mobile icon grid | Hard-coded badge counts (mail "3", missions "1/3", boss "1", friends "1", equipment "1") visible to **every** logged-in player. Players with 0 unread mail still see "3 thư chưa đọc". | **P0** |
| 2 | `/home` recent quests | Mock list ("Đột Phá Đại Thừa Đại Thừa Kỳ Bậc 10" 9/10) shown to every player — actively misleading new players. | **P0** |
| 3 | `/home` equipment slots | Shows fake "+12 helm / +10 weapon" silhouette even for naked Luyện Khí player. | **P0** |
| 4 | `/home` inventory panel | "86/120 capacity, 2.156.780 gear power" hard-coded; ignores real inventory. | **P0** |
| 5 | `/home` daily reward strip on hero | Hard-coded `claimed 6/10` "Mở rương". Real `DailyLoginCard` is rendered separately below in Overview tab — duplicate UX, conflicting state. | **P0** |
| 6 | `/home` stat tiles `danhVong`, resources `tuTinh` + `danhVong` | Always `0` because BE `Character` payload lacks fields. | **P1** |
| 7 | `/character` and `/cultivation` redirects | Player intent ("show me my character / show me cultivation") lands on partial replacements. | **P0** |
| 8 | `/notifications` redirect | Player expects an in-game notification list; gets the mail inbox. | **P2** |
| 9 | `XianxiaPlaceholderView.vue` | Dead file referenced as the "fallback" by `FRONTEND_ROUTE_MAPPING.md` but no route binds it. | **P3** |
| 10 | `FRONTEND_ROUTE_MAPPING.md` | Out of date relative to `router/index.ts` (still lists `/character`, `/cultivation`, `/notifications` as "safe placeholder"). | **P2** |
| 11 | Hero quick actions on `/home` | `'fast-cultivate'`, `'restore'`, `'teleport'` look like actions but only `router.push`. Players may expect a one-click cultivate toggle / HP-restore from there. | **P2** |
| 12 | `XTHomeDashboard` `liveSectPanel.members` | Renders `${sect.memberCount}` raw (no `/maxMembers`), and `'0 / 0'` placeholder when no sect. UI looks like "0 thành viên" rather than empty-state. | **P2** |
| 13 | `XTHomeSectChatPanel` `info.title` | Uses `sectPanelMock.title = "Tông môn & Đạo hữu"` (Vietnamese-only literal pulled from mock file) | **P3** |
| 14 | `coop-boss` + `party` + `party-dungeon` | No top-level entry in nav; only reachable via inline panels in dungeon/sect flows. New players cannot find these systems. | **P1** |
| 15 | `notifications` store + WS feed | Backend support exists (`notification` + `web-push` modules) but no list view; only `NotificationBell` and toast. | **P2** |
| 16 | `/admin/event-builder` form editor | Code comment says "form editor sẽ ở PR2"; admin sees a read-only foundation. | **P3** (admin) |
| 17 | `/admin/control-center` form editor | Code comment says "form editor sẽ ở PR2 — chỉ read-only + validator demo". | **P3** (admin) |
| 18 | i18n parity | Some labels in `XTHomeDashboard` and `homeDashboardMock` (`'Tông môn'`, `'Linh thạch'`, `'Phúc lợi hôm nay'`) are Vietnamese-only string literals, not i18n keys. EN locale players see them in Vietnamese. | **P2** |
| 19 | CI / Playwright | Phase 15.11–15.13 follow-up note in handoff: world chat Playwright test conflicted with sect chat send button (resolved by changing aria-label). Watch for regression if test selectors change. | **P3** |
| 20 | `playerExperience` `EffectsPreviewView` | Admin gate added in Phase 15.13. Verify CI test (`EffectsPreviewView.test.ts`) is included and stable. | **P3** |

---

## 8. Backend Exists but Frontend Missing

| Backend module | Endpoint root | Missing player frontend | Recommended UI |
|---|---|---|---|
| `party` | `/party/*` (create/join/leave/listInvites/sendInvite) | No `/party` route. Only `PartyPanel.vue` is mounted from inside other views (e.g. dungeon flow). | Add `/party` view with tabs: My Party / Browse / Invites. |
| `party-dungeon` | `/party-dungeon/*` | Surfaced only via `PartyDungeonPanel.vue` inside dungeon views. | Add a `Dungeon → Party` tab linking to the panel. |
| `coop-boss` | `/coop-boss/*` (combine BE service + `CoopWeeklyLeaderboardPanel.vue`) | Surfaced only via `CoopBossPanel.vue`. Weekly leaderboard panel exists but no dedicated route. | Add `/coop` route with the panel + leaderboard tab. |
| `presence` | WS + REST | Used by `PublicPlayerProfileModal`. No dedicated friends-online widget. | Add online dot to social friends list. |
| `system-gift` | `/system-gift/*` (BE) | Surfaced via Mail (system mails) only. | Add a "System gifts" tab in Mail or a dedicated gift inbox. |
| `email` | internal | No FE surface needed for player. Forgot-password / reset-password flows already hit `/auth/*`. | Leave (no action). |
| `player-navigation` | internal deep-link | No FE surface (consumed by nav config). | Leave (no action). |
| `chat-moderation` | admin-only | No player surface needed. Admin surfaced via Admin View. | Leave. |
| `arena-anti-wintrade-admin` | admin-only | Admin only. | Leave. |
| `ops` | internal CLI | No FE. | Leave. |
| `liveops-cron` | scheduler | Admin status surfaces via AdminLiveOpsPanel. | Leave. |
| `next-action` | `/next-action` | Surfaced via `NextActionPanel.vue` on `/home`. | Already wired. |
| `player-dashboard` | `/dashboard` | `DashboardView.vue`. | Already wired. |
| `player-feedback` / `player-report` | `/support/*` | `FeedbackView` + `ReportPlayerView`. | Already wired. |
| `web-push` | `/web-push/*` | `NotificationSettingsView.vue`. | Already wired. |
| `system-status` | `/admin/system-status` | Admin only. | Already wired. |
| `secret-realm-runtime` | `/secret-realm` | `SecretRealmView.vue`. | Already wired. |
| `daily-encounter` | `/encounter` | `EncounterView.vue`. | Already wired. |
| `onboarding-quest` | `/onboarding-quest` | `OnboardingQuestView.vue`. | Already wired. |
| `social` / `chat-private` / `chat-group` / `co-cultivation` | `/social` | `SocialView.vue` 4 tabs. | Already wired. |

**Summary**: 3 BE modules with weak FE surface for players: **party**, **party-dungeon**, **coop-boss**.

---

## 9. Frontend Exists but Backend Missing or Weak

| Route / view | Missing API / store | Recommended backend work |
|---|---|---|
| `/home` resource strip `tuTinh`, `danhVong` | `Character.tuTinh` / `Character.danhVong` field absent | Either extend `CharacterStatePayload` with these fields (and a `CurrencyService` integration) or hide tiles. **P1**. |
| `/home` feature grid + mobile icon grid badges | No backend push for those counters; FE reads `homeDashboardMock` | No backend gap — FE just needs to use existing `useGameStore`/`useBadgesStore`. **P0** wiring. |
| `/home` daily reward strip | Real BE is `daily-login` + `dailyReward` claim flow already wired in `DailyLoginCard`. | No backend gap — FE just needs to use the same store on the hero strip or remove the strip. **P0**. |
| Hero quick actions `'fast-cultivate'` / `'restore'` | They route only; a click could optimistically call `setCultivating(true)` or use a HP pill | Add tiny optimistic action handler in `XTHomeDashboard` + reuse existing API endpoints. **P2**. |
| `XianxiaPlaceholderView.vue` (orphaned) | n/a | n/a — delete file. **P3**. |

---

## 10. Priority Roadmap

### P0 — player sees broken/fake/wrong behavior now

1. **PR-A1** Wire `/home` bottom panels + feature/mobile-grid badges + daily reward strip to real stores. Risk: low FE-only.
2. **PR-A2** Replace `/character` redirect with a real `CharacterProfileView` or repoint sidebar/bottom-nav directly to `/dashboard`. Risk: low.
3. **PR-A3** Replace `/cultivation` redirect with a real cultivation hub or repoint sidebar/bottom-nav directly to `/cultivation-method-v2`. Risk: low.

### P1 — core gameplay incomplete

4. **PR-B1** Surface `tuTinh` + `danhVong` from BE `Character` payload, or hide the tiles on `/home`. Risk: BE schema change if extending currencies.
5. **PR-B2** Add `/party` (with co-op + party dungeon + coop boss tabs) so the cooperative gameplay loop is discoverable. Risk: low (existing panels reused).

### P2 — important polish

6. **PR-C1** Build `NotificationsView` consuming `useNotificationsStore` + WS feed.
7. **PR-C2** Update `docs/FRONTEND_ROUTE_MAPPING.md` to reflect current `router/index.ts` (no longer "safe placeholder" for `/character`, `/cultivation`, `/notifications`).
8. **PR-C3** Replace Vietnamese-literal labels in `homeDashboardMock` and `XTHomeDashboard` with i18n keys (parity vi/en).
9. **PR-C4** Improve `/home` `liveSectPanel.members` rendering to avoid "0 / 0" empty placeholder.

### P3 — nice-to-have / later

10. **PR-D1** Delete `apps/web/src/views/XianxiaPlaceholderView.vue` (no route binds it).
11. **PR-D2** Add online presence widget on `/social` friends tab.
12. **PR-D3** Continue admin form-editor follow-ups (Event Builder PR2-6, Control Center PR2-6).

---

### PR Detail (for the recommended top-3)

#### PR-A1 — Wire `/home` to real player data

- **Title**: `feat(web): wire home dashboard recent quests / equipment / inventory / badges to real stores`.
- **Scope**:
  - `XTHomeQuestPanel.vue` reads `useQuestStore.quests` filtered by ACCEPTED/COMPLETED, top 4.
  - `XTHomeInventoryPanel.vue` reads `useInventoryStore` equipped rows; capacity from `inventory.length`; gear power from `summarizeEquipmentBuild()`.
  - `XTHomeFeatureGrid.vue` reads badges from `useBadgesStore` (mission, boss) + `useGameStore.unreadMail` (mail) + `useSocialStore` if available.
  - Hero `dailyReward` strip either reads `useDailyLoginStore` or is hidden because `DailyLoginCard` covers the same intent in Overview tab.
- **Files likely touched**: `XTHomeDashboard.vue`, `XTHomeQuestPanel.vue`, `XTHomeInventoryPanel.vue`, `XTHomeFeatureGrid.vue`, `XTHomeHeroBanner.vue`, `XTHomeMobileHero.vue`, `homeDashboardMock.ts` (downsize to dev/preview only), tests.
- **Tests**: extend `XTHomeDashboard.test.ts` (already has fixtures from Phase 15.10) to assert no mock VIP values + no fake "3" mail badge for empty store. Add new tests for quest panel + inventory panel + feature grid.
- **Risk level**: low (FE-only, server-authoritative reads).
- **Why now**: this is the most player-visible bug — every fresh player sees fake "3 unread mail" / "Đột Phá Đại Thừa Đại Thừa Kỳ Bậc 10".

#### PR-A2 — Replace `/character` redirect

- **Title**: `feat(web): real character profile view replacing /character redirect`.
- **Scope**: a `CharacterProfileView` showing full player attributes (HP/MP/ATK/DEF/SPD/LUK/SPI), realm + EXP curve, equipped cosmetic loadout, equipment slots summary (read inventory store), title + faction badges, achievements highlights, button row (`Tu luyện`, `Đột phá`, `Trang bị`, `Thành tựu`).
- **Files likely touched**: `apps/web/src/views/CharacterProfileView.vue` (new), `router/index.ts` (replace redirect with component), `xtNav.ts` (entry already points to `/character`), `i18n/vi.json` + `en.json`, tests.
- **Tests**: render with empty store (no character) + with character; tab navigation buttons; title equip refresh.
- **Risk level**: low–medium.
- **Why now**: `/character` is a top-level menu entry; sending it to `/dashboard` violates "every clickable shell item routes to a real view" rule in `FRONTEND_ROUTE_MAPPING.md`.

#### PR-A3 — Replace `/cultivation` redirect

- **Title**: `feat(web): cultivation hub view replacing /cultivation redirect`.
- **Scope**: a `CultivationHubView` with cards linking to Breakthrough / Body Cultivation / Cultivation Method / Spiritual Root / Skill Book, plus an inline live tick state (cultivating toggle) and recent EXP gain. Reuse existing components.
- **Files likely touched**: `apps/web/src/views/CultivationHubView.vue` (new), `router/index.ts`, `i18n`.
- **Tests**: cards render correct paths; toggle button calls `setCultivating`.
- **Risk level**: low.
- **Why now**: same as PR-A2 — `/cultivation` is a bottom-nav entry; players expect a hub.

---

## 11. Suggested Next 10 PRs

1. **PR-A1 (P0)** Wire `/home` bottom panels + grid badges to real stores (Phase 15.14).
2. **PR-A2 (P0)** Real `CharacterProfileView` replacing `/character` redirect.
3. **PR-A3 (P0)** `CultivationHubView` replacing `/cultivation` redirect.
4. **PR-B1 (P1)** Surface `tuTinh` + `danhVong` from BE or hide tiles on `/home`.
5. **PR-B2 (P1)** `/party` route aggregating party + party-dungeon + coop-boss surfaces.
6. **PR-C1 (P2)** `/notifications` real `NotificationsView`.
7. **PR-C2 (P2)** Refresh `docs/FRONTEND_ROUTE_MAPPING.md` to match `router/index.ts`.
8. **PR-C3 (P2)** i18n parity sweep over `XTHomeDashboard` + `homeDashboardMock` Vietnamese literals.
9. **PR-D1 (P3)** Delete `XianxiaPlaceholderView.vue` (orphaned) + audit references.
10. **PR-D2 (P3)** Online presence widget on `/social` friends tab.

---

## 12. Final Recommendation

**Do first (this week)**:

1. **PR-A1** — wire the rest of `/home` to real data. This single PR removes ~80% of player-visible "fake/wrong" behavior and finishes the Phase 15.10–15.13 sweep. Effort: medium (5–15 files, 300–700 LOC). Risk: low.

**Do second (next week)**:

2. **PR-A2 + PR-A3** in one batch — real `CharacterProfileView` + real `CultivationHubView`. These convert the two most prominent redirects in the bottom nav into first-class views. Effort: medium (each ~10 files, ~400 LOC). Risk: low.
3. **PR-C2** in the same PR (docs sync) — refresh `FRONTEND_ROUTE_MAPPING.md` and remove `XianxiaPlaceholderView.vue` since neither is needed once A2 + A3 ship.

**Do third (within the next sprint)**:

4. **PR-B1** — surface `tuTinh` + `danhVong` on the BE Character payload (or remove tiles).
5. **PR-B2** — `/party` aggregate route to expose coop gameplay.
6. **PR-C1** — `NotificationsView`.

After these six PRs, the route audit table should contain zero rows in classification **D** (mock/demo data still visible) or **E** for `/character`, `/cultivation`, `/notifications`. The dashboard, character, and cultivation surfaces will all be production-grade for closed beta.

---

## Appendix A — Methodology

1. Started from `apps/web/src/router/index.ts` and listed every route declaration (103 entries including aliases).
2. For each route, opened the view file and verified at least one `useXxxStore` or `apiX/X` import to confirm wiring.
3. Searched the entire repo for placeholder keywords: `mock`, `placeholder`, `TODO`, `FIXME`, `UI-only`, `future wiring`, `demo`, `hardcode`, `hardcoded`, `fake`, `redirect`, `XianxiaPlaceholder`, `homeDashboardMock`, `coming soon`, `đang được phát triển`, `N/A`, `stub`, `empty state`, `not implemented`. (Findings concentrated in `homeDashboardMock.ts`, `XianxiaPlaceholderView.vue`, and `FRONTEND_ROUTE_MAPPING.md`.)
4. Cross-referenced backend modules (`apps/api/src/modules/*`) against frontend stores (`apps/web/src/stores/*`) and views (`apps/web/src/views/*`).
5. Read the latest 6 entries in `docs/AI_HANDOFF_REPORT.md` to confirm Phase 15.10–15.13 wiring state and PR #621 merged status.
6. Verified `docs/AI_WORKFLOW_RULES.md` rule on "code is source of truth" and treated documentation conflicts accordingly.
7. Did **not** modify gameplay code. Only created this audit report and the export helper script (see Appendix B).

## Appendix B — How to convert this report to `.docx`

The sandbox running the audit cannot reach external networks (`pip install python-docx` and `pandoc` install both blocked), so this report is shipped as Markdown. To produce a `.docx`:

**Option 1 — Pandoc (recommended)**

```sh
# from the repo root
pandoc -f gfm -t docx \
  -o docs/audits/XUANTOI_DEEP_FEATURE_AUDIT_2026_05_17.docx \
  docs/audits/XUANTOI_DEEP_FEATURE_AUDIT_2026_05_17.md
```

**Option 2 — Python + python-docx**

```sh
pip install python-docx markdown
python scripts/export-audit-docx.py
```

**Option 3 — convenience shell wrapper**

```sh
bash scripts/export-audit-docx.sh
# Tries pandoc first, falls back to python-docx if pandoc not installed.
```

The convenience scripts are committed in this audit branch under `scripts/`.

## Appendix C — Quick reference: route → view mapping

See `docs/FRONTEND_ROUTE_MAPPING.md` for the project-maintained version (note: stale as of this audit — see §7 #10).

---

*End of report.*
