# Live demo QA — Upload → AI review → Accept → Counsel → Firm memory

- **Link:** https://aduin-transaction-web.giathaowork.workers.dev (không cần flag)
- **Build đang chạy:** Worker version `2b2dd0fe` (18-10-26, main `a8e9745`; trước đó `493f2501`). Ghi chú cũ: test tự động S1–S16 chạy trên `8a82ead2` (deploy 18-10-26 từ branch `deploy/ai-stream-dedup`, tip `d7b7756`). Không có build stamp trên trang (bạn quyết định không cần).
- **Thiết bị:** A = laptop, trình duyệt bạn đang dùng (desktop). B = cửa sổ ẩn danh trên cùng laptop (để kiểm tra memory lưu ở server, không chỉ trong trình duyệt). Không test mobile.
- **Phạm vi:** chỉ test những gì ĐANG có trên link. Variance (phase 01–05), findings-v2 và các thay đổi local chưa commit đều KHÔNG có trên link → không test.

## Cách dùng
Mở hộp "Retest now", làm từng bước theo thứ tự, tick `[x]` khi bước đó đúng. Có gì sai thì báo trong chat hoặc ghi vào file.

Mẫu báo lỗi:
`QA S<n> failed at <HH:MM> on <device>. Expected: <...>. Saw: <...>. Console: <paste or none>. Investigate the logs around that time; don't change code yet, tell me the cause first.`

Trạng thái: 🔧 đang sửa (đừng test) · 🔁 RETEST (bản sửa đã lên link) · ⬜ CHƯA TEST · ❓ CẦN KIỂM TRA · ❌ có lỗi · 🤖 test tự động pass · ✅ bạn đã xác nhận.

---

## ▶️ Retest now

**Link:** https://aduin-transaction-web.giathaowork.workers.dev · **Thiết bị:** A (laptop) · **Build:** `8a82ead2`

**Trước khi bắt đầu**
- A: hard refresh (Cmd+Shift+R).
- Chuẩn bị file để upload: `samples/sub-docs/raw/05-partners-group-ngi-2024.htm` (trong repo).
- Lưu ý: AI tươi (không lấy từ cache) giới hạn **3 tài liệu/ngày** và cần qua Turnstile. Mở sample có sẵn thì miễn phí, AI lấy từ cache.

**Làm theo thứ tự (lần đầu, chưa có gì được sửa):**
1. **S1** Mở hộp upload → Expect: thấy danh sách Samples, Demo packages và form Upload.
2. **S2** Upload file #05, Law firm = Partners Group → Expect: mở màn Findings, có danh sách findings.
3. **S4** Xem AI review chạy → Expect: pill trên cùng đổi sang "Checks done · AI review …", findings của AI có nhãn AI.
4. **S7** Accept 1 finding → Expect: hiện "Accepted".
5. **S8** Dismiss 1 finding → Expect: bắt buộc nhập lý do.
6. **S9** "Needs counsel" 1 finding → Expect: nó xuất hiện trong Counsel questions.
7. **S11–S13** Trong Counsel questions: trả lời, xem pill gate, export DOCX.
8. **S14–S16** Mở Firm memory: Decisions, Rules, Audit trail.

**Chưa test được / chưa có trên link:** variance (change rows, baseline), findings-v2, mọi thay đổi local chưa commit.
**Đang chờ bạn:** chạy lần test đầu tiên. S1–S16 đã 🤖 pass tự động trên code live (AI giả, D1 local), nhưng chưa có gì ✅.
**Chưa xác minh trên link thật:** Turnstile người thật, AI model thật, D1 live, mở DOCX bằng Word.
**Đã xác nhận:** S17 ✅ (18-10-26, build `2b2dd0fe`). Hiện không có bản sửa mới nào chờ test lại.
**⚠️ Link đã đổi bản:** live giờ là `493f2501` (Findings v2 + Variance), không còn là `8a82ead2`. Findings v2 đổi nút: thanh dưới giờ là "Ask counsel" / "Close issue" thay cho Accept / Dismiss / Needs counsel. Các bước S7–S9 cần viết lại theo giao diện mới trước khi bạn test tay.
**Ưu tiên test tay:** S2+S4 (Turnstile + AI thật), S15 (3 lần dismiss → rule → audit), S13 (mở DOCX bằng Word), S6 (lượt AI thứ 4).

---

