# Bấm gì, chọn gì khi quay demo (đi kèm `script.md`)

Chữ trong **ngoặc kép in đậm** là đúng chữ trên màn hình (tiếng Anh). Lấy từ code ngày 19/10/2026 (bản live `0205848c`); chưa bấm thử trọn vẹn trên live, nên tập một lần trước khi quay.

Link: https://preflight-legal-reviewer.giathaowork.workers.dev

---

## 0. Chuẩn bị (trước khi bấm quay)

| # | Bấm vào đâu | Chọn / gõ gì | Màn hình sẽ thấy |
|---|---|---|---|
| 0.1 | Mở link trên Chrome thường (không phải cửa sổ tự động), kích thước 1440 px | Nếu Cloudflare hỏi "Verify you are human" thì tick | Vào app |
| 0.2 | Góc dưới menu trái: **"Start fresh"** | Hộp thoại **"Start fresh?"** → bấm **"Start fresh"** | App trống, không có tài liệu |
| 0.3 | Menu trái, công tắc AI | Bấm **"No AI"** | Công tắc sáng ở "No AI" |
| 0.4 | Mở thêm một cửa sổ ẩn danh (Cmd+Shift+N) | Để trống, dùng cho vai counsel ở bước 4 | — |

---

## 1. Mở gói Northgate (script 1:40–2:00)

| # | Bấm vào đâu | Chọn / gõ gì | Màn hình sẽ thấy |
|---|---|---|---|
| 1.1 | Ô đầu menu trái: **"Open a document"** (nếu đã có tài liệu thì bấm ô đó rồi chọn **"Open another document…"**) | — | Hộp thoại **"Open a document"** |
| 1.2 | Dòng **"Or try a demo package"** (mục thu gọn, ghi "7 packages") | Bấm để mở ra | Danh sách gói demo |
| 1.3 | Nút **"Northgate Capital III"** (dòng phụ "6 files") | — | Bước **"Confirm the package"**, bảng có cột File, Type, Role, Confidence, Why, Confirm. Dòng "Reading the files…" chạy xong thì hiện đủ 6 file |
| 1.4 | Dòng file **01** (`01-NG3-Subscription-Agreement…`), cột **Role** | Chọn **"To digitize"** | — |
| 1.5 | Dòng file **04** (`04-NG2-Subscription-Agreement-2024…`), cột **Role** | Chọn **"Baseline (earlier version)"** | — |
| 1.6 | Cột **Confirm** | Tick **"Confirmed"** ở mọi dòng còn chưa tick (ít nhất 01 và 04) | Dòng nhắc lỗi phía dưới biến mất |
| 1.7 | Ô **"Version label (required for a package)"** | Đã có sẵn `v1`, để nguyên | — |
| 1.8 | Nút **"Run checks"** | — | Màn **Findings** mở ra |

Nếu "Run checks" vẫn mờ, đọc dòng nhắc ngay trên nút. Ví dụ "Confirm or fix … before running checks." nghĩa là còn dòng chưa tick.

---

## 2. Finding Annex F và đóng một lỗi (script 2:00–2:25)

| # | Bấm vào đâu | Chọn / gõ gì | Màn hình sẽ thấy |
|---|---|---|---|
| 2.1 | Panel phải, dòng đầu tiên (Annex F, biểu tượng đỏ **"Blocks"**) | Bấm vào dòng | Dòng mở rộng; tài liệu bên trái cuộn tới câu "…please complete Annex F" và nháy sáng |
| 2.2 | Thanh dưới cùng panel: **"Ask counsel"** | — | Toast **"Sent to counsel · Counsel questions now 1 · Gate still blocked (10)"**, dòng kế tiếp tự mở |
| 2.3 | Bấm dòng có **"[insert Final Closing Date]"** | — | Dòng mở rộng |
| 2.4 | Thanh dưới cùng: **"Close issue"** | Hộp thoại **"Close issue"** → chọn **"Real issue — I'll handle it in the form build"** → bấm nút **"Close issue"** | Toast **"Closed as a real issue · Gate still blocked (…)"** |
| 2.5 | Chỉ chuột vào ô gate ở góc dưới menu trái | Không bấm | **"Blocked · 10"** (đọc đúng số đang hiện) |

