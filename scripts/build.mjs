import { writeFile, readFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getMarket, getWatchQuotes } from "./market.mjs";
import { getNews, matchWatchlist } from "./news.mjs";
import { getCalendar } from "./calendar.mjs";
import { computeSignals } from "./signals.mjs";
import { editorialize, llmEnabled } from "./llm.mjs";
import { CATEGORIES, FEEDS, TICKER_GROUPS, WATCHLIST } from "./sources.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "public", "data");

const inZone = (d, timeZone) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

async function main() {
  const now = new Date();
  // Bản tin gắn theo NGÀY PHIÊN Mỹ, không phải ngày chạy ở Đài Loan.
  const sessionDate = inZone(now, "America/New_York");

  console.log(`Bản tin phiên ${sessionDate} — chạy lúc ${now.toISOString()}`);

  console.log("• Lấy số liệu chốt phiên…");
  const market = await getMarket();
  const okCount = market.filter(m => m.ok).length;
  console.log(`  ${okCount}/${market.length} mã`);

  console.log("• Quét tin…");
  const news = await getNews(now);
  console.log(`  quét ${news.scanned} • trong cửa sổ ${news.kept} • cụm ${news.clustered} • liên quan ${news.relevant} • chọn ${news.stories.length}`);

  const signals = computeSignals(market);
  console.log(`  ${signals.length} tín hiệu suy ra`);

  console.log("• Danh mục theo dõi…");
  const quotes = await getWatchQuotes();
  const matched = matchWatchlist(news.allClusters, WATCHLIST);
  const watch = matched.map(m => ({ ...m, ...(quotes.find(q => q.sym === m.sym) || {}) }));
  console.log(`  ${quotes.filter(q => q.ok).length}/${WATCHLIST.length} mã có giá • ${watch.filter(w => w.stories.length).length} mã có tin`);

  console.log("• Lấy lịch phiên tới…");
  const calendar = await getCalendar(now).catch(e => (console.warn(`  ! lịch: ${e.message}`), null));
  console.log(calendar
    ? `  ${calendar.date}: ${calendar.economic.length} sự kiện vĩ mô, ${calendar.earnings.length} báo cáo lợi nhuận`
    : "  (không có lịch)");

  console.log(llmEnabled() ? "• Biên tập bằng LLM…" : "• Không có LLM_API_KEY — giữ tiêu đề gốc");
  const edited = await editorialize(market, news.stories, calendar, signals, watch);
  if (edited.llm) console.log(`  ${edited.stories.length} tin sau biên tập (${edited.llm})`);

  const digest = {
    id: sessionDate,
    sessionDate,
    generatedAt: now.toISOString(),
    verdict: edited.verdict,
    chains: edited.chains,
    overlooked: edited.overlooked,
    calendar,
    market,
    signals,
    tickerGroups: TICKER_GROUPS,
    categories: CATEGORIES.map(({ id, label }) => ({ id, label })),
    stories: edited.stories,
    watch: edited.watch,
    meta: {
      feeds: FEEDS.length,
      scanned: news.scanned,
      inWindow: news.kept,
      clusters: news.clustered,
      relevant: news.relevant,
      published: edited.stories.length,
      llm: edited.llm,
      llmError: edited.llmError || null,
      marketOk: okCount,
    },
  };

  await mkdir(DATA, { recursive: true });
  await writeFile(join(DATA, `${sessionDate}.json`), JSON.stringify(digest, null, 2));
  await writeFile(join(DATA, "latest.json"), JSON.stringify(digest, null, 2));

  // index.json: danh sách lưu trữ cho bộ chọn ngày ở frontend.
  const index = await readJson(join(DATA, "index.json"), []);
  const entry = {
    id: sessionDate,
    generatedAt: now.toISOString(),
    headline: edited.stories[0]?.titleVi || edited.stories[0]?.title || null,
    count: edited.stories.length,
  };
  const next = [entry, ...index.filter(e => e.id !== sessionDate)]
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, 400);
  await writeFile(join(DATA, "index.json"), JSON.stringify(next, null, 2));

  console.log(`✓ Đã ghi public/data/${sessionDate}.json (+ latest.json, index.json)`);
}

main().catch(e => { console.error("✗ Build thất bại:", e); process.exit(1); });