## How this document works
1. Mỗi lỗi mới có chỗ ngay trong cùng lượt: một scenario có sẵn, một scenario mới, hoặc một dòng ở "Small issues".
2. Mỗi lỗi bạn báo được ghi ngay và agent nói rõ nó nằm ở scenario nào.
3. Nhóm theo tính năng, nhóm đang test ở trên cùng, các scenario liên quan đứng cạnh nhau.
4. Trạng thái chỉ đổi khi có bằng chứng: đang sửa → đã lên link → ✅ chỉ khi bạn xác nhận → Done.
5. Lỗi khác nhau thì scenario khác nhau (lỗi mới phát hiện giữa chừng = scenario mới).
6. Mỗi bước = một hành động + một kết quả mong đợi; lịch sử được gập lại.
7. Mục "Đừng test" được đánh dấu rõ và gỡ khỏi danh sách retest.
8. Test từng nhóm một.
9. Có mục "Hôm nay": đã sửa gì / test gì theo thứ tự / bỏ qua gì.

## Decisions (don't re-propose)
- 18-10-26: Test trên link live, chỉ những gì đang có trên link. Không test variance / findings-v2 / thay đổi chưa push.
- 18-10-26: Chỉ desktop, trình duyệt hiện tại. Không mobile.
- 18-10-26: Không thêm build stamp.
- 18-10-26: Luồng cần test: Upload → AI review → Accept/Dismiss → Counsel → Firm memory.

---

## Group 1 — Upload (nhóm đang test)

### S1 — Mở hộp "Open a document" ⬜ NEVER TESTED · 🤖
**Automated test:** 🤖 `Spec: `live-flow.spec.ts:37` | preview | real-UI` · commit 560daef (= code live d7b7756 + chỉ file test) · PASS · evidence: worktree `e2e-live-flow/e2e-logs/`
*Your last test:* —
*Your result:* _(ghi ✅ works / ❌ + bạn thấy gì)_

Setup: A.
- [ ] A: bấm tên tài liệu ở sidebar trái → "Open another document…". Expect: hộp "Open a document" mở ra.
- [ ] A: nhìn hộp. Expect: 13 Samples, 7 Demo packages, form Upload ghi "Up to 10 MB … Accepted: .htm, .html, .pdf, .docx, .jpg, .jpeg, .png".

### S2 — Upload một file HTML có law firm ⬜ NEVER TESTED · 🤖
**Automated test:** 🤖 `Spec: `live-flow.spec.ts:49` | preview | real-UI` · commit 560daef (= code live d7b7756 + chỉ file test) · PASS · evidence: worktree `e2e-live-flow/e2e-logs/`
*Your last test:* —
*Your result:* _(...)_

Setup: A, file `05-partners-group-ngi-2024.htm`.
- [ ] A: chọn file ở ô File. Expect: tên file hiện ra, không báo lỗi.
- [ ] A: Law firm gõ "Partners Group" và chọn từ danh sách. Expect: chọn được.
- [ ] A: điền "Fund name" (bắt buộc khi đã chọn law firm, nếu trống sẽ báo "Enter the fund name.").  Expect: điền được.
- [ ] A: chưa tick "I have read the privacy notice", bấm "Upload and open". Expect: không upload, hiện "Read and accept the privacy notice before uploading." (nút không bị làm mờ, đây là thiết kế).
- [ ] A: tick privacy, bấm "Upload and open". Expect: qua Turnstile (có thể tự qua), mở màn Findings của tài liệu mới.
- [ ] A: nhìn sidebar. Expect: tên tài liệu mới và "Partners Group" (không phải "No firm").

### S3 — Upload sai loại file bị chặn ⬜ NEVER TESTED · 🤖
**Automated test:** 🤖 `Spec: `upload-limits.spec.ts:44`, `mobile-shell.spec.ts:27` | preview | real-UI` · commit 560daef (= code live d7b7756 + chỉ file test) · PASS · evidence: worktree `e2e-live-flow/e2e-logs/`
*Your last test:* —
*Your result:* _(...)_

Setup: A, một file .txt hoặc .zip bất kỳ.
- [ ] A: chọn file đó ở ô File. Expect: có thông báo rõ ràng là không nhận loại file này, không upload.

---

## Group 2 — AI review

