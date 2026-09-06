# Bản tin Thị trường Mỹ

Mỗi sáng tự tổng hợp một trang những tin có thể ảnh hưởng tới thị trường chứng khoán Mỹ,
kèm số liệu chốt phiên hôm trước. Chạy hoàn toàn trên hạ tầng miễn phí.

## Cách hoạt động

```
GitHub Actions (23:00 UTC, T2–T6)
        │
        ├─ 11 nguồn RSS  ──►  khử trùng lặp  ──►  chấm điểm ảnh hưởng  ──►  phân nhóm
        ├─ CNBC quote API ─►  giá chốt phiên 10 chỉ số / hàng hoá
        └─ LLM (tuỳ chọn) ─►  tóm tắt tiếng Việt + loại tin không liên quan
        │
        └─► public/data/YYYY-MM-DD.json  ──►  GitHub Pages
```

**23:00 UTC = 07:00 sáng giờ Đài Bắc**, tức khoảng 1–2 tiếng sau khi phiên Mỹ đóng cửa
(16:00 ET). Chạy T2–T6 nên bản tin ra vào sáng T3–T7, mỗi bản phủ trọn một phiên giao dịch
kể cả tin công bố sau giờ.

## Cài đặt

1. Tạo repo trên GitHub rồi push thư mục này lên.
2. **Settings → Pages → Source: GitHub Actions**.
3. **Settings → Actions → General → Workflow permissions: Read and write**.
4. (Tuỳ chọn, để có tóm tắt tiếng Việt) **Settings → Secrets and variables → Actions**:
   - Secret `LLM_API_KEY` — khoá Groq miễn phí lấy tại <https://console.groq.com/keys>
   - Variable `LLM_MODEL` — mặc định `llama-3.3-70b-versatile`
   - Variable `LLM_BASE_URL` — mặc định `https://api.groq.com/openai/v1`
5. Vào tab **Actions → Bản tin thị trường → Run workflow** để chạy thử ngay.

Không có `LLM_API_KEY` thì trang vẫn chạy bình thường, chỉ là giữ tiêu đề tiếng Anh gốc
thay vì tóm tắt tiếng Việt.

Vì dùng giao thức OpenAI-compatible nên đổi `LLM_BASE_URL` là chạy được với Cerebras,
Together, hoặc vLLM tự host — không khoá vào nhà cung cấp nào.

## Chạy tại máy

```bash
npm run build     # tổng hợp -> public/data/
npm run serve     # xem tại http://localhost:4321
```

Muốn thử nhánh tóm tắt tiếng Việt: `LLM_API_KEY=... npm run build`

## Điều chỉnh

Gần như mọi thứ đáng chỉnh nằm trong `scripts/sources.mjs`:

| Muốn đổi | Sửa ở |
|---|---|
| Thêm/bớt nguồn tin | `FEEDS` (`weight` = độ ưu tiên của nguồn) |
| Thêm/bớt mã theo dõi | `TICKERS` |
| Tin nào được coi là quan trọng | `KEYWORDS` (số đầu dòng = trọng số) |
| Nhóm hiển thị | `CATEGORIES` |
| Chặn rác | `BLOCK_TITLE`, `BLOCK_URL` |

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
