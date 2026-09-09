import { fetchText, parseFeed, tokens, jaccard, cleanGoogleTitle } from "./lib.mjs";
import { FEEDS, KEYWORDS, CATEGORIES, BLOCK_TITLE, BLOCK_URL } from "./sources.mjs";

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
    scanned: all.length,
    kept: fresh.length,
    clustered: clusters.length,
    relevant: relevant.length,
  };
}
