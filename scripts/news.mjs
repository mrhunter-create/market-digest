import { fetchText, parseFeed, tokens, jaccard, cleanGoogleTitle } from "./lib.mjs";
import { FEEDS, KEYWORDS, CATEGORIES, BLOCK_TITLE, BLOCK_URL, BLOCK_SOURCE } from "./sources.mjs";

const WINDOW_HOURS = 30;   // đủ phủ trọn một phiên Mỹ kể cả tin sau giờ đóng cửa
const MAX_STORIES  = 28;   // giữ digest gọn — đây là bản tin, không phải kho tin
const MAX_PER_CATEGORY = 7;

async function pullFeed(feed) {
  try {
    const items = parseFeed(await fetchText(feed.url));
    return items.map(it => ({
      ...it,
      title: feed.id.startsWith("gn-") ? cleanGoogleTitle(it.title) : it.title,
      source: feed.name,
      sourceId: feed.id,
      sourceWeight: feed.weight,
    }));
  } catch (e) {
    console.warn(`  ! nguồn ${feed.id}: ${e.message}`);
    return [];
  }
}

const reCache = new Map();
/** Khớp theo biên từ, không phải chuỗi con — nếu không "fed" sẽ dính vào "defensive", "fatigue"... */
function hasTerm(text, term) {
  let re = reCache.get(term);
  if (!re) {
    // Cho phép số nhiều ở cuối: "treasury yield" phải khớp được "Treasury Yields".
    re = new RegExp(`(?<![a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:e?s)?(?![a-z0-9])`, "i");
    reCache.set(term, re);
  }
  return re.test(text);
}

function keywordScore(text) {
  let score = 0;
  const hits = [];
  for (const [w, words] of KEYWORDS) {
    const hit = words.find(k => hasTerm(text, k));
    if (hit) { score += w; hits.push(hit); }
  }
  return { score, hits };
}

function categorize(text) {
  for (const c of CATEGORIES) {
    if (c.match.length && c.match.some(k => hasTerm(text, k))) return c.id;
  }
  return "markets";
}

/** Nhiều feed (nhất là Google News) đặt description = tiêu đề + tên báo. Tóm tắt như vậy vô dụng. */
function redundantSummary(title, summary) {
  if (!summary) return true;
  if (summary.length < 40) return true;
  const t = tokens(title), s = tokens(summary);
  if (!s.size) return true;
  let covered = 0;
  for (const w of s) if (t.has(w)) covered++;
  return covered / s.size >= 0.8;
}

/** Rác rõ ràng: review, podcast, trang mục lifestyle... lọt vào feed tổng hợp. */
function isJunk(it) {
  const t = it.title.toLowerCase();
  if (BLOCK_TITLE.some(b => t.includes(b))) return true;
  const u = it.link.toLowerCase();
  if (BLOCK_URL.some(b => u.includes(b))) return true;
  return false;
}

/** Gom các bài cùng một sự kiện lại thành cụm bằng độ trùng từ khoá tiêu đề. */
function cluster(items) {
  const clusters = [];
  for (const it of items) {
    const tk = tokens(it.title);
    const found = clusters.find(c => jaccard(c.tokens, tk) >= 0.38);
    if (found) {
      found.items.push(it);
      for (const x of tk) found.tokens.add(x);
    } else {
      clusters.push({ tokens: tk, items: [it] });
    }
  }
  return clusters;
}

