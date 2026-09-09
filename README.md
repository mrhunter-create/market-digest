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
        └─ LLM (tuỳ chọn) ─►  tóm tắt tiếng Việt + loại tin không liên quan
        │
        └─► public/data/YYYY-MM-DD.json  ──►  GitHub Pages
```

**23:00 UTC = 07:00 sáng giờ Đài Bắc**, tức khoảng 1–2 tiếng sau khi phiên Mỹ đóng cửa
(16:00 ET). Chạy T2–T6 nên bản tin ra vào sáng T3–T7, mỗi bản phủ trọn một phiên giao dịch
kể cả tin công bố sau giờ.

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
gốc và tự phân tầng mức tác động theo điểm, thay vì tóm tắt tiếng Việt.

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
