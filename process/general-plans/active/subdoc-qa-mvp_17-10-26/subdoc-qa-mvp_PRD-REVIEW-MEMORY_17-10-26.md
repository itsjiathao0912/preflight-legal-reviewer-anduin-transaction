# PRD: Review Memory cho tool review hồ sơ trước số hóa

Oct 17, 2026 · @Thao Dao

## Tóm tắt

Review Memory lưu lại mọi quyết định của analyst và câu trả lời của luật sư, để lần review sau tool không báo lại lỗi đã xử lý và không hỏi lại câu đã có đáp án. Bộ nhớ gắn theo từng công ty luật, vì các công ty luật dùng lại template qua nhiều quỹ.

Kết quả mong đợi: mỗi quỹ Anduin số hóa giúp tool chính xác hơn cho quỹ tiếp theo, mà vẫn để con người kiểm soát: tool không bao giờ âm thầm xóa một lỗi, chỉ gom nó vào mục "Đã xử lý trước đây" kèm lý do.

## Vì sao cần feature này

Không có bộ nhớ, tool review sẽ bắt analyst xử lý lại cùng một việc ở mỗi quỹ, và analyst sẽ bỏ tool sau vài tuần. Anduin đã số hóa cho hơn 1.274 quỹ, và các công ty luật dùng lại template, nên cùng một đoạn văn sẽ xuất hiện lại rất nhiều lần. Có 4 vấn đề cụ thể:

1. **Báo nhầm lặp lại làm mất niềm tin.** Mỗi công ty luật có cách viết riêng hợp lệ (ví dụ dùng "Subscriber" thay "Investor"). LLM sẽ báo cách viết đó là lỗi ở mọi quỹ. Analyst phải bỏ qua thủ công mỗi lần, và càng nhiều báo nhầm thì họ càng bỏ qua cả lỗi thật.
2. **Hỏi lại luật sư câu đã có đáp án.** Luật sư đã trả lời "ý chúng tôi là Section 4" ở quỹ I. Quỹ II dùng cùng template, nếu tool hỏi lại thì tốn thời gian của luật sư và làm Anduin trông thiếu chuyên nghiệp.
3. **Kiến thức nằm trong đầu từng analyst.** "Công ty luật X hay viết nhầm tham chiếu ở mục AML" là kinh nghiệm không được ghi lại. Analyst nghỉ việc thì kiến thức mất theo; analyst mới phải học lại từ đầu.
4. **Không tận dụng được lợi thế quy mô.** Dữ liệu từ hơn 1.000 quỹ đã số hóa là tài sản đối thủ không có. Không có bộ nhớ, tool ở quỹ thứ 1.000 cũng "ngây thơ" như ở quỹ đầu tiên.

Nếu không giải quyết: tool review chỉ là một máy dò lỗi dùng một lần, chi phí số hóa mỗi quỹ không giảm theo thời gian, và vòng hỏi đáp với luật sư vẫn chậm như cũ.