### S4 — AI review chạy sau khi upload ⬜ NEVER TESTED · 🤖
**Automated test:** 🤖 `Spec: `live-flow.spec.ts` S4+S7, `ai-no-duplicates.spec.ts:64` | preview, AI giả | real-UI` · commit 560daef (= code live d7b7756 + chỉ file test) · PASS · evidence: worktree `e2e-live-flow/e2e-logs/`
*Your last test:* —
*Your result:* _(...)_

Setup: A, ngay sau S2, nút "AI on" đang bật.
- [ ] A: nhìn pill trạng thái phía trên cùng. Expect: findings của rule hiện trong khoảng 1 giây; AI hiện "pending/đang chạy" rồi chuyển sang "Checks done · AI review …".
- [ ] A: trong lúc AI chạy. Expect: findings AI hiện dần (streaming), trang không bị treo.
- [ ] A: xem danh sách khi xong. Expect: finding AI có nhãn model/AI, có trích đoạn văn bản, KHÔNG có dòng AI trùng lặp.

### S5 — Tắt AI thì rule vẫn chạy ⬜ NEVER TESTED · 🤖
**Automated test:** 🤖 `Spec: `ai-banners.spec.ts:126`, `status-stages.spec.ts:71` | preview | real-UI` · commit 560daef (= code live d7b7756 + chỉ file test) · PASS · evidence: worktree `e2e-live-flow/e2e-logs/`
*Your last test:* —
*Your result:* _(...)_

Setup: A.
- [ ] A: bấm "No AI" (hoặc "AI review on. Switch off"). Expect: có thông báo "AI review is off.", findings của rule vẫn còn.
- [ ] A: bật lại "AI on". Expect: AI lấy từ cache, không tốn thêm lượt.

### S6 — Hết lượt AI trong ngày ⬜ NEVER TESTED (chỉ test nếu bạn đã dùng 3 lượt)
**Automated test:** NOT AUTOMATABLE — MANUAL-ONLY: cần quota thật trên link live.
*Your last test:* —
*Your result:* _(...)_

- [ ] A: upload tài liệu thứ 4 trong ngày với AI on. Expect: banner nói rõ lý do (hết lượt / giới hạn ngày), rule vẫn chạy.

---

## Group 3 — Triage: Accept / Dismiss / Needs counsel

### S7 — Accept một finding ⬜ NEVER TESTED · 🤖
**Automated test:** 🤖 `Spec: `live-flow.spec.ts` S4+S7, `triage-actions.spec.ts:5` | preview | real-UI` · commit 560daef (= code live d7b7756 + chỉ file test) · PASS · evidence: worktree `e2e-live-flow/e2e-logs/`
*Your last test:* —
*Your result:* _(...)_

Setup: A, tài liệu từ S2 (có law firm).
- [ ] A: mở 1 finding, bấm "Accept". Expect: hiện "Accepted.", không có cảnh báo "not saved to firm memory".
- [ ] A: đếm "Fix / Note" phía trên. Expect: số đếm cập nhật đúng.

### S8 — Dismiss bắt buộc nhập lý do ⬜ NEVER TESTED · 🤖
**Automated test:** 🤖 `Spec: `dismiss-requires-reason.spec.ts:5`, `memory-blocking-never-hidden.spec.ts:10` | preview | real-UI` · commit 560daef (= code live d7b7756 + chỉ file test) · PASS · evidence: worktree `e2e-live-flow/e2e-logs/`
*Your last test:* —
*Your result:* _(...)_

- [ ] A: bấm "Dismiss…" trên 1 finding khác. Expect: hiện ô lý do; chưa nhập thì không xác nhận được.
- [ ] A: nhập lý do, xác nhận. Expect: hiện "Dismissed.", finding vào "Previously handled".
- [ ] A: thử Dismiss một finding mức Blocks (nếu có). Expect: finding chặn KHÔNG bị ẩn bởi quyết định đã nhớ.

### S9 — "Needs counsel" chuyển sang Counsel ⬜ NEVER TESTED · 🤖
**Automated test:** 🤖 `Spec: `live-flow.spec.ts` S9+S11 | preview | real-UI` · commit 560daef (= code live d7b7756 + chỉ file test) · PASS · evidence: worktree `e2e-live-flow/e2e-logs/`
*Your last test:* —
*Your result:* _(...)_

- [ ] A: bấm "Needs counsel" trên 1 finding. Expect: hiện "Needs counsel.".
- [ ] A: vào sidebar "Counsel questions". Expect: câu hỏi mới có trong danh sách, "Unanswered" tăng 1.