---

## 3. Chia sẻ cho counsel (script 2:25–3:00)

Cần làm bước 2.2 trước: nút share chỉ bật khi đã có ít nhất một câu hỏi cho counsel.

| # | Bấm vào đâu | Chọn / gõ gì | Màn hình sẽ thấy |
|---|---|---|---|
| 3.1 | Header Findings: **"Share with counsel"** | — | Toast **"Link copied. Valid until …"** (link đã nằm trong clipboard) |
| 3.2 | Chuyển sang cửa sổ ẩn danh, dán link vào thanh địa chỉ, Enter | — | Hộp thoại **"Open the shared review"** |
| 3.3 | Ô **"Your name"** | Gõ ví dụ `Hartwell Counsel` → bấm **"Open review"** | Counsel thấy màn Findings |
| 3.4 | Bấm dòng Annex F → nút **"Answer"** | Chọn một đáp án (A hoặc B; chữ đáp án là cách hiểu đọc được trên màn hình) → bấm **"Save answer"** | Câu hỏi chuyển thành đã trả lời |
| 3.5 | Quay lại cửa sổ analyst, đợi khoảng 20 giây | — | Cạnh nút share hiện tên counsel; gate giảm từ **10** xuống **9** |

Nếu nút share mờ, đọc dòng nhỏ dưới nút. Ví dụ "Memory is read-only in this session (verify you are human, then reload)…" nghĩa là chưa qua Turnstile: tải lại trang và tick xác minh.

---

## 4. Thay đổi so với Fund II (script 3:00–3:15)

| # | Bấm vào đâu | Chọn / gõ gì | Màn hình sẽ thấy |
|---|---|---|---|
| 4.1 | Panel phải, thanh **"All · Errors · Changes"** | Bấm **"Changes"** | 9 dòng thay đổi, mỗi dòng có nhãn **"Logic"** hoặc **"New"** và chip người phụ trách (Counsel / GP / Fund admin) |
| 4.2 | Header: ô **"vs 04-NG2-Subscription-Agreement-2024.docx"** | Chỉ chuột, không bấm | Cho thấy đang so với Fund II |

---

## 5. Câu hỏi theo người trả lời và gate (script 3:15–3:30)

| # | Bấm vào đâu | Chọn / gõ gì | Màn hình sẽ thấy |
|---|---|---|---|
| 5.1 | Menu trái: **"Questions"** | — | Tab **"All"**, **"Counsel"**, **"GP"**, **"Fund admin"** |
| 5.2 | Kéo xuống nhóm **"For the GP"** | — | 7 tài liệu còn thiếu, mỗi mục kèm câu trích |
| 5.3 | (Tùy chọn) **"Export request DOCX"** | — | Tải file Word yêu cầu gửi GP |
| 5.4 | Ô gate góc dưới menu trái | Bấm | Popover **"Digitization is blocked"** với danh sách lý do |

Không bấm **"Mark ready to digitize"**: nút này chỉ bật khi gate về 0.

---

## Tùy chọn: xem file nguồn (Source File)

| # | Bấm vào đâu | Chọn / gõ gì | Màn hình sẽ thấy |
|---|---|---|---|
| A | Menu trái **"Structure"** → tab **"Terms & package"** | Bấm **"Open in LPA →"** cạnh "Capital Commitment" | Màn đọc chuyển sang LPA, nháy sáng định nghĩa; thanh **"Viewing LPA (reference file)"** |
| B | Thanh trên màn đọc | Bấm **"← Back to Subscription Agreement"** | Quay lại sub doc |
| C | Findings → mở finding "Units" → **Details** | Dòng **"Source File"**, bấm tên file LPA | Mở LPA như bước A |
