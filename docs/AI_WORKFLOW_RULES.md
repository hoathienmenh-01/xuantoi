# AI Workflow Rules — Xuân Tôi

> AI/dev mới: file này định nghĩa **các luật bắt buộc** khi viết PR cho Xuân Tôi. Đọc cùng với [`START_HERE.md`](./START_HERE.md) trước khi viết PR đầu tiên. Nếu luật ở đây mâu thuẫn với hướng dẫn cũ trong các doc khác, file này thắng.

Các luật chung (server-authoritative gameplay, ledger, idempotency, không push thẳng main, không merge khi CI đỏ, etc.) đã có ở các doc khác (`GAME_DESIGN_BIBLE.md`, `ECONOMY_MODEL.md`, `AI_HANDOFF_REPORT.md`). File này tập trung vào **delivery / scope rules** — cách chia PR, cách gom việc, cách không tạo micro-PR vô nghĩa.

---

## UI MODULE RULE

Một UI page/view/module phải làm trọn trong 1 PR nếu cùng một chức năng.

Một UI PR nên bao gồm:

- API client nếu cần.
- Store/state nếu cần.
- View/component.
- Loading state.
- Empty state.
- Error state.
- Filter/search nếu thuộc cùng view.
- Pagination nếu thuộc cùng view.
- Stats/summary card nếu thuộc cùng view.
- i18n key.
- Unit/render test hoặc Playwright smoke nếu phù hợp.
- Cập nhật `docs/AI_HANDOFF_REPORT.md` trong cùng PR.

Không tách riêng pagination/filter/stats thành nhiều PR nếu chúng thuộc cùng một màn hình.

### Ví dụ đúng

- `feat(tribulation): complete history UI`
  gồm list + filter + pagination + stats + loading/empty/error + i18n + tests + docs.

### Ví dụ sai

- PR 1: add pagination
- PR 2: add filter
- PR 3: add stats
- PR 4: docs sync

### Ngoại lệ hợp lệ

- Backend endpoint phụ trợ (ví dụ `GET /character/tribulation/log` trước khi UI consume) **được phép** tách thành PR backend riêng nếu UI chưa tồn tại — đây không phải micro-PR cùng màn hình, mà là chia tầng API ↔ UI.
- Refactor/rewrite một view có sẵn vì lý do kỹ thuật (vd thay framework component, tách layout) cũng được phép tách khỏi feature mới.
- Nếu một UI module quá lớn (> ~600 dòng diff thực sự, không tính generated/i18n/test fixture), được phép chia theo tầng (vd PR 1 = list + loading/empty/error baseline; PR 2 = filter + pagination + stats). Trong trường hợp này, PR đầu phải ghi rõ trong body **roadmap PR tiếp theo** + **TODO marker trong code** để không bị quên.
- Hotfix sau khi UI đã merge (vd a11y label thiếu, lỗi i18n) đương nhiên là PR riêng — đây không phải micro-feature, là bug fix.

### Khi review PR UI

Reviewer (AI hoặc người) phải reject PR nếu:

- Một view chỉ thêm pagination, không có loading state / empty state / error state đi kèm (trừ khi pagination là enhancement của view đã có sẵn loading/empty/error).
- PR title gợi ý micro-scope kiểu `feat(view): add pagination only` mà view đó còn thiếu filter/stats trong cùng phase và phase đó đã có endpoint backend support.
- Filter/pagination/stats được tách thành nhiều PR liên tiếp cùng touch một file `*View.vue` / một Pinia store.

---

## Lịch sử

- **2026-05-03** — Tạo file. Author: Devin AI session 9r-26 take-over. Lý do: trong loop autonomous trước đó, một số UI module bị chia thành 4-5 micro-PR (vd Phase 11.6 Tribulation history split: PR #329 list view, #330 pagination, #332 filter, #333 stats summary, #334 docs sync), tốn CI thời gian + tốn review attention. Luật UI Module Rule giờ là gate.
