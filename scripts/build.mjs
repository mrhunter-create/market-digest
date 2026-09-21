import { writeFile, readFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getMarket, getWatchQuotes } from "./market.mjs";
import { getNews, matchWatchlist, fetchTickerNews, matchThemes } from "./news.mjs";
import { getCalendar } from "./calendar.mjs";
import { computeSignals } from "./signals.mjs";
import { editorialize, llmEnabled } from "./llm.mjs";
import { CATEGORIES, FEEDS, TICKER_GROUPS, WATCHLIST, WATCH_GROUPS } from "./sources.mjs";

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
  // Cuối tuần: không có phiên cổ phiếu, giá cổ phiếu là giá chốt thứ Sáu. Vẫn chạy vì
  // tin không nghỉ, BTC/ETH giao dịch 24/7, và futures mở lại tối Chủ nhật giờ Mỹ.
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(now);
  const weekend = weekday === "Sat" || weekday === "Sun";

  console.log(`Bản tin ${weekend ? "cuối tuần" : "phiên"} ${sessionDate} — chạy lúc ${now.toISOString()}`);

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
  const noNews = watch.filter(w => !w.stories.length);
  console.log(`  ${quotes.filter(q => q.ok).length}/${WATCHLIST.length} mã có giá • ${watch.length - noNews.length} mã có tin trong ngày • ${noNews.length} mã tìm tin gần nhất…`);
  // Mã không có tin trong ngày: tìm tin 7 ngày gần nhất theo mã, tuần tự để không bị Yahoo chặn.
  let filled = 0;
  for (const w of noNews) {
    w.stories = await fetchTickerNews(w.sym, w.label, { now });
    if (w.stories.length) filled++;
    await new Promise(r => setTimeout(r, 700));
  }
  console.log(`  ${filled}/${noNews.length} mã có tin gần nhất`);
  // Tin NGÀNH cho từng nhóm — quốc phòng chạy theo tin chiến tranh dù không có tin công ty.
  const groupNews = Object.fromEntries(WATCH_GROUPS.map(g => [g.id, matchThemes(news.allClusters, g.themes)]));
  console.log(`  tin ngành: ${WATCH_GROUPS.map(g => `${g.id} ${groupNews[g.id].length}`).join(", ")}`);

  console.log("• Lấy lịch phiên tới…");
  const calendar = await getCalendar(now).catch(e => (console.warn(`  ! lịch: ${e.message}`), null));
  console.log(calendar
    ? `  ${calendar.date}: ${calendar.economic.length} sự kiện vĩ mô, ${calendar.earnings.length} báo cáo lợi nhuận`
    : "  (không có lịch)");

  console.log(llmEnabled() ? "• Biên tập bằng LLM…" : "• Không có LLM_API_KEY — giữ tiêu đề gốc");
  const edited = await editorialize({ market, stories: news.stories, calendar, signals, watch, groups: WATCH_GROUPS, groupNews, sessionDate, weekend });

  // Tin ra SAU giờ đóng cửa Mỹ (16:00 ET) chưa được phản ánh vào giá chốt phiên — đánh dấu để người đọc biết.
  const closeUtc = (() => {
    const s = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" }).format(now);
    const off = Number((s.match(/GMT([+-]\d+)/) || [])[1] || -5);
    return Date.parse(`${sessionDate}T16:00:00${off < 0 ? "-" : "+"}${String(Math.abs(off)).padStart(2, "0")}:00`);
  })();
  for (const st of edited.stories) st.afterClose = !weekend && !!(st.date && Date.parse(st.date) > closeUtc);
  if (edited.llm) console.log(`  ${edited.stories.length} tin sau biên tập (${edited.llm})`);

  const digest = {
    id: sessionDate,
    sessionDate,
    weekend,
    generatedAt: now.toISOString(),
    verdict: edited.verdict,
    chains: edited.chains,
    overlooked: edited.overlooked,
    links: edited.links,
    feature: edited.feature,
    ahead: edited.ahead,
    watchGroups: edited.watchGroups,
    watchGroupDefs: WATCH_GROUPS.map(({ id, label }) => ({ id, label })),
    groupNews: Object.fromEntries(Object.entries(groupNews).map(([k, v]) => [k, v.map(c => ({ title: c.title, link: c.link, source: c.source, date: c.date }))])),
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
