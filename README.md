# Bản tin Thị trường Mỹ

Mỗi sáng tự tổng hợp một trang những tin có thể ảnh hưởng tới thị trường chứng khoán Mỹ,
kèm số liệu chốt phiên hôm trước. Chạy hoàn toàn trên hạ tầng miễn phí.

## Cách hoạt động

```
GitHub Actions (23:00 UTC, T2–T6)
        │
        ├─ 24 nguồn RSS  ──►  khử trùng lặp  ──►  chấm điểm ảnh hưởng  ──►  phân nhóm
        ├─ Nasdaq calendar ─►  lịch số liệu vĩ mô + báo cáo lợi nhuận phiên tới
        ├─ CNBC quote API ─►  34 mã: chỉ số, lợi suất, hàng hoá, cổ phiếu lớn,
        │                     nhóm ngành, thị trường thế giới
        ├─ tín hiệu suy ra ─►  6 chênh lệch tính bằng công thức cố định
        └─ LLM (tuỳ chọn) ─►  2 lượt gọi độc lập:
             • phân tích: kết luận phiên, chuỗi suy luận, thứ dễ bị bỏ qua
             • tin: dịch tiêu đề, tóm tắt, ẩn ý & hệ quả
        │
        └─► public/data/YYYY-MM-DD.json  ──►  GitHub Pages
```

**23:00 UTC = 07:00 sáng giờ Đài Bắc.** GitHub chạy trễ đều 1,5–2 tiếng nên bản tin thực
tế lên **~08:30–09:00** — đúng lúc đọc. Cửa sổ nhìn là từ sáng hôm trước tới lúc chạy: phiên
Mỹ đã đóng, tin sau giờ đóng cửa (được gắn cờ), phiên châu Á đang chạy, và hợp đồng tương
lai — đủ để trả lời "hôm nay sẽ thế nào".

## Cài đặt

Repo **công khai**, GitHub Actions chạy job mỗi sáng, GitHub Pages host trang.
Miễn phí toàn bộ, máy cá nhân không cần bật.

### 1. Đưa code lên GitHub

Tạo repo mới (để **Public** — gói Free chỉ cho GitHub Pages chạy từ repo công khai),
rồi:

```bash
git remote add origin https://github.com/<tài-khoản>/market-digest.git
git push -u origin main
```

### 2. Bật Pages và quyền ghi

- **Settings → Pages → Source: GitHub Actions**
- **Settings → Actions → General → Workflow permissions: Read and write permissions**
  (workflow cần quyền này để commit file bản tin)

Sau lần chạy đầu, trang nằm ở `https://<tài-khoản>.github.io/market-digest/`.

### 3. Bật tóm tắt tiếng Việt (tuỳ chọn)

Lấy khoá miễn phí tại <https://console.groq.com/keys>, rồi vào
**Settings → Secrets and variables → Actions**:

- Secret `LLM_API_KEY` — khoá Groq
- Variable `LLM_MODEL` — mặc định `llama-3.3-70b-versatile`
- Variable `LLM_BASE_URL` — mặc định `https://api.groq.com/openai/v1`

Đặt khoá ở **Secrets**, không bao giờ viết thẳng vào code — repo công khai nên
bất kỳ ai cũng đọc được file trong đó, còn Secrets thì không.

Không có `LLM_API_KEY` thì trang vẫn chạy bình thường, chỉ là giữ tiêu đề tiếng Anh
gốc và tự phân tầng mức tác động theo điểm — mất phần tiếng Việt và phần phân tích.

Hai lượt gọi LLM độc lập nhau: lượt phân tích lỗi thì vẫn còn tin đã dịch, và ngược
lại. Lỗi của từng lượt được ghi vào `meta.llmError` và hiện ở chân trang.

Vì dùng giao thức OpenAI-compatible nên đổi `LLM_BASE_URL` là chạy được với Cerebras,
Together, hoặc vLLM tự host — không khoá vào nhà cung cấp nào.

