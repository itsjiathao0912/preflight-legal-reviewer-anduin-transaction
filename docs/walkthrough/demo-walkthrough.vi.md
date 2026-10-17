# Hướng dẫn demo Sub-doc QA (bản live hiện tại)

> Viết ngày 17/10/2026, dựa trên code ở `main` (commit `1f5cfa5`) và bản live
> https://aduin-transaction-web.giathaowork.workers.dev (version `328ca295-d5da-487e-a063-843b0c7c86db`; bản trước: `47d98295`, `23612b12`).
> Tên nút, nhãn và câu thông báo được giữ **nguyên tiếng Anh như trên màn hình**, để bạn đối chiếu khi demo.
> Đường dẫn code là đường dẫn tương đối từ gốc repo.

---

## 0. Đọc trước khi demo: 7 điều cần biết

| # | Điều cần biết | Hệ quả khi demo | Cách xử lý |
|---|---|---|---|
| 1 | **Memory và AI cần qua Turnstile.** Lần đầu app gọi memory, Cloudflare sẽ hỏi "Verify you are human". Trình duyệt tự động không qua được. | Nếu bỏ qua bước xác minh, sample có firm (#3–#6) sẽ hiện hai banner: "Memory unavailable" và "AI review skipped: the firm rules could not be read…". | Demo bằng **trình duyệt thường**. Mở #3 trước buổi demo, qua bước xác minh một lần. |
| 2 | **Gate chỉ đếm finding mức "Blocks digitization" (critical), và không bao giờ đếm finding do AI tạo.** Tham chiếu sai (`ref-label-coherence`, `ref-this-section`) là critical khi nằm trong *ngữ cảnh điều hướng*: phần hướng dẫn (instructions scope), một answer option, hoặc một khối chứa điều kiện. Ngoài ngữ cảnh đó thì là high. | 4 tham chiếu "Part B" bị tráo trên #3 và #5 là critical. "this Section 11" trên #1 vẫn là high (đoạn representation). Vì vậy gate chặn ở #3/#5 nhưng **không** chặn ở #1. Khi chưa có tài liệu, gate hiện "No document" (trung tính). | Chỉ nói "gate đang chặn" với #3/#5, và chỉ khi memory chưa có câu trả lời counsel (xem điều 3). Với #1 hãy nói rõ là lỗi high nên không chặn, đúng chủ đích. Đã kiểm chứng trên bản live: #5 mở không có memory sẽ hiện "Blocked · 2". |
| 3 | **Seed memory trên D1 đã khớp sample.** `ws_demo` là Partners Group, gồm 7 decisions và rule `sr01` (proposed). Dữ liệu Firm X / Firm Y cũ đã bị xóa khỏi `ws_demo` (chỉ ở `ws_demo`). Seed có sẵn câu trả lời counsel **A** cho hai tham chiếu bị tráo (`sd06`, `sd07`). | Khi có memory (đã qua Turnstile), #3/#5 hiện hai finding đó là "Already answered" và gate là **Ready**, tức là không tự chặn. Muốn diễn cảnh Blocked thì phải chủ động tạo ra. | Hai cách: (a) mở #5 khi chưa có memory (trước khi qua Turnstile, hoặc phiên không có memory) sẽ thấy "Blocked · 2"; (b) trong Memory, **Reopen** `sd06` hoặc `sd07` kèm lý do, hai finding đó quay về New và chặn gate (bước 5–6 trong §3). |
| 4 | **Màn "Documents" vẫn là placeholder**: chỉ có chữ "Recent documents, samples and uploads: coming in a later build." | Đừng bấm vào khi demo. | Mở tài liệu qua **ô chọn tài liệu** ở đầu menu (doc switcher). |
| 5 | **Hạn mức AI free:** mỗi visitor được 3 tài liệu AI mới mỗi ngày, toàn hệ thống 35 request mỗi ngày. Mở sample không tốn lượt nào. | "Run AI on this sample", "Summarize changes", "AI draft" và upload khi AI đang bật đều tiêu lượt. | Tập dượt với **"No AI"**. Chỉ bật AI cho đúng một cảnh cần show. |
| 6 | **Deep link `#memory` không dùng được**: app luôn mở vào `#findings`. | Gõ URL `/#memory` sẽ rơi về Findings. | Vào Memory bằng mục trong menu dọc. |
| 7 | **AI live hiện có thể bị timeout.** AI đã tới được OpenRouter nhưng model free đang mất khoảng 120 s rồi timeout (đang sửa ở worker). | "Run AI", "Summarize changes", "AI draft" có thể treo hoặc báo lỗi. | Demo bằng **"No AI"**. Tải lại trang sẽ mở lại tài liệu cuối cùng (restore on reload), và layout điện thoại 375px đã được sửa nên có thể show nhanh trên màn hẹp. |

---

## 1. Bố cục chung (app shell)

```
┌──────────────────────────┬───────────────────────────────────────────────────────────┐
│ ◧ Sub-doc QA        [⇤]  │  <Tên màn>  <dòng đếm>                <Trạng thái stage ▾>  │
│ ┌──────────────────────┐ │  ─────────────────────────────────────────────────────────  │
│ │ PG NGI 2024        ▾ │ │                                                             │
│ │ Partners Group       │ │                    Nội dung của màn                         │
│ └──────────────────────┘ │                                                             │
│ Review                   │                                                             │
│   Findings          7    │                                                             │
│   Counsel questions 1    │                                                             │
│ Check                    │                                                             │
│   Structure       ⚠ 25   │                                                             │
│   Compare versions       │                                                             │
│ Firm                     │                                                             │
│   Partners Group memory  │                                                             │
│   Documents              │                                                             │
│ ──────────────────────── │                                                             │
│ 🔒 Blocked · N  /  ✓ Ready to digitize › │                                             │
│ [AI on | No AI]          │                                                             │
│ ✧ 3 of 3 fresh-AI documents left today │                                               │
│ LT Linh Tran          ✎  │                                                             │
└──────────────────────────┴───────────────────────────────────────────────────────────┘
```

| Thành phần | Hiển thị gì | Bấm vào thì sao | Code |
|---|---|---|---|
| **Doc switcher** (ô ở đầu menu) | Tên tài liệu đang mở và firm, hoặc "No document · Open a document" | Mở popover gồm tối đa 6 tài liệu mở gần đây và nút "Open another document…", nút này mở dialog Open a document (§2) | `shell/DocSwitcher.tsx` |
| **Findings** (badge số) | Số finding **đang mở** trong danh sách chính | Chuyển sang màn Findings | `shell/Sidebar.tsx`, `review/model.ts openCount` |
| **Counsel questions** (badge) | Số finding đang ở trạng thái "Needs counsel" | Chuyển sang màn Counsel | `counselCount` |
| **Structure** (⚠ N) | Tổng số "issue" trong Structure: tham chiếu, điều kiện, option group, thuật ngữ và investor types bị gắn cờ | Chuyển sang màn Structure | `result.structure.badge` |
| **Compare versions** | Không có badge | Chuyển sang màn Compare | |
| **"{Firm} memory"** | Tên đổi theo firm của tài liệu, ví dụ "Partners Group memory". Không có firm thì hiện "Firm memory". | Chuyển sang màn Memory | `MemoryView` |
| **Documents** | — | Màn placeholder (xem §0, điều 4) | `placeholders/PlaceholderView.tsx` |
| **Gate pill** | "Blocked · N" (ổ khóa đỏ), "Ready to digitize" (xanh), hoặc "No document" (trung tính, khi chưa mở tài liệu) | Mở popover "Digitization is blocked" kèm danh sách lý do. Bấm một lý do sẽ nhảy tới đúng finding hoặc câu hỏi. | `shell/GateButton.tsx`, `gate/GateReasons.tsx` |
| **AI on / No AI** | Công tắc AI. Lựa chọn được lưu lại (`ui:v1:ai`). | Bật lần đầu sẽ hiện **Privacy prompt**, gồm 2 nút "Keep AI off" và "Accept and turn AI on". Tắt thì app xóa các finding AI và hiện banner "AI review is off". | `AiSwitch.tsx`, `state/session.ts` |
| **Allowance** | "3 of 3 fresh-AI documents left today", số lấy từ `GET /api/quota` | — | `ai/Allowance.tsx` |
| **Analyst badge** (LT Linh Tran ✎) | Tên analyst giả lập | Bút chì: đổi tên. Đổi tên sẽ khởi tạo lại phiên memory. | `AnalystBadge.tsx` |
| **Unsynced chip** | Ẩn khi bằng 0. Hiện "N unsynced" khi có quyết định chưa gửi lên server | — | `UnsyncedChip.tsx` |
| **Nút thu gọn menu** (⇤) | Thu menu thành dải icon. Dưới 1200px app tự thu gọn. | — | `state/shell.ts` |

**Thứ tự tải khi mở app:**
1. Hiện ngay khung app và màn Findings trống ("No document is open." + nút "Open a document").
2. Xóa các file upload đã quá 24 giờ, gọi `GET /api/quota` để lấy hạn mức.
3. Phiên memory (`POST /api/session`) **chỉ được tạo khi mở tài liệu có firm**, hoặc khi vào màn Memory.

---

## 2. Mở tài liệu

**Thao tác:** bấm doc switcher → "Open another document…", hoặc bấm nút "Open a document" trên màn trống.

**Dialog "Open a document"** gồm:
- **Samples** (public SEC filings, open in one click): 13 dòng dạng "#N tên · firm".
  - Chỉ **#3, #4, #5, #6** gắn firm "Partners Group"; còn lại là "No firm".
  - #9 là bộ scan RW Holdings 22 trang.
- **Upload:**
  - Ô File (tối đa 10 MB; scan tối đa 30 trang; nhận `.htm .html .pdf .docx .jpg .jpeg .png`).
  - Law firm: chọn từ danh sách, gõ tên phụ (alias) cũng nhận ra; **không nhận gõ tự do**.
  - Fund name, Version label.
  - Ô tích "I have read the privacy notice".
  - Nút "Upload and open".

### Bấm một sample (ví dụ #5) thì chuyện gì xảy ra
1. App tải file từ `/samples/05-partners-group-ngi-2024.htm` và chuyển sang Findings.
2. Engine chạy **trong Web Worker của trình duyệt**, không lên server. Nút trạng thái stage ở góc trên phải lần lượt hiện:
   - "Reading the document" → "Done · N lines"
   - "Finding sections and references" → "Done · N sections, M references"
   - "Running rule checks" → "Done · N finding(s)"
3. **Danh sách finding hiện ngay.** Mọi finding tạm mang nhãn New.
4. Chạy nền phần **AI**:
   - App tìm file AI đã tính sẵn (`/precomputed/{docHash}.{rulesHash}.json`). Chỉ #1 và #3 có file này.
   - **Sample không bao giờ tự gọi `/api/ai` khi mở.**
5. Chạy nền phần **memory**, chỉ với tài liệu có firm:
   - Tạo phiên (`POST /api/session`; lần đầu có Turnstile).
   - Gọi `POST /api/memory/lookup` → các finding được gắn lại nhãn (New / Previously dismissed / Already answered / Awaiting counsel / "Dismissed in …, re-confirm").

### Upload một file
- Nếu sai loại file, quá dung lượng, chưa chọn firm hoặc chưa tích privacy, app báo đúng lỗi, ví dụ "This file is over the 10 MB limit." hoặc "Choose a firm from the list. Free text is not accepted.".
- File hợp lệ được lưu trong trình duyệt (IndexedDB) **24 giờ**.
- PDF hay ảnh scan được dựng từng trang rồi gửi OCR qua `POST /api/ocr`, mỗi lần một trang. Trạng thái hiện "Reading scanned pages · k of N".
- **Nếu AI đang bật, upload tự chạy AI review luôn**, tốn 1 lượt.

### Ý nghĩa nút trạng thái stage
| Chữ trên nút | Nghĩa |
|---|---|
| Checks done · AI review off | AI đang tắt |
| Checks done · AI review running | Đang gọi AI |
| Checks done · AI review from cache | Lấy kết quả AI đã có sẵn |
| Checks done · AI review done | Kết quả AI vừa chạy mới |
| Checks done · AI review not run | Sample chưa có kết quả AI sẵn |
| Checks done · AI review skipped / unavailable | Bị hạ cấp vì hết quota, chưa xác minh, hoặc không đọc được firm rules |

---

## 3. Lộ trình demo đề xuất (khoảng 5 phút)

> Chuẩn bị: dùng trình duyệt thường, đã qua Turnstile một lần (để memory hoạt động), menu đặt **No AI**.
> Seed `ws_demo` đã có sẵn Partners Group: 7 decisions, rule `sr01` (proposed), và câu trả lời counsel A cho `sd06`/`sd07`.

| Bước | Thao tác | Màn hình hiện gì | Câu nói gợi ý |
|---|---|---|---|
| 1 | Doc switcher → **#1 Franklin Lexington PMF 2024** | Banner "Memory not applied" (sample không có firm). Hai finding "Fix before build" (high): *The text says "this Section 11" but it sits in Section 12 (Qualified Client Status…); a self-reference should cite Section 12.* Gate pill: **Ready to digitize**. | "Rule tìm ra tham chiếu tự trỏ sai. Lỗi này nằm trong đoạn representation nên là high, và gate không chặn: đúng chủ đích, vì nó không đổi đường đi của form." |
| 2 | Bấm finding đầu tiên | Tài liệu cuộn tới và tô vàng đoạn trích dẫn. Dòng finding mở rộng: Expected "Section 12 (…)", Found, "Rule ref-this-section · deterministic", "Why it was flagged". | "Mọi finding đều có trích dẫn thật, có rule id; chạy lại lần nữa vẫn ra đúng kết quả đó." |
| 3 | Doc switcher → **#5 PG NGI 2024** (đã có memory) | Hai tham chiếu "Part B" bị tráo hiện là **"Already answered"** (từ seed `sd06`/`sd07`), nằm trong nhóm **Previously handled**. Gate pill: **Ready to digitize**. | "Tool nhớ câu trả lời counsel từ quỹ trước của cùng firm. Analyst không phải hỏi lại cùng một câu." |
| 4 | Menu → **Partners Group memory** | Tab Decisions có 7 decisions, gồm `sd06` và `sd07`. Tab Rules có `sr01` ở trạng thái proposed (chưa có hiệu lực cho tới khi được duyệt). Tab Audit trail có các mục đã ghi. | "Mọi quyết định đều vào audit, không ai sửa hay xóa được." |
| 5 | Trong Decisions: **Reopen…** `sd06` (hoặc `sd07`) → nhập lý do → xác nhận | Toast xác nhận. Quyết định chuyển Reopened. | "Analyst có thể mở lại quyết định cũ, nhưng phải nêu lý do, và việc này nằm trong audit." |
| 6 | Quay lại **#5** | Finding của `sd06` quay về nhãn **New**, là critical (nằm trong ngữ cảnh điều hướng). Gate pill: **Blocked · 1** (hoặc 2 nếu mở lại cả hai). Bấm pill để xem lý do. | "Mở lại quyết định thì finding hiện lại và gate chặn lại ngay." |
| 7 | Menu → **Counsel questions** → mở câu hỏi của finding đó → **Record answer** → chọn **A** → **Save answer** | Toast "Answer recorded. The gate is now Ready." (nếu còn một mục thì "…N items left on the gate."). Gate pill chuyển **Ready to digitize**. | "Gate chỉ mở khi counsel trả lời. Đây là câu chuyện gate trên chính sample thật." |
| 8 | Menu → **Compare versions** → Base "PG NGI 2024", Compare "PG NGI 2026" (mặc định chế độ Versions) | Chip "Earlier findings": **4 fixed · 3 still present · 0 new**. Danh sách thay đổi: Appendix C bị bỏ; đổi tên Units→Shares (29 chỗ), Member→Shareholder, Memorandum→Prospectus, Placement Fee→Sales Load, placement agent→distributor; phí theo class (3.5% Class A, 1.5% Class S). | "Bản 2026 đã sửa hai tham chiếu bị tráo, và tool chỉ ra đúng những gì đổi." |
| 9 | (Tùy chọn) Doc switcher → **#9 RW Holdings scans** | Trình xem scan: chip 22 trang lần lượt chuyển sang Done, "22 of 22 read", ảnh trang bên trái, chữ đọc được bên phải, badge confidence. **Không gọi mạng**, vì OCR đã có sẵn. | "Bản scan 1200 DPI được đọc bằng model vision free, kết quả lưu sẵn." Finding footnote 2 thiếu ở Partnership/LLC **chưa được kiểm tra trên bản live**: xem trước rồi mới nói. |
| 10 | (Tùy chọn) Upload `fixtures/memory/fund-II.html`, firm "Firm X", AI off | Gate **"Blocked · 2"** (2 lỗi điều kiện gãy mức critical). Dismiss từng lỗi kèm lý do: toast "1 blocking reason left." rồi "The gate is now Ready." Lưu ý: dữ liệu Firm X không còn trong seed `ws_demo`, nên đây chỉ là cảnh dismiss, không có memory carry-over. | "Gate chặn số hóa cho tới khi mọi lỗi critical được xử lý." |
| 11 | (Tùy chọn) Trên một finding: **Needs counsel** → menu **Counsel questions** → **Export DOCX** → **Download DOCX** | Q1 dạng "Broken cross-reference at SUBSCRIPTION AGREEMENT INSTRUCTIONS: which reading should we digitize?", kèm các cách hiểu A/B/C. File DOCX được tải xuống. | "Câu hỏi gửi counsel được soạn sẵn, gom vào một lần gửi." |

**Cảnh Blocked không cần memory:** mở #5 trước khi qua Turnstile (hoặc trong phiên không có memory) sẽ thấy ngay "Blocked · 2", vì hai tham chiếu tráo là critical và chưa có câu trả lời. Đã kiểm chứng trên bản live.

---

## 4. Màn Findings: từng thành phần

```
Findings   7 open · 0 block digitization                      [Checks done · AI review … ▾]
[Banner: Memory not applied / Memory unavailable / AI review is off / AI review skipped …]
┌─ Reading view (DocPane) ───────────────────────┬─ Findings list ───────────────────────┐
│ Reading view · text extracted from HTML  [Jump to section ▾] │ [Blocks 0][Fix 2][Note 5] [Filter ▾] │
│                                                │ ▸ Fix before build: "agreement…" …    │
│  …văn bản tài liệu, đoạn bị gắn cờ được tô…    │   (dòng đang chọn mở rộng)            │
│                                                │ ▸ Note: A bank number (aba) ending…   │
│                                                │ …                                     │
│                                                │ ▸ Previously handled (n)              │
└────────────────────────────────────────────────┴───────────────────────────────────────┘
```

| Thành phần | Hiển thị gì | Bấm vào thì sao |
|---|---|---|
| **Dòng đếm** ("7 open · 0 block digitization") | Số finding đang mở / số finding chặn gate | — |
| **Banners** | "Memory not applied" (không có firm), "Memory unavailable…" (kèm Retry), "AI review is off", "AI review skipped: …" (kèm Retry), "No saved AI review for this sample…" (kèm nút **Run AI on this sample**, tốn 1 lượt) | Retry thì chạy lại bước bị lỗi |
| **Jump to section** | Danh sách section, mỗi section kèm số lỗi chặn và lỗi khác | Cuộn tới section đó |
| **Đoạn tô màu trong tài liệu** | Màu theo mức độ; finding đã dismiss thì mờ đi | Bấm vào đoạn tô = chọn finding tương ứng |
| **Chip mức độ** (Blocks / Fix / Note) | Blocks = critical, Fix = high, Note = medium hoặc low | Lọc danh sách. Bộ lọc được lưu lại sau khi tải lại trang. |
| **Filter ▾** | Class, Status (mặc định Active), Sort (mặc định Severity), Detector, "Reset filters", gợi ý phím J/K | Lọc và sắp xếp |
| **Dòng finding** | Icon mức độ, tiêu đề (câu đầu của lời giải thích), icon memory/AI, vị trí | Chọn finding: tài liệu cuộn tới và nháy sáng đoạn trích. **Phím J/K** đi tới finding sau/trước. |
| **Phần mở rộng của dòng** | Mức độ · loại lỗi · vị trí; chip vị trí; đoạn trích; Expected/Found; nhãn memory; provenance ("Rule xxx · deterministic", hoặc "AI suggestion · model · from cache/fresh"); "Why it was flagged" (giải thích, các cách hiểu A/B/C, Confidence %) | — |
| **Reveal / Hide** | Chỉ có ở finding thông tin nhạy cảm (số tài khoản) | Hiện hoặc che số trong cả danh sách lẫn tài liệu. Chỉ đổi cách hiển thị, không ghi gì. |
| **Previously handled (n)** | Gộp các finding đã xử lý ở quỹ trước (không phải lỗi chặn) | Mở ra các thẻ: tiêu đề, nhãn, người quyết định, quỹ, ngày, "Reason: …", nút **Reopen decision** |

### Các nút trên một finding: bấm vào thì chuyện gì xảy ra

| Nút | Trên màn hình | Phía sau (code → server) | Gate |
|---|---|---|---|
| **Accept** | Toast "Finding accepted." kèm Undo trong 7 giây. Bấm Accept lần nữa thì bỏ chấp nhận ("Accept removed."). | Trạng thái lưu trong trình duyệt (Dexie `triage:{docHash}`). Nếu tài liệu có firm và có phiên memory: hàng đợi outbox gửi `POST /api/runs` → `/api/runs/:id/findings` → `POST /api/decisions` (`decision:'accepted'`). Worker ghi trong **một batch**: audit `decision_recorded`, đánh dấu quyết định cũ là bị thay thế, tạo dòng `decision` mới, cập nhật `finding_state`. Chỉ lưu trích dẫn đã che và hash. | **Accept không mở gate.** Với lỗi critical, lý do đổi thành "accepted, waiting for counsel". |
| **Dismiss…** | Modal bắt buộc chọn lý do: "Law firm's standard wording" / "Does not affect the form" / "Tool false alarm" / "Other", kèm ghi chú tùy chọn (tối đa 500 ký tự). Bấm Save khi chưa chọn lý do sẽ báo "Choose a reason before saving…". Lưu xong có toast "Dismissed. N blocking reason(s) left." hoặc "…The gate is now Ready.", rồi tự chọn finding kế tiếp. | Giống Accept, với `decision:'dismissed'`. **Thêm phần đề xuất rule:** khi có ≥ 3 lần dismiss cùng firm, cùng mẫu lỗi, cùng lý do (trừ "Other"), server tạo một **rule đề xuất**, hiện ở Memory → Rules. | Dismiss có lý do = **đã xử lý**, không còn chặn gate |
| **Needs counsel** | Toast "Added to the counsel questions draft." kèm Undo. Badge Counsel tăng 1. | **Chỉ lưu trong trình duyệt, không gọi API.** | Lỗi critical có lý do "waiting for counsel" |
| **Undo** (trên toast) | Trả finding về trạng thái trước đó | Nếu quyết định chưa gửi thì hủy trong outbox. Đã gửi rồi thì gọi `POST /api/decisions/:id/revoke`: audit `decision_revoked`, quyết định chuyển `revoked`, `finding_state` về `open`. | Tính lại ngay |
| **Restore finding** (trên finding đã dismiss) | Toast "Finding restored." | Revoke giống Undo | Tính lại |
| **Reopen decision** (trong Previously handled) | Toast "Decision reopened. It is kept in the audit trail and the finding is New again." | `POST /api/decisions/:id/revoke`, rồi tải lại nhãn memory | Finding quay lại thành New; nếu là lỗi critical thì chặn gate lại |
| **Re-confirm dismissal…** (finding mang nhãn "Dismissed in …, re-confirm") | Mở modal Dismiss | Ghi một quyết định dismiss mới cho quỹ hiện tại | Hết lý do "Dismissed in {fund}, re-confirm" |

**Đường đi của một quyết định** (`api/outbox.ts`): trạng thái queued → sending → synced. Nếu lỗi tạm thời thì retry; hết hạn mức ghi trong ngày thì chờ sang ngày (deferred); memory sập thì tạm gác (parked); bị từ chối hẳn thì thành rejected. Chip "N unsynced" đếm các thao tác còn đang chờ. Nếu server báo xung đột (409, có quyết định khác đang active), app tải lại memory để hiện quyết định hiện hành.

---

## 5. Gate: quy tắc

| Tình huống của một finding **critical, không phải AI** | Gate |
|---|---|
| Còn mở, nhãn New | Chặn: "not resolved" |
| Accepted | Chặn: "accepted, waiting for counsel" |
| Needs counsel | Chặn: "waiting for counsel" |
| Counsel trả lời "unclear" | Chặn: "counsel answered unclear" |
| Mang nhãn "Dismissed in {fund}, re-confirm" | Chặn cho tới khi xác nhận lại |
| Dismissed có lý do | **Không chặn** |
| Counsel trả lời A, B hoặc C | **Không chặn** (nếu là mục re-confirm thì cũng tính là đã xác nhận lại) |
| Nhãn Already answered | Không chặn |

- **Quy tắc mức độ cho tham chiếu sai** (`ref-label-coherence`, `ref-this-section`): là **critical ("Blocks digitization")** khi tham chiếu nằm trong *ngữ cảnh điều hướng* (phần hướng dẫn, một answer option, hoặc một khối chứa điều kiện); ngoài ra là **high**. Ví dụ: 4 tham chiếu "Part B" bị tráo trên #3/#5 là critical; "this Section 11" trên #1 là high.
- **Finding high, medium, low và mọi finding AI không bao giờ chặn gate.** AI không bao giờ gate.
- Chưa mở tài liệu nào thì pill hiện "No document" (trung tính), không phải "Ready to digitize".
- Bấm một lý do trong popover: lý do liên quan counsel thì nhảy sang màn Counsel; lý do khác thì nhảy sang Findings và chọn đúng finding.
- Hết lý do thì pill chuyển xanh, "Ready to digitize".

---

## 6. AI lane

| Thao tác | Diễn biến |
|---|---|
| Mở sample | Đọc firm rules (nếu không đọc được thì hiện "rules_unavailable"), tính hash rules, tìm file `precomputed`. Có file thì app vẫn **kiểm tra lại ngay trong trình duyệt** (trích dẫn phải có thật, che số nhạy cảm, giới hạn mức độ), rồi hiện các finding AI "from cache". Không có file thì sample hiện banner "No saved AI review…". |
| **Run AI on this sample** / upload khi AI bật | Gửi `POST /api/ai` (header `x-aduin-client`, `x-aduin-doc`, token Turnstile). Ở Worker: kiểm tra header → giới hạn tốc độ → kiểm tra body → nhận diện visitor → đọc firm rules → **tra cache D1** (trúng cache thì không tốn lượt nào) → Turnstile → trừ quota → gọi OpenRouter **model free** (stream) → ghi cache và sổ chi phí. Trình duyệt chạy `verifyAi`: finding nào có trích dẫn không tìm thấy trong tài liệu thì **bị loại**. |
| Finding AI | Có nhãn "AI suggestion" kèm tên model và "fresh"/"from cache". **Không bao giờ chặn gate.** |
| Chuyển sang "No AI" | Xóa finding AI, hiện banner "AI review is off. Rules, memory and the gate still work…". Bản scan cũng không gửi OCR nữa. |
| Các banner hạ cấp | "your fresh-AI documents for today are used up", "today's shared AI allowance is used up", "a quick verification is needed…", "the AI provider did not answer", "the firm rules changed…", và các banner khác. Banner do hết quota sẽ tự chạy lại lúc 00:00 UTC. |

---

## 7. Màn Counsel questions (#counsel)

**Câu hỏi gồm những gì:** finding ở trạng thái "Needs counsel", hoặc finding critical đã Accepted, sắp theo thứ tự trong tài liệu, đánh số Q1..n.

| Thành phần | Hiển thị gì | Bấm vào thì sao |
|---|---|---|
| Dòng đếm | "N questions · M unanswered" | — |
| **All / Unanswered** | Bộ lọc | Lọc danh sách |
| **AI draft** | Tắt khi AI tắt | Gọi `/api/ai` với task `counsel-draft` (tốn lượt). Thành công: "AI draft ready. Check the wording before you send it.". Thất bại: dùng lại câu chữ template. Bấm lần nữa để quay về template. |
| **Export DOCX** | — | Mở dialog xem trước (§ dưới) |
| Dòng gate | "Digitization is blocked · N critical items open" và "Accepting a finding does not open the gate. Only a counsel answer does." | **See reasons** mở popover gate |
| Dòng câu hỏi | Icon mức độ, Qn, câu chữ (thứ tự ưu tiên: bản đã sửa > bản AI > template), tag New/Accepted/Answered/Unclear | Mở rộng dòng |
| Phần mở rộng | Đoạn trích đã che số; các cách hiểu A/B/C; tag "Template draft"/"AI suggestion"/"Edited by you" | — |
| **Edit wording** | Ô soạn thảo, tối đa 2000 ký tự | **Save wording** lưu vào trình duyệt; "Reset to … draft" quay về bản gốc |
| **Record answer** | Form: A/B/C/? (unclear), Note, Answered by (mặc định "Counsel, <firm>"), Date | **Save answer**, xem bảng dưới |
| **Already answered (n) · Awaiting counsel (n)** | Thu gọn, có nhãn "Not exported to counsel". Mục Awaiting có nút **Record counsel's answer**. | Ghi câu trả lời theo cùng luồng Record answer |
| **Metrics** (cuối màn, sau lần export đầu tiên) | "Defects found before build", "Questions batched N in one round", "Time to exportable sheet" | — |

### Save answer: chuyện gì xảy ra
1. Nếu đã có câu trả lời trước đó, app thu hồi câu cũ.
2. Ghi vào trình duyệt ngay → giao diện và gate đổi ngay.
3. Outbox gửi: nếu chưa có câu hỏi trên server thì tạo trước (`POST /api/counsel/questions`), rồi gửi `POST /api/counsel/answers`. Worker ghi **trong một batch**: audit `answer_recorded`, tạo dòng `counsel_answer`, thay quyết định cũ bằng quyết định `answered`, đổi câu hỏi sang `answered`, cập nhật `finding_state`.
4. Toast "Answer recorded. The gate is now Ready." hoặc "Recorded as unclear. N items left on the gate.", kèm Undo.

| Phương án | Kết quả |
|---|---|
| A / B / C | Câu hỏi thành "Answered"; **ra khỏi gate**; không còn trong file export. Quỹ sau của cùng firm, nếu có cùng đoạn văn, sẽ mang nhãn **Already answered**. |
| ? (unclear) | Tag "Unclear"; **vẫn chặn gate**; vẫn ở trong file export với ghi chú "Earlier answer: unclear · follow-up needed". |

### Export DOCX
- **Dialog xem trước:**
  - "N unanswered questions go to counsel: x New, y Accepted".
  - Cảnh báo "The gate is still Blocked… Exporting does not clear it.".
  - Xem trước từng câu hỏi, và danh sách "Left out of this export (n)".
- **Download DOCX:**
  1. **Tạo file DOCX trước**, bằng thư viện `docx`.
  2. Ghi vào memory: `POST /api/runs`, `/api/counsel/questions`, `/api/runs/:id/export`. Worker ghi audit `counsel_sheet_exported` và đổi câu hỏi sang `exported`.
  3. **File luôn được tải xuống**, kể cả khi memory lỗi. Khi đó toast ghi thêm "Saved locally; not recorded in memory.".
- **Export không thay đổi gate.**

---

## 8. Màn Structure (#structure)

| Thành phần | Hiển thị gì | Bấm vào thì sao |
|---|---|---|
| Dòng đếm | "N to check · X sections, Y references" | — |
| **6 lens** | Sections, Cross-references (mặc định), Conditions, Option groups, Defined terms, Investor types. Lens nào có vấn đề thì kèm chip "⚠ N to check". | Đổi lens (phím ←/→ cũng được) |
| **Show everything** | Mặc định chỉ hiện các dòng có vấn đề | Hiện đủ mọi dòng. Ở lens Cross-references, chế độ này hiện thêm bảng "External, not checked" (trích dẫn luật bên ngoài). |
| **Bảng** | Ví dụ Cross-references: văn bản, vị trí, trỏ tới đâu, trạng thái (Resolved / Suspicious / Unresolved). Defined terms: Defined, Used before defined, Defined twice, Not defined… | Bấm một dòng mở **drawer** |
| **Drawer** | Loại, tiêu đề, Expected/Found, các dữ kiện, phần "why", và "Rule XREF-02 · deterministic · Same result on every run" | **Show in document**: chuyển sang Findings, chọn finding liên quan và cuộn tới |
| **Investor types** | Bên trái: các loại nhà đầu tư, kèm "x of N sections" và badge gap. Bên phải: đường đi theo thứ tự; các section bị bỏ qua gộp thành một dòng "Skipped: …"; dòng gap, ví dụ "… is missing here — <peers> have it", kèm "Rule PATH-04" | Bấm dòng thì mở drawer; **Show in document** |
| **Export logic outline** | Xem trước số section, tham chiếu, nhánh, thuật ngữ, đường đi | Tải file JSON (kiểm tra schema trước). Không gọi API. |

Structure **không lưu gì**. Nó là cách nhìn khác trên cùng kết quả engine.

---

## 9. Màn Compare versions (#compare)

| Thành phần | Hiển thị gì | Bấm vào thì sao |
|---|---|---|
| **Base / Compare** | Các sample HTML và file đã upload (html/pdf/docx). **Không có bản scan.** | Chọn hai tài liệu, diff chạy trong engine worker |
| **⇄ Swap** | — | Đảo base và compare |
| **Versions / Siblings** | Mặc định Versions | Siblings: đánh dấu từng điều khoản là chung, khác nhau, hay chỉ có ở một bên |
| **Chip** | Changes (added / removed / renamed / changed) và Earlier findings (fixed / still present / new). Chip có số 0 bị tắt. | Lọc danh sách; **Clear** để bỏ lọc |
| **Danh sách thay đổi** | Các nhóm: Sections, Terms renamed, Definitions, Fees, Requirements, Earlier findings, "Low confidence, not counted" | Chọn một mục → khung diff |
| **Khung diff** | Chữ thêm/bớt đánh dấu bằng gạch chân và gạch ngang, có chú thích, **không chỉ dựa vào màu**; hoặc hai cột Base/Compare; footer "Rule-based diff · deterministic, no AI" | Reveal nếu có số nhạy cảm |
| **Needs counsel** | Chỉ bật khi mục đó gắn với một finding **của tài liệu đang mở** | Giống Needs counsel ở Findings. Khi tắt, nút ghi "Only changes linked to a finding in the open document can be sent to counsel." |
| **Summarize changes** | Chỉ có ở chế độ Versions | Gọi `/api/ai` với task `drift-narrative` (tốn lượt): tóm tắt các thuật ngữ bị đổi tên |

Kết quả #5 → #6 (khóa bằng golden test): **removed 1** (Appendix C), **renamed 1**, **changed 21**, same 9; **fixed 4, still present 3, new 0**.

---

## 10. Màn Firm memory ("Partners Group memory")

> Chỉ có dữ liệu khi tài liệu đang mở thuộc một firm. Không có firm thì màn hiện "Open a document for a law firm to see its memory.".

**Khi vào màn:** app tạo phiên nếu chưa có, rồi gọi song song `GET /api/memory/firm`, `/api/rules` và `/api/audit`. Lỗi thì hiện "Memory unavailable… Retry".

**Đầu trang:**
- "{Firm} memory".
- "N decisions (A active) · R rules · S suggested".
- Nút ⓘ "What memory keeps": chỉ lưu trích dẫn ngắn đã che số, hash và metadata; sandbox lưu 30 ngày.

| Tab / thao tác | Trên màn hình | Gọi API | Ghi gì vào D1 | Ảnh hưởng tới finding / gate |
|---|---|---|---|---|
| **Decisions** | Lọc theo loại lỗi và All/Active/Reopened. Cột: Decision, Quoted passage, Issue class, Fund, Decided by, Status. | `GET /api/memory/firm` | — | — |
| **Reopen…** | Modal "Reopen this decision?", **bắt buộc có lý do** | `POST /api/decisions/:id/revoke` | audit `decision_revoked`, `decision.status='revoked'`, `finding_state` về `open` | Finding quay lại thành **New**. Nếu là lỗi critical thì gate chặn lại. |
| **Rules → Suggested → Review** | Modal liệt kê "Matching dismissals: N" và "No effect until approved." | `POST /api/rules/:id/approve` hoặc `/reject` | Đổi trạng thái rule, kèm audit | Rule **chỉ là ngữ cảnh cho AI**: không lọc finding, không ảnh hưởng gate. Duyệt rule làm đổi hash rules, nên kết quả AI đã lưu cũ không còn được dùng. |
| **Add rule** | Một ô nhập 1–500 ký tự | `POST /api/rules` | Rule mới (`manual`, active), kèm audit | Như trên |
| **Deactivate…** | Bắt buộc có lý do | `POST /api/rules/:id/revoke` | Rule chuyển `revoked`, kèm audit | Như trên |
| **Audit trail** | "Entries cannot be edited or removed.", lọc theo loại; mục mới nhất ở trên | `GET /api/audit` | — | — |

**Sandbox và chế độ chỉ đọc:**
- Mỗi visitor có một **sandbox riêng**, sao chép từ seed demo.
- Giới hạn: tối đa 5 sandbox mới mỗi IP mỗi ngày; toàn hệ thống 300 sandbox mỗi ngày. Mở lại khi còn cookie thì dùng lại sandbox cũ.
- Vượt giới hạn toàn hệ thống thì visitor vào **chế độ chỉ đọc**: thấy thông báo "This demo workspace is read-only…", các nút ghi bị tắt, quyết định chỉ lưu trong trình duyệt.

---

## 11. Bản scan #9 (RW Holdings)

- Gồm: "Scanned pages · text read by OCR · N of 22 read", Previous/Next, "Page n of 22", hàng chip trang (Queued / Reading / Done / Failed / No text), ảnh trang bên trái kèm khung đánh dấu vùng của finding, chữ OCR bên phải.
- OCR được lấy theo thứ tự: file tính sẵn (`precomputed/ocr/index.json`, 22 file) → cache trình duyệt → `POST /api/ocr`. **Sample #9 dùng file tính sẵn nên không cần mạng, Turnstile hay quota**, kể cả khi đang ở "No AI".
- Confidence: badge "Confidence 0.xx"; trang dưới 0.6 có cảnh báo màu vàng. Dữ liệu hiện tại có điểm cao (0.90–1.0), nên nhiều khả năng không trang nào bị cảnh báo.
- **Finding footnote 2** (Partnership/LLC thiếu footnote 2 mà các loại khác có) đã được golden test chứng minh trên dữ liệu thử, **nhưng chưa xác minh trên bản live 22 trang**. Hãy mở trước khi demo để chắc chắn nó có.

---

## 12. Lỗi, chỗ chưa xong và rủi ro thấy được trên UI

| # | Vấn đề | Nơi | Trạng thái / mức ảnh hưởng tới demo |
|---|---|---|---|
| 1 | Sample thật không có finding critical nên gate luôn "Ready to digitize" | `findings/severity`, các detector | **Đã sửa** (live `47d98295`): tham chiếu sai trong ngữ cảnh điều hướng là critical; #5 mở không có memory hiện "Blocked · 2". |
| 2 | Chưa mở tài liệu nào mà gate vẫn hiện "Ready to digitize" | `GateButton` | **Đã sửa** (live `47d98295`): hiện "No document" trung tính. |
| 3 | Seed D1 không khớp sample nào | `apps/worker/seed/demo.sql` | **Đã sửa** (live `47d98295`): `ws_demo` là Partners Group, 7 decisions, rule `sr01` (proposed). |
| 4 | Màn Documents là placeholder | `registry.ts` | Thấp (tránh bấm là được) |
| 5 | Tiêu đề finding lộ thuật ngữ nội bộ "(fit 0)", "(fit 0.5)" | detector `ref-label-coherence` | **Đã sửa** (live `47d98295`): tiêu đề không còn "(fit …)". |
| 6 | Nút "Needs counsel" ở Compare khi bị tắt ghi câu chữ cũ "Available after counsel sheet (Phase 08)" | `compare/CompareScreen.tsx` | **Đã sửa** (live `47d98295`): "Only changes linked to a finding in the open document can be sent to counsel." |
| 7 | "Needs counsel" ở Findings không ghi vào memory (chỉ lưu trong trình duyệt) | `state/review.ts needsCounsel` | Thấp |
| 8 | Memory và AI cần qua Turnstile; trình duyệt tự động không qua được | toàn app | Trung bình: phải dùng trình duyệt thường |
| 9 | Finding footnote 2 trên #9 chưa xác minh trên bản live | `footnote-requirement` | Trung bình |
| 10 | `setCounselAnswer` trong `state/review.ts` có vẻ là code thừa | — | Không ảnh hưởng |
| 11 | Heading dạng "Section N." / "Article I." chưa được nhận là section; đích của điều kiện kiểu Annex / Question chưa được phân giải | structurer, detector điều kiện | **Đã sửa ở core** (Intake Phase 1, live `328ca295`); phần UI của intake chưa nối. Cần đo lại trên các package 02/03. |

Mục 1, 2, 3, 5 và 6 đã được sửa và live từ version `47d98295`; mục 11 đã sửa ở core và live ở `328ca295-d5da-487e-a063-843b0c7c86db` (code `1f5cfa5`). Các mục còn lại là gap đã biết, không cần sửa trước khi nộp.

---

## Phụ lục: các bảng D1 bị ghi theo từng thao tác

| Thao tác | Bảng D1 |
|---|---|
| Mở tài liệu có firm (lần đầu) | workspace, analyst, các bảng sao chép seed, audit `session_created` |
| Accept / Dismiss | review_run, finding, decision, finding_state, audit_event, (firm_rule + rule_evidence nếu đủ điều kiện đề xuất) |
| Undo / Restore / Reopen | decision (revoked), finding_state, audit_event |
| Record answer | counsel_question, counsel_answer, decision (answered), finding_state, audit_event |
| Export DOCX | review_run (sheet_exported_at), counsel_question (exported), audit_event |
| Approve / Reject / Add / Deactivate rule | firm_rule, audit_event |
| AI chạy mới | ai_cache, quota_counter, spend_ledger |

TL;DR: Demo bằng trình duyệt thường đã qua Turnstile, để menu ở No AI. Đi theo thứ tự #1 (high, gate Ready) → #5 (Already answered từ seed) → Memory (Reopen sd06) → #5 (New, Blocked) → Counsel questions (Record answer A, Ready) → Compare #5→#6 → (#9). Gate chặn ở #3/#5, không chặn ở #1. Đừng bấm vào Documents.