export async function getNews(now = new Date()) {
  const all = (await Promise.all(FEEDS.map(pullFeed))).flat();
  const cutoff = now.getTime() - WINDOW_HOURS * 3600e3;

  const fresh = all.filter(it => {
    if (!it.title || !it.link || !it.date) return false;  // không có mốc thời gian thì không xác minh được là tin của phiên
    if (isJunk(it)) return false;
    const t = Date.parse(it.date);
    return t >= cutoff && t <= now.getTime() + 3600e3;
  });

  const clusters = cluster(fresh).map(c => {
    // Bài đại diện: nguồn uy tín nhất, hoà thì lấy bài mới nhất.
    const lead = [...c.items].sort((a, b) =>
      (b.sourceWeight - a.sourceWeight) || (Date.parse(b.date || 0) - Date.parse(a.date || 0))
    )[0];
    const sources = [...new Set(c.items.map(i => i.source))];
    // Nhiều feed nhét tiền tố hãng tin vào đầu mô tả: "(RTTNews) - ...", "NEW YORK (Reuters) - ..."
    const rawSummary = (lead.summary || "").replace(/^\s*(?:[A-Z][A-Za-z .]{0,24}\s+)?\([A-Za-z.]{2,20}\)\s*[-–—]\s*/, "");
    const summary = redundantSummary(lead.title, rawSummary) ? "" : rawSummary;
    const text = `${lead.title} ${lead.summary || ""}`;
    const { score: kw, hits } = keywordScore(text);

    const ageH = lead.date ? (now - Date.parse(lead.date)) / 3600e3 : 12;
    const recency = ageH <= 12 ? 3 : ageH <= 24 ? 1 : 0;
    const corroboration = Math.min(15, 5 * (sources.length - 1));

    return {
      title: lead.title,
      link: lead.link,
      summary,
      date: lead.date,
      source: lead.source,
      sources,
      category: categorize(text),
      keywords: hits,
      score: kw + lead.sourceWeight + recency + corroboration,
      impact: null,   // LLM sẽ ghi đè; nếu không có thì suy ra từ điểm ở dưới
      kwScore: kw,
      leadWeight: lead.sourceWeight,
    };
  });

  // Cổng liên quan: phải chạm từ khoá vĩ mô/thị trường đủ mạnh, HOẶC được nhiều báo cùng đưa,
  // HOẶC đến từ nguồn gốc (Fed, Treasury). Cắt sạch tin đời sống lọt vào feed tổng hợp.
  const relevant = clusters.filter(c =>
    c.leadWeight >= 8 ||                             // Fed / Treasury: luôn giữ
    c.kwScore >= 4 ||                                // tự thân đã đủ trọng số vĩ mô
    (c.kwScore >= 3 && c.sources.length >= 2)        // yếu hơn nhưng nhiều báo cùng đưa
  );

  relevant.sort((a, b) => b.score - a.score);

  // Trần theo nhóm: không để một chủ đề (thường là Big Tech) nuốt hết bản tin.
  const perCat = new Map();
  const picked = [];
  for (const c of relevant) {
    const n = perCat.get(c.category) || 0;
    if (n >= MAX_PER_CATEGORY) continue;
    perCat.set(c.category, n + 1);
    picked.push(c);
    if (picked.length >= MAX_STORIES) break;
  }

  // Phân tầng dự phòng theo điểm, cho trường hợp không bật LLM.
  const hi = picked[0]?.score ?? 0;
  for (const s of picked) {
    s.impact = s.score >= Math.max(20, hi * 0.8) ? "high" : s.score >= 13 ? "medium" : "low";
  }

  return {
    stories: picked.map(({ kwScore, leadWeight, ...s }) => s),
    // Toàn bộ cụm trong cửa sổ, chưa qua cổng vĩ mô — để khớp danh mục theo dõi,
    // vì tin riêng một mã (ví dụ Corning nâng dự báo) thường không lọt cổng chung.
    allClusters: clusters.map(({ kwScore, leadWeight, ...s }) => s),
    scanned: all.length,
    kept: fresh.length,
    clustered: clusters.length,
    relevant: relevant.length,
  };
}

/**
 * Khớp tin với danh mục theo dõi. Mỗi mã: tối đa `perTicker` bài, ưu tiên điểm cao.
 * Từ khoá tên công ty khớp theo biên từ; mã cổ phiếu chỉ nhận dạng "(SYM)" hoặc
 * "$SYM" để tránh "MS", "GAP", "DIS" khớp nhầm vào chữ thường.
 */