### S10 — Tài liệu không có law firm ⬜ NEVER TESTED · 🤖
**Automated test:** 🤖 `Spec: `live-flow.spec.ts` S10, `upload-firm-tagging.spec.ts:50` | preview | real-UI` · commit 560daef (= code live d7b7756 + chỉ file test) · PASS · evidence: worktree `e2e-live-flow/e2e-logs/`
*Your last test:* —
*Your result:* _(...)_

- [ ] A: mở sample #1 Franklin Lexington (No firm). Expect: banner "Memory not applied…" giải thích phải chọn law firm.
- [ ] A: Accept 1 finding. Expect: có thông báo quyết định này không lưu vào firm memory.

---

## Group 4 — Counsel questions

### S11 — Trả lời câu hỏi counsel ⬜ NEVER TESTED · 🤖
**Automated test:** 🤖 `Spec: `counsel-answer.spec.ts:45`, `stack-memory-roundtrip.spec.ts:38` | preview + D1 local | real-UI` · commit 560daef (= code live d7b7756 + chỉ file test) · PASS · evidence: worktree `e2e-live-flow/e2e-logs/`
*Your last test:* —
*Your result:* _(...)_

Setup: A, sau S9.
- [ ] A: mở câu hỏi, nhập câu trả lời, bấm lưu. Expect: chuyển sang "Answered", "Unanswered" giảm 1.

### S12 — Gate "Ready to digitize" ⬜ NEVER TESTED · 🤖
**Automated test:** 🤖 `Spec: `gate-pill.spec.ts:12` | preview | real-UI` · commit 560daef (= code live d7b7756 + chỉ file test) · PASS · evidence: worktree `e2e-live-flow/e2e-logs/`
*Your last test:* —
*Your result:* _(...)_

- [ ] A: khi còn câu hỏi chặn chưa trả lời. Expect: pill gate ghi "Not ready to digitize." (Blocked).
- [ ] A: trả lời hết câu hỏi chặn. Expect: pill đổi sang "Ready to digitize · every critical item is resolved".

### S13 — Export DOCX ⬜ NEVER TESTED · 🤖
**Automated test:** 🤖 `Spec: `counsel-export.spec.ts:28` (đọc lại DOCX bằng mammoth, không mở Word) | preview | real-UI` · commit 560daef (= code live d7b7756 + chỉ file test) · PASS · evidence: worktree `e2e-live-flow/e2e-logs/`
*Your last test:* —
*Your result:* _(...)_

- [ ] A: bấm "Export DOCX". Expect: tải về một file .docx.
- [ ] A: mở file bằng Word/Pages. Expect: có đủ câu hỏi, trích đoạn và câu trả lời; dòng "Not exported to counsel" đổi trạng thái.

---

## Group 5 — Firm memory

### S14 — Firm memory hiển thị quyết định ⬜ NEVER TESTED · 🤖
**Automated test:** 🤖 `Spec: `stack-memory-live-flow.spec.ts` S14+S16 | stack-memory, D1 local | real-UI` · commit 560daef (= code live d7b7756 + chỉ file test) · PASS · evidence: worktree `e2e-live-flow/e2e-logs/`
*Your last test:* —
*Your result:* _(...)_

Setup: A, tài liệu Partners Group từ S2 đang mở.
- [ ] A: sidebar "Firm memory" (vào bằng sidebar, link `#memory` trực tiếp sẽ về Findings). Expect: màn có tab Decisions, Rules, Audit trail.
- [ ] A: tab Decisions. Expect: thấy quyết định Accept/Dismiss từ S7–S8.

### S15 — Đề xuất rule sau 3 lần dismiss giống nhau ⬜ NEVER TESTED · 🤖
**Automated test:** 🤖 `Spec: `stack-memory-live-flow.spec.ts` S15 | stack-memory, D1 local | real-UI` · commit 560daef (= code live d7b7756 + chỉ file test) · PASS · evidence: worktree `e2e-live-flow/e2e-logs/`
*Your last test:* —
*Your result:* _(...)_

- [ ] A: Dismiss 3 finding cùng loại (cùng rule) với lý do tương tự. Expect: tab Rules có rule "Proposed from repeated dismissals.", ghi "No effect until approved."
- [ ] A: duyệt rule. Expect: rule đổi trạng thái; tab Audit trail có dòng mới ("Entries cannot be edited or removed.").