### 4. Chạy thử

Tab **Actions → Bản tin thị trường → Run workflow**. Không cần đợi tới sáng mai.

## Chạy tại máy

```bash
npm run build     # tổng hợp -> public/data/
npm run serve     # xem tại http://localhost:4321
```

Muốn thử nhánh tóm tắt tiếng Việt: `LLM_API_KEY=... npm run build`

## Lưu ý khi sửa code

Workflow tự commit bản tin vào `public/data/` mỗi ngày, nên máy cá nhân sẽ luôn
đi sau GitHub. Trước khi push:

```bash
git pull --rebase && git push
```

Nếu `git pull --rebase` báo xung đột ở `public/data/*.json` thì đó là file do máy
sinh ra, không phải code — cứ lấy bản trên GitHub rồi đi tiếp:

```bash
git checkout --ours public/data && git add public/data && git rebase --continue
```

Muốn tránh hẳn: sau khi chạy `npm run build` ở máy, đừng commit thư mục
`public/data` (chạy `git checkout -- public/data` trước khi commit) — để duy nhất
workflow ghi vào đó.

## Các trang

| Trang | File | Nội dung |
|---|---|---|
| **Tổng quan** | `index.html` | Kết luận phiên, 4 thẻ dẫn (tin nóng, phân tích sâu, danh mục, tín hiệu & lịch), chuỗi suy luận |
| **Tin** | `news.html` | Tin nóng đánh số + các tin còn lại theo nhóm |
| **Danh mục** | `watchlist.html` | 30 mã riêng: đánh giá, tầng hai, nối vào mạch, tin kèm |
| **Phân tích** | `analysis.html` | Bài phân tích sâu, mạch liên kết trong ngày, chuỗi suy luận, dễ bị bỏ qua, tín hiệu đủ |
| **Thị trường** | `market.html` | Tín hiệu gọn, bảng 34 mã, lịch phiên tới đầy đủ |

CSS và JS dùng chung ở `app.css` / `app.js`; mỗi file HTML chỉ là khung + `Page.mount("<trang>")`.
Chọn phiên cũ ở ô chọn trên masthead → `?d=YYYY-MM-DD`, giữ nguyên khi chuyển trang.

## Phân tích sâu & mạch liên kết

Lượt LLM thứ ba nhận ~26 tin của ngày cùng số liệu, và làm hai việc **không cần nhớ
gì qua ngày**:

1. **Mạch liên kết** — gom tin thành 2–4 mạch, mỗi mạch là nhóm tin cùng kể một
   chuyện lớn hơn từng tin đơn lẻ, kèm mã trong danh mục chịu ảnh hưởng
2. **Bài phân tích sâu** cho mạch quan trọng nhất, theo tầng bắt buộc:
   - Chuyện gì đã xảy ra — *chỉ sự kiện*
   - Lý do bề nổi
   - **Vì sao — suy luận gốc rễ** — động cơ các bên, ai được lợi, *đánh dấu là giả thuyết*
   - Vì sao lúc này — nối với lịch bầu cử, chính sách, chu kỳ
   - Bằng chứng ủng hộ **và** ngược chiều
   - Kịch bản: "nếu ngày mai có X…" / "nếu không…", mỗi kịch bản kèm *vì sao*
   - Chỉ báo để biết kịch bản nào đang thắng
   - Mức tin cậy 1–5 (prompt yêu cầu suy luận chính trị hiếm khi quá 3)
   - Bài này sai khi

Mã trong danh mục được nối vào mạch: mỗi mã có "tầng hai" (nếu mạch diễn biến theo
luận đề thì mã hưởng lợi hay chịu áp lực qua cơ chế nào) và "đổi cách nhìn khi".

Mười lượt LLM (phân tích, tin, liên kết, 6 nhóm danh mục, tin nóng sâu) chạy **tuần tự** có giãn cách (`LLM_GAP_MS`, mặc định 15 giây) và tự
chờ khi dính 429, vì gói Groq miễn phí chỉ 8.000 token/phút. Muốn phân tích sâu
hơn với nhiều tin hơn, đổi `LLM_BASE_URL` sang nhà cung cấp có hạn mức lớn hơn.