Số quỹ lấy từ [trang About của Anduin](https://anduintransact.com/about). Các vấn đề trên là giả thuyết, cần xác nhận với Anduin (xem mục Rủi ro).

## Mục tiêu và phi mục tiêu

**Mục tiêu**

1. **Không báo lại lỗi đã xử lý.** Khi cùng công ty luật, cùng đoạn văn, cùng loại lỗi xuất hiện lại, 100% được chuyển vào mục "Đã xử lý trước đây" thay vì báo như lỗi mới.
2. **Không hỏi lại luật sư.** Câu đã có đáp án được hiển thị kèm câu trả lời cũ và không tự động vào email gửi luật sư.
3. **Giảm số lỗi analyst phải xem ở lần review thứ hai.** Trong demo, hồ sơ quỹ II của cùng công ty luật giảm ít nhất 50% số lỗi cần xử lý so với không có bộ nhớ.
4. **Không làm sót lỗi thật.** 0 trường hợp một lỗi mới (đoạn văn đã sửa) bị ẩn nhầm vì giống lỗi cũ.

**Phi mục tiêu (bản hackathon)**

- **Không tự động tạo quy tắc mới từ dữ liệu.** Việc tool tự đề xuất biến lỗi lặp lại thành quy tắc cố định (agentic) để v2, vì cần nhiều dữ liệu thật.
- **Không khớp "na ná" bằng embedding.** Chỉ khớp đoạn văn giống hệt sau chuẩn hóa. Khớp gần đúng dễ ẩn nhầm lỗi thật.
- **Không fine-tune hay huấn luyện lại model.** Bộ nhớ là dữ liệu tra cứu, không thay đổi model.
- **Không phân quyền, đăng nhập nhiều người dùng.** Demo dùng một analyst giả lập; phân quyền là việc của hệ thống Anduin khi tích hợp.

## Người dùng và user stories

Người dùng chính là **Digitization Analyst** của Anduin. Người hưởng lợi gián tiếp là **luật sư của quỹ** (bị hỏi ít hơn) và **team lead** (kiểm soát được chất lượng).

**Digitization Analyst**

1. Là analyst, tôi muốn bỏ qua một lỗi báo nhầm kèm lý do, để lần sau gặp lại đoạn đó của cùng công ty luật thì tool không báo nữa.
2. Là analyst, tôi muốn ghi câu trả lời của luật sư vào đúng lỗi, để quỹ sau tôi thấy ngay đáp án mà không phải hỏi lại.
3. Là analyst, tôi muốn thấy những lỗi đã bị ẩn và lý do, để tôi tự kiểm tra nếu nghi ngờ.
4. Là analyst, tôi muốn mở lại một lỗi đã bị bỏ qua nếu phát hiện quyết định cũ sai, để bộ nhớ không giữ mãi một quyết định sai.
5. Là analyst mới, tôi muốn thấy các quy tắc riêng của từng công ty luật, để không phải hỏi đồng nghiệp hoặc học lại từ đầu.

**Team lead**

6. Là team lead, tôi muốn biết ai đã bỏ qua lỗi nào, khi nào và vì sao, để kiểm tra khi có sự cố.

**Trường hợp biên**

7. Khi luật sư sửa một chữ trong đoạn văn đã từng bị bỏ qua, tool phải báo lại như lỗi mới, vì nội dung đã khác.
8. Khi công ty luật là mới hoàn toàn, tool hoạt động bình thường như không có bộ nhớ.

## Yêu cầu chức năng

P0 là bản tối thiểu phải có trong demo. P1 làm nếu còn thời gian. P2 chỉ đưa vào slide hướng phát triển.

| ID | Ưu tiên | Yêu cầu | Tiêu chí nghiệm thu |
| --- | --- | --- | --- |
| R1 | P0 | Ghi quyết định: analyst chọn Accept, Dismiss hoặc Answered cho mỗi lỗi | Dismiss bắt buộc chọn lý do; mỗi quyết định lưu đủ các trường ở mục Mô hình dữ liệu |
| R2 | P0 | Ghi câu trả lời của luật sư vào lỗi tương ứng | Analyst nhập được đáp án (ví dụ "A") và ghi chú; trạng thái lỗi chuyển sang Answered |
| R3 | P0 | Tra bộ nhớ trước khi hiển thị kết quả review | Mỗi lỗi được gắn nhãn: Mới, Đã bỏ qua trước đây, hoặc Đã có đáp án |
| R4 | P0 | Gom lỗi đã xử lý vào mục riêng, không xóa | Mục "Đã xử lý trước đây (n)" thu gọn được, mở ra thấy lý do, người quyết định và ngày |
| R5 | P0 | Loại lỗi đã có đáp án khỏi email gửi luật sư | Email chỉ chứa lỗi Mới đã được Accept |
| R6 | P1 | Mở lại (reopen) một quyết định cũ | Quyết định bị đánh dấu hết hiệu lực (không xóa); lỗi hiện lại như lỗi Mới |
| R7 | P1 | Quy tắc riêng theo công ty luật, do analyst nhập | Ví dụ "Firm X dùng Subscriber thay Investor" được thêm vào prompt của LLM khi review hồ sơ Firm X |
| R8 | P1 | Trang xem bộ nhớ theo công ty luật | Liệt kê quyết định và quy tắc của một công ty luật, lọc theo loại lỗi |
| R9 | P2 | Tự đề xuất quy tắc từ quyết định lặp lại | Một lỗi bị bỏ qua ≥ 3 lần với cùng lý do → tool đề xuất thành quy tắc; analyst duyệt mới áp dụng |
| R10 | P2 | Hết hạn quyết định | Quyết định cũ hơn N tháng hoặc trước khi luật đổi được đánh dấu cần xem lại |

## Mô hình dữ liệu

Bộ nhớ gồm 2 bảng trong SQLite: `decisions` (quyết định trên từng lỗi) và `firm_rules` (quy tắc riêng theo công ty luật). Dữ liệu chỉ được thêm hoặc đánh dấu hết hiệu lực, không bao giờ xóa, để luôn kiểm tra lại được.

**Bảng `decisions`**

| Trường | Kiểu | Ý nghĩa |
| --- | --- | --- |
| id | text | Mã quyết định |
| fingerprint | text | Khóa khớp, tính từ law\_firm + issue\_type + quote\_hash (xem mục Logic khớp) |
| law\_firm | text | Tên công ty luật soạn hồ sơ |
| fund\_name | text | Quỹ nơi quyết định được đưa ra |
| issue\_type | text | ambiguity, contradiction, typo, missing\_reference, term\_inconsistency, form\_logic |
| section | text | Vị trí trong hồ sơ gốc |
| quote | text | Đoạn văn nguyên văn |
| quote\_hash | text | SHA-256 của đoạn văn sau chuẩn hóa |
| decision | text | accepted, dismissed, answered |
| reason | text | Lý do bỏ qua (bắt buộc khi dismissed) |
| counsel\_answer | text | Đáp án luật sư chọn, ví dụ "A" |
| counsel\_note | text | Ghi chú thêm từ luật sư |
| decided\_by | text | Analyst ra quyết định |
| decided\_at | datetime | Thời điểm |
| status | text | active hoặc revoked |

**Bảng `firm_rules`**

| Trường | Kiểu | Ý nghĩa |
| --- | --- | --- |
| id | text | Mã quy tắc |
| law\_firm | text | Công ty luật áp dụng |
| rule\_text | text | Ví dụ "Dùng Subscriber thay cho Investor, không phải lỗi" |
| created\_by | text | Người tạo |
| created\_at | datetime | Thời điểm |
| status | text | active hoặc revoked |

Ví dụ một dòng trong `decisions`:

```json
{
  "law_firm": "Firm X",
  "fund_name": "ABC Fund I",
  "issue_type": "missing_reference",
  "section": "Section 2",
  "quote": "If you checked (b), complete Section 5 and Annex B.",
  "decision": "answered",
  "counsel_answer": "A",
  "counsel_note": "Entity investors complete Section 4 and Annex B.",
  "decided_by": "analyst_1",
  "status": "active"
}
```

## Logic khớp và luật an toàn

Một lỗi chỉ được coi là "đã xử lý" khi khớp **cả ba** điều kiện: cùng công ty luật, cùng loại lỗi, và đoạn văn giống hệt sau chuẩn hóa. Khớp chặt chẽ chấp nhận báo lại một ít, đổi lại không bao giờ ẩn nhầm lỗi thật.

**Cách tính fingerprint**

1. Chuẩn hóa đoạn văn: chuyển thường, gộp khoảng trắng, bỏ dấu ngoặc kép cong/thẳng khác nhau. **Giữ nguyên số và số mục** ("Section 4" khác "Section 5").
2. `quote_hash = sha256(đoạn văn đã chuẩn hóa)`
3. `fingerprint = sha256(law_firm + "|" + issue_type + "|" + quote_hash)`

```python
import hashlib, re

def normalize(text: str) -> str:
    text = text.lower().replace("\u201c", '"').replace("\u201d", '"')
    return re.sub(r"\s+", " ", text).strip()

def fingerprint(law_firm: str, issue_type: str, quote: str) -> str:
    qh = hashlib.sha256(normalize(quote).encode()).hexdigest()
    key = f"{law_firm.strip().lower()}|{issue_type}|{qh}"
    return hashlib.sha256(key.encode()).hexdigest()
```

**Quy tắc gắn nhãn khi review**

| Khớp với quyết định active | Nhãn hiển thị | Vào email luật sư? |
| --- | --- | --- |
| Không khớp | Mới | Có, nếu analyst Accept |
| dismissed | Đã bỏ qua trước đây | Không |
| answered | Đã có đáp án (hiện kèm câu trả lời cũ) | Không |
| accepted nhưng chưa có đáp án | Đang chờ luật sư | Không gửi lại |

**Luật an toàn (bắt buộc)**

- **Không xóa, chỉ gom.** Lỗi đã xử lý luôn nằm trong mục "Đã xử lý trước đây (n)" với số đếm hiển thị.
- **Lỗi chặn số hóa không bao giờ bị ẩn hoàn toàn.** Nếu lỗi có mức độ blocks\_digitization khớp với một quyết định dismissed, nó vẫn hiện trong danh sách chính kèm nhãn "Đã bỏ qua ở \[quỹ cũ\] — xác nhận lại".
- **Đoạn văn khác dù một ký tự là lỗi mới.** Không dùng so khớp gần đúng ở bản này.
- **Không chia sẻ bộ nhớ giữa các công ty luật.** Quyết định của Firm X không ảnh hưởng hồ sơ Firm Y.
- **Quy tắc riêng (firm\_rules) chỉ là ngữ cảnh cho LLM**, không phải bộ lọc. LLM vẫn có thể báo lỗi nếu thấy vấn đề thật.

## Luồng người dùng và màn hình

&#91;embedded content: luồng review có bộ nhớ · 3 nhãn, 2 hành động\]

Mỗi lỗi tìm được đều đi qua bước tra bộ nhớ trước khi tới analyst. Mọi quyết định mới (Dismiss hoặc câu trả lời của luật sư) được ghi ngược lại vào bộ nhớ cho lần review sau.

**Các màn hình cần có**

1. **Màn hình kết quả review:** danh sách chính chỉ gồm lỗi Mới (và lỗi chặn số hóa cần xác nhận lại); bên dưới là mục "Đã xử lý trước đây (n)" thu gọn.
2. **Hộp thoại Dismiss:** chọn lý do từ danh sách (cách viết chuẩn của công ty luật, không ảnh hưởng form, báo nhầm của tool, khác) và ô ghi chú.
3. **Ô nhập đáp án luật sư:** chọn phương án A/B/C đã đề xuất trong câu hỏi, kèm ghi chú.
4. **Trang bộ nhớ theo công ty luật (P1):** xem, lọc và mở lại quyết định cũ.

## Chỉ số thành công

Trong hackathon, đo bằng kịch bản 2 hồ sơ của cùng một công ty luật (quỹ I và quỹ II có vài chỗ sửa). Khi tích hợp thật, đo trên dữ liệu vận hành của Anduin.

| Chỉ số | Cách đo | Mục tiêu demo | Mục tiêu khi vận hành |
| --- | --- | --- | --- |
| Số lỗi analyst phải xử lý ở quỹ II | So sánh có và không có bộ nhớ | Giảm ≥ 50% | Giảm ≥ 30% sau 3 tháng |
| Lỗi thật bị ẩn nhầm | Lỗi gài mới ở quỹ II có bị đưa vào mục đã xử lý không | 0 | 0 |
| Câu hỏi lặp lại gửi luật sư | Câu đã có đáp án có xuất hiện trong email không | 0 | 0 |
| Tỷ lệ báo nhầm | Số lỗi bị dismiss / tổng số lỗi tool báo | — | Giảm dần qua từng quỹ của cùng công ty luật |
| Thời gian từ nhận hồ sơ đến bắt đầu dựng form | Theo dõi theo quỹ | — | Cần Anduin cung cấp số nền để đặt mục tiêu |

## Rủi ro và câu hỏi mở

**Rủi ro**

| Rủi ro | Ảnh hưởng | Cách giảm |
| --- | --- | --- |
| Analyst dismiss sai, bộ nhớ lưu mãi quyết định sai | Lỗi thật bị bỏ qua ở mọi quỹ sau | Bắt buộc lý do, cho reopen (R6), lỗi chặn số hóa không bao giờ ẩn hoàn toàn |
| LLM trích dẫn đoạn văn hơi khác nhau giữa hai lần chạy | Cùng lỗi nhưng không khớp, bị báo lại | Mở rộng đoạn trích ra cả câu chứa nó trước khi tính hash; temperature = 0 |
| Tên công ty luật nhập không thống nhất ("Firm X LLP" và "Firm X") | Bộ nhớ bị chia làm hai | Chọn công ty luật từ danh sách có sẵn thay vì gõ tự do |
| Luật hoặc quy định thay đổi, đáp án cũ không còn đúng | Áp dụng đáp án lỗi thời | Hiển thị ngày quyết định; hết hạn quyết định ở v2 (R10) |
| Dữ liệu hồ sơ quỹ là tài liệu bảo mật | Rủi ro rò rỉ nếu lưu sai chỗ | Chỉ lưu đoạn trích ngắn và hash; lưu trong hệ thống của Anduin khi tích hợp |

**Giả định cần Anduin xác nhận**

- [ ] Các công ty luật dùng lại template qua nhiều quỹ (nếu sai, giá trị của feature giảm mạnh).
- [ ] Báo nhầm lặp lại và hỏi lại luật sư là vấn đề có thật trong vận hành.

**Câu hỏi mở**

- [ ] Bao nhiêu phần trăm hồ sơ là biến thể của template đã từng số hóa? (Anduin)
- [ ] Ai liên hệ luật sư: analyst, account manager hay GP? (Anduin)
- [ ] Quyết định của một analyst có cần người thứ hai duyệt trước khi vào bộ nhớ không? (Anduin, team lead)
- [ ] Bộ nhớ nên gắn theo công ty luật hay theo từng template cụ thể của công ty luật đó? (Anduin)

## Kế hoạch build và tiêu chí nghiệm thu

Feature tốn khoảng nửa ngày, làm chiều ngày 2 sau khi lớp LLM review chạy ổn. Nếu trễ, cắt P1 và giữ đủ R1–R5.

**Việc cần làm**

- [ ] Tạo SQLite với 2 bảng `decisions` và `firm_rules` (\~30 phút)
- [ ] Viết `normalize()` và `fingerprint()`, kèm test: khác khoảng trắng thì khớp, khác số mục thì không khớp (\~30 phút)
- [ ] Thêm bước tra bộ nhớ sau bước verify quote trong `llm_review.py`, gắn nhãn cho từng lỗi (\~1 giờ)
- [ ] UI: nút Accept / Dismiss (kèm lý do) / nhập đáp án luật sư; mục "Đã xử lý trước đây (n)" thu gọn (\~1,5 giờ)
- [ ] Bộ lọc email: chỉ lỗi Mới đã Accept (\~15 phút)
- [ ] Chuẩn bị dữ liệu demo: hồ sơ quỹ I và quỹ II cùng công ty luật, quỹ II giữ nguyên 3 đoạn cũ và thêm 2 lỗi mới (\~30 phút)

**Tiêu chí nghiệm thu**

1. **Không báo lại:** Cho trước analyst đã dismiss lỗi A ở quỹ I của Firm X. Khi review quỹ II của Firm X có đoạn A giống hệt, thì lỗi A nằm trong mục "Đã xử lý trước đây", kèm lý do và tên quỹ I.
2. **Hiện đáp án cũ:** Cho trước luật sư đã trả lời lỗi B ở quỹ I. Khi review quỹ II, thì lỗi B hiện nhãn "Đã có đáp án" kèm câu trả lời, và không có trong email luật sư.
3. **Sửa là lỗi mới:** Cho trước lỗi A đã dismiss. Khi quỹ II sửa "Section 4" thành "Section 5" trong đoạn A, thì lỗi được báo như lỗi Mới.
4. **Không lan sang công ty luật khác:** Cho trước lỗi A đã dismiss ở Firm X. Khi hồ sơ Firm Y có đoạn giống hệt, thì lỗi được báo như lỗi Mới.
5. **Lỗi chặn không bị ẩn:** Cho trước một lỗi blocks\_digitization đã dismiss. Khi gặp lại, thì nó vẫn nằm trong danh sách chính với nhãn "xác nhận lại".
6. **Dismiss cần lý do:** Khi analyst bấm Dismiss mà chưa chọn lý do, thì hệ thống không lưu và hiện thông báo yêu cầu lý do.
