<!--
  Tham khảo `docs/AI_WORKFLOW_RULES.md` (Fast but Safe Delivery Mode):
  - UI Module Rule: 1 view = 1 PR (list + filter + pagination + stats + loading/empty/error + i18n + tests + docs).
  - Docs Update Rule: AI_HANDOFF_REPORT.md update PHẢI ở cùng PR với code.
  - Test Fast Path Rule: chọn đúng scope test (docs-only / FE-only / shared / API / cross-module). Bảng ở `docs/QA_CHECKLIST.md` §A.
  - Safety Correction Rule: KHÔNG ép minimum 100 dòng; hotfix nhỏ vẫn hợp lệ.
-->

## Summary

<!-- 1-3 dòng mô tả thay đổi + lý do. Link issue/roadmap entry nếu có. -->

## PR Size Mode

Chọn **một**:

- [ ] **Hotfix** (1-5 file, < 200 dòng — bug fix / CI red / security / regression revert / docs sai nghiêm trọng).
- [ ] **Medium** (5-20 file, 200-1200 dòng — 1 view UI hoàn chỉnh / 1 service runtime + tests / 1 catalog pack).
- [ ] **Large** (20-35 file, ≤ 1800 dòng — chỉ khi cùng module + có test rõ + có justify ở phần Notes).

## Scope (chọn tất cả áp dụng)

- [ ] Docs-only (`docs/**`, `*.md`).
- [ ] FE-only (`apps/web/src/**`).
- [ ] Shared catalog (`packages/shared/src/**`).
- [ ] API runtime (`apps/api/src/modules/**`).
- [ ] Prisma schema/migration (`apps/api/prisma/**`).
- [ ] Cross-module / economy / inventory / reward / ledger / authority.
- [ ] CI / workflow (`.github/workflows/**`).
- [ ] Other (giải thích ở Notes).

## Files changed

<!-- List file chính + 1 dòng mô tả mỗi file. Skip nếu < 5 file (xem diff). -->

## Checks run

Test theo Test Fast Path Rule (xem `docs/QA_CHECKLIST.md` §A):

- [ ] `pnpm typecheck` — pass / N/A
- [ ] `pnpm lint` — pass / N/A
- [ ] `pnpm test` (hoặc `pnpm --filter @xuantoi/<pkg> test`) — pass / N/A
- [ ] `pnpm build` (hoặc per-package) — pass / N/A
- [ ] Smoke (`pnpm smoke:economy` / `smoke:ws` / `smoke:admin` / `smoke:combat`) — pass / N/A
- [ ] E2E (`pnpm --filter @xuantoi/web e2e` hoặc `E2E_FULL=1`) — pass / N/A

## CI Status

- [ ] CI green (5/5 PASS).
- [ ] CI pending (đã push, chờ Actions). **KHÔNG báo Done khi CI pending.**
- [ ] CI failed — đang debug trong cùng PR (KHÔNG chuyển task khác).

## Docs Updated

- [ ] `docs/AI_HANDOFF_REPORT.md` — Executive Summary + snapshot mới + Recent Changes (DOCS UPDATE RULE: cùng PR với code).
- [ ] Doc chuyên biệt nếu liên quan (`CONTENT_PIPELINE`, `BALANCE_MODEL`, `ECONOMY_MODEL`, `LIVE_OPS_MODEL`, `QA_CHECKLIST`, `RUN_LOCAL`, `API`, `CHANGELOG`).
- [ ] N/A — đây là PR docs-only audit hợp lệ (handoff lệch / merge nhầm / docs conflict / workflow rules / changelog catch-up).

## UI / Scope Sanity

- [ ] **UI module not split unnecessarily** — nếu PR đụng UI, đã gom list + filter + pagination + stats + loading/empty/error + i18n + tests trong cùng PR (UI MODULE RULE).
- [ ] **Scope không gom bừa** — không trộn Prisma migration + UI lớn + economy trong cùng PR (BATCHING RULE).
- [ ] **Không fake green** — không có `it.skip`/`xdescribe` mới, không `expect(true).toBe(true)`, không tắt test cũ (SAFETY CORRECTION RULE).
- [ ] **Không tắt CI** — không sửa `.github/workflows/*` để bypass.
- [ ] N/A — không phải UI / không gom scope.

## Risk / Rollback

<!--
  🟢 low / 🟡 medium / 🔴 high — mô tả risk thực tế + cách rollback (revert trivial / cần migration rollback / cần coordinate user / etc).
-->

## Review & Testing Checklist for Human

<!--
  state the number of things in the list based on the risk; red -> 3-5 items. yellow -> 1-3 items. green -> 0-3 items.
  list of things (markdown - [ ] syntax) that human should double check and test themselves, in descending order of importance.
  do NOT overstate your confidence. CI checks passing is necessary but *insufficient*.
  recommend a test plan for human to verify that everything works end to end.
-->

### Notes

<!--
  anything else you want to write down.
  do NOT include the session url or requester info here; those are appended automatically.
-->