### S16 — Memory lưu trên server, không chỉ trong trình duyệt ⬜ NEVER TESTED · 🤖
**Automated test:** 🤖 `Spec: `stack-memory-live-flow.spec.ts` S14+S16, `stack-memory-sandbox-isolation.spec.ts:18` | stack-memory | real-UI` · commit 560daef (= code live d7b7756 + chỉ file test) · PASS · evidence: worktree `e2e-live-flow/e2e-logs/`
*Your last test:* —
*Your result:* _(...)_

Setup: B = cửa sổ ẩn danh.
- [ ] B: mở link, mở sample #5 PG NGI 2024 (Partners Group). Expect: B KHÔNG thấy quyết định của A — mỗi người xem có sandbox riêng (đúng thiết kế, test tự động đã xác nhận).
- [ ] B: Firm memory. Expect: không có rule/decision của A; A reload thì vẫn thấy của mình.

---

## Group 6 — Layout (lỗi tìm được bởi test tự động)

### S17 — Trang bị cuộn ngang ở cửa sổ rộng 768 px ✅ confirmed
**Status:** lỗi có ở mọi cửa sổ rộng 768–959 px, kể cả bản live hiện tại `493f2501` (đo 18-10-26: `scrollWidth 960 > innerWidth 768`). Nguyên nhân: `.app { min-width: 960px }` nhưng bố cục hẹp chỉ áp dụng dưới 768 px. Đã sửa trong commit `a8e9745` trên main (bố cục xếp dọc áp dụng từ dưới 960 px). **Đã lên link 18-10-26: Worker version `2b2dd0fe`.** Kiểm tra từ trình duyệt: ở 768, 900 và 1440 px `scrollWidth` bằng `innerWidth`; ở 800 px trang có CSS mới và không tràn. Reload A: hard refresh (Cmd+Shift+R).
**Automated test:** 🤖 `Spec: apps/web/e2e/no-sideways-scroll.spec.ts | preview | real-UI` · commit a8e9745 · trước khi sửa: `6 failed` (960 > 768/900) · sau khi sửa: PASS (Playwright: 37 passed, gồm cả mobile-shell, layout-vs-mockup, findings-v2) · evidence: scratchpad `s17/*.png`
*Your last test:* 18-10-26, A (laptop, cửa sổ ~800 px), build `2b2dd0fe`
*Your result:* ✅ cửa sổ khoảng 800 px không còn cuộn ngang.

- [x] A: thu cửa sổ trình duyệt còn ~768 px, mở sample #5. Expect: không có thanh cuộn ngang, pill trạng thái và danh sách findings nằm trọn trong màn hình. ~~(Trước đây: bị tràn sang phải.)~~

---

## Small issues & notes
- S1 (768 px): tên Demo packages bị cắt ("No…", "Lo…") trong hộp Open a document. Nhỏ, chưa sửa.
- 18-10-26: Đã chạy e2e tự động trên code live, xem bảng Automated test results.

## ✅ Done
- S17 — Confirmed 18-10-26 (build `2b2dd0fe`, commit `a8e9745`): cửa sổ ~800 px không còn cuộn ngang.

## Automated test results
| Round | Commit | Load start/end | Spec | Playwright result | Failure class (file:line) |
|---|---|---|---|---|---|
| 1 | b46e4d1 | 7–12 | toàn bộ project `preview` | `222 passed (2.4m)`, 1 skipped (design probe opt-in) | — |
| 1 | b46e4d1 | 7–12 | toàn bộ project `stack-memory` | `12 passed (34.8s)` | — |
| 2 | 560daef | 7–12 | `live-flow.spec.ts` --repeat-each=2 | `10 passed (10.9s)` | — |
| 2 | b46e4d1 | 7–12 | `stack-memory-live-flow.spec.ts` --repeat-each=2 | `4 passed (36.2s)` | — |
| mutation | 560daef | — | 5 test quan trọng | 5 đột biến, cả 5 đều RED (mỗi lần `1 failed`); không còn sót | — |

Chưa được tự động hoá (phải test tay trên link live): Turnstile với người thật · model AI thật (tốc độ, nội dung) · D1 live + quota 3 lượt AI/ngày · mở DOCX bằng Word/Pages. Test chạy trên branch `test/e2e-live-flow` (chưa push).

## Still open, not done
- Tất cả S1–S16 chưa test lần nào.
- S6 chỉ test với quota giả.