export function matchWatchlist(clusters, watchlist, perTicker = 3) {
  const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pat = a => `(?<![A-Za-z0-9])${esc(a)}(?:'s)?(?![A-Za-z0-9])`;
  return watchlist.map(w => {
    const ci = w.aliases.filter(a => a[0] === a[0].toLowerCase()).map(pat);
    const cs = w.aliases.filter(a => a[0] !== a[0].toLowerCase()).map(pat);
    cs.push(`\\(${esc(w.sym)}\\)`, `\\$${esc(w.sym)}(?![A-Za-z0-9])`);
    const reCI = ci.length ? new RegExp(ci.join("|"), "i") : null;
    const reCS = new RegExp(cs.join("|"));
    const test = t => !!t && ((reCI && reCI.test(t)) || reCS.test(t));
    const hits = clusters
      .filter(c => test(c.title) || test(c.summary))
      .sort((a, b) => b.score - a.score)
      .slice(0, perTicker);
    return { sym: w.sym, label: w.label, stories: hits };
  });
}

/**
 * Tin gần nhất riêng cho một mã — dùng cho mã không có tin trong cửa sổ ngày, vì mã vẫn
 * biến động và phân tích không có tin thì chỉ là đoán.
 * Google News theo tên công ty làm chính (chịu tải tốt); Yahoo RSS theo mã dự phòng
 * (chặn 429 nếu gọi dồn). Lọc rác như feed thường, lấy `max` bài mới nhất trong `days` ngày.
 */
export async function fetchTickerNews(sym, label, { days = 7, max = 3, now = new Date() } = {}) {
  const cutoff = now.getTime() - days * 86400e3;
  const badSource = it => BLOCK_SOURCE.some(b => (it.source || "").toLowerCase().includes(b));
  const shape = items => {
    const kept = [];
    for (const it of items
      .filter(it => it.title && it.link && it.date && Date.parse(it.date) >= cutoff)
      .filter(it => !isJunk(it) && !badSource(it))
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))) {
      // Khử trùng lặp: cùng một hồ sơ/thông cáo được 3 trang đăng lại.
      const tk = tokens(it.title);
      if (kept.some(k => jaccard(k.tk, tk) >= 0.4)) continue;
      kept.push({ ...it, tk });
      if (kept.length >= max) break;
    }
    return kept
    .map(it => ({
      title: it.title, link: it.link, summary: it.summary || "", date: it.date,
      source: it.source, sources: [it.source], category: "markets",
      keywords: [], score: 0, impact: "low", recent: true,
      ageDays: Math.max(0, Math.round((now.getTime() - Date.parse(it.date)) / 86400e3)),
    }));
  };

  const q = encodeURIComponent(`"${label}" stock when:${days}d`);
  try {
    const items = parseFeed(await fetchText(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`, { tries: 2 }))
      .map(it => ({ ...it, title: cleanGoogleTitle(it.title), source: (it.title.match(/ - ([^-]{2,40})$/) || [, "Google News"])[1].trim() }));
    const out = shape(items);
    if (out.length) return out;
  } catch (e) { console.warn(`  ! Google News ${sym}: ${e.message}`); }

  try {
    const items = parseFeed(await fetchText(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(sym)}&region=US&lang=en-US`, { tries: 1 }))
      .map(it => ({ ...it, source: "Yahoo Finance" }));
    return shape(items);
  } catch (e) { console.warn(`  ! Yahoo ${sym}: ${e.message}`); return []; }
}

/** Tin NGÀNH cho một nhóm: khớp từ khoá chủ đề trên toàn bộ cụm trong ngày, lấy top theo điểm. */
export function matchThemes(clusters, themes, max = 6) {
  if (!themes?.length) return [];
  return clusters
    .filter(c => themes.some(k => hasTerm(c.title, k) || hasTerm(c.summary || "", k)))
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}