## Danh mục theo dõi — phân tích theo nhóm ngành

`WATCHLIST` + `WATCH_GROUPS` trong `scripts/sources.mjs`. 30 mã chia 6 nhóm: bán dẫn &
hạ tầng AI, Big Tech & phần mềm, tài chính, quốc phòng & vũ trụ, tiêu dùng & xe điện,
chỉ số & năng lượng.

**Cả 30 mã đều được phân tích mỗi ngày**, không chỉ mã có tin. Mỗi nhóm một lượt LLM:

- **Cấp nhóm** (lý do *khách quan*, viết một lần cho cả nhóm): nhóm hôm nay ra sao →
  vì sao (ngành, vĩ mô, chính sách) → kéo dài bao lâu → ai được lợi ai mất → rủi ro
  chính & điều kiện kích hoạt → sau này có thể
- **Cấp mã** (lý do *chủ quan*): đang ở đâu (biến động, vị trí so với đỉnh/đáy 52 tuần,
  khối lượng bất thường) → vì sao — nội tại công ty → vị thế cơ bản → định giá → rủi ro
  riêng → sau này → đổi cách nhìn khi

Số liệu cơ bản lấy từ CNBC cùng lúc với giá: P/E hiện tại và dự phóng, EPS, doanh thu,
vốn hoá, đỉnh/đáy 52 tuần kèm ngày, cổ tức, beta, khối lượng so với trung bình 10 phiên.
Đây là căn cứ để nói "đắt hay rẻ" thay vì đoán.

**Kiến thức nền:** LLM được dùng hiểu biết chung về ngành/công ty (cung–cầu, sức mạnh tài
chính, lợi thế cạnh tranh) vì tin trong ngày không nói được "RAM tăng 10 lần nhưng vẫn
không có hàng mà bán". Điều kiện: câu nào là kiến thức nền phải mở đầu bằng **(nền)**,
không được nêu con số nào không có trong input, và tin hôm nay thắng kiến thức nền nếu
mâu thuẫn.

Tin được khớp trên **toàn bộ** cụm bài quét trong ngày (~600). Quy tắc khớp: alias viết
thường không phân biệt hoa thường; alias viết hoa phân biệt (`Apple` ≠ "the apple"); mã
ngắn chỉ nhận `(GS)` / `$GS`; ETF `aliases: []`.

## Tin nóng — mổ xẻ

Lượt LLM riêng cho tối đa 6 tin nóng, theo khung: vì sao (chủ quan — động cơ chủ thể /
khách quan — bối cảnh) → kéo dài bao lâu → ai được lợi → ai mất → tiếp theo có thể (hai
hướng kèm điều kiện) → dấu hiệu cần quan sát. Hiện dưới mỗi tin nóng, mở ra khi bấm.

## Hôm nay sẽ thế nào

Khối đầu trang Tổng quan: 4 hợp đồng tương lai (S&P, Nasdaq 100, Dow, VIX) đang giao dịch
+ đoạn nhận định trước giờ mở cửa do lượt phân tích viết từ futures, thị trường châu Á
đang chạy, và lịch trong ngày.

## Tín hiệu suy ra

Sáu chênh lệch được tính trong `scripts/signals.mjs` bằng **công thức cố định**, không
qua LLM — nên mọi con số và nhãn trạng thái đều tái lập được, và trang có ghi kèm dữ
liệu đầu vào để kiểm tra lại:

| Tín hiệu | Công thức | Đọc thế nào |
|---|---|---|
| Đường cong 2–10 năm | lợi suất 10 năm − 2 năm | âm = trái phiếu định giá tăng trưởng suy yếu |
| Cấu trúc biến động | VIX 9 ngày − VIX 30 ngày | dương = phòng hộ dồn vào một sự kiện gần |
| Phòng thủ vs thị trường | (XLU% + XLP%)/2 − S&P 500% | dương = dòng tiền chuyển sang thế phòng ngự |
| Bán dẫn vs S&P 500 | SOXX% − S&P 500% | âm = nhóm dẫn dắt chu kỳ mất động lực |
| Cổ phiếu nhỏ vs S&P 500 | IWM% − S&P 500% | âm nhiều = đà tăng dựa vào nhóm hẹp |
| Tín dụng rủi ro cao vs hạng đầu tư | HYG% − LQD% | âm = căng thẳng tín dụng, thường đi trước cổ phiếu |

Các tín hiệu này vừa hiện trên trang, vừa được nạp vào prompt làm bằng chứng cho phần
chuỗi suy luận. Chúng không phụ thuộc LLM: không có `LLM_API_KEY` thì vẫn đủ 6 tín hiệu.

## Chuỗi suy luận

Phần phân tích cố tình **không phán đoán thị trường**. Mỗi mạch gồm:

1. **Tín hiệu gốc** — sự kiện hoặc chênh lệch khởi đầu
2. **Ẩn ý** — điều tiêu đề hoặc con số bề mặt không nói ra
3. **Các bước** — 3–4 mắt suy luận tuần tự, mỗi mắt là một cơ chế truyền dẫn
4. **Bằng chứng** — số liệu cụ thể lấy từ dữ liệu trên trang
5. **Điều kiện phủ định** — cái gì xảy ra thì chuỗi đó sai

Mạch nào không có bước hoặc không có bằng chứng số liệu thì bị loại ở
`scripts/llm.mjs`, không hiển thị.

## Điều chỉnh

Gần như mọi thứ đáng chỉnh nằm trong `scripts/sources.mjs`:

| Muốn đổi | Sửa ở |
|---|---|
| Thêm/bớt nguồn tin | `FEEDS` (`weight` = độ ưu tiên của nguồn) |
| Thêm/bớt mã theo dõi | `TICKERS` (`g` = khối hiển thị) |
| Khối bảng thị trường | `TICKER_GROUPS` |
| Tin nào được coi là quan trọng | `KEYWORDS` (số đầu dòng = trọng số) |
| Nhóm hiển thị | `CATEGORIES` |
| Chặn rác | `BLOCK_TITLE`, `BLOCK_URL` |
| Sự kiện vĩ mô nào đáng đưa | `EVENT_RULES` trong `scripts/calendar.mjs` |

Ngưỡng lọc và số tin tối đa nằm đầu `scripts/news.mjs`
(`WINDOW_HOURS`, `MAX_STORIES`, `MAX_PER_CATEGORY`).

Đổi giờ chạy: sửa dòng `cron` trong `.github/workflows/digest.yml`
(GitHub dùng UTC; giờ Đài Bắc = UTC + 8).

## Cấu trúc

```
scripts/sources.mjs   cấu hình: nguồn, mã, từ khoá, nhóm, blocklist
scripts/lib.mjs       fetch, parse RSS, tách từ, so trùng
scripts/market.mjs    giá chốt phiên (CNBC chính, Yahoo dự phòng)
scripts/news.mjs      gom tin, khử trùng lặp, chấm điểm, lọc
scripts/calendar.mjs  lịch số liệu vĩ mô + earnings phiên tới (Nasdaq API)
scripts/llm.mjs       biên tập tiếng Việt (tuỳ chọn)
scripts/build.mjs     ghép lại và ghi JSON
public/index.html     toàn bộ giao diện, không cần build
public/data/          bản tin theo ngày + latest.json + index.json
```

Không có dependency ngoài nào — chỉ cần Node 20+.

## Lưu ý

Bản tin tự động, chỉ mang tính tham khảo, không phải khuyến nghị đầu tư.
Nội dung tin do các hãng tin giữ bản quyền; trang này chỉ hiển thị tiêu đề, tóm tắt ngắn
và link về bài gốc.
