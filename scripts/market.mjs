import { fetchText } from "./lib.mjs";
import { TICKERS } from "./sources.mjs";

const sleep = ms => new Promise(s => setTimeout(s, ms));
const num = v => {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/[,%$+\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/** CNBC: một request lấy hết mã, không cần khoá, không giới hạn tốc độ đáng kể. */
async function fromCnbc() {
  const syms = TICKERS.map(t => t.cnbc).join("|");
  const url = `https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=${encodeURIComponent(syms)}&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json`;
  const j = JSON.parse(await fetchText(url));
  const list = j?.FormattedQuoteResult?.FormattedQuote || [];
  const map = new Map();
  for (const q of list) {
    if (q.code !== 0) continue;
    const price = num(q.last), change = num(q.change);
    if (price == null) continue;
    // previous_day_closing đôi khi lệch (vd .RUT) -> tin vào last - change khi hai bên mâu thuẫn.
    let prev = num(q.previous_day_closing);
    if (change != null && (prev == null || Math.abs(prev + change - price) > Math.abs(price) * 1e-6)) prev = price - change;
    if (prev == null) continue;
    // Không dùng change_pct của CNBC: với mã lợi suất nó sai dấu (US2Y báo +0.04 điểm
    // nhưng change_pct là -0.0781%). Tự tính từ price/prev cho nhất quán.
    map.set(q.symbol, {
      price, prev,
      change: price - prev,
      changePct: prev ? ((price - prev) / prev) * 100 : null,
      asOf: q.last_time || null,
      src: "cnbc",
    });
  }
  return map;
}

/** Yahoo: dự phòng từng mã. Bắn song song sẽ dính 429 nên đi tuần tự. */
async function fromYahoo(sym) {
  for (const host of ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"]) {
    try {
      const j = JSON.parse(await fetchText(`${host}/v8/finance/chart/${encodeURIComponent(sym)}?range=10d&interval=1d`, { tries: 1 }));
      const res = j?.chart?.result?.[0];
      const meta = res?.meta || {};
      const closes = (res?.indicators?.quote?.[0]?.close || []).filter(v => v != null);
      const price = meta.regularMarketPrice ?? closes.at(-1);
      const prev = meta.chartPreviousClose ?? (closes.length > 1 ? closes.at(-2) : null);
      if (price == null || prev == null) continue;
      return {
        price, prev,
        change: price - prev,
        changePct: prev ? ((price - prev) / prev) * 100 : null,
        asOf: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
        src: "yahoo",
      };
    } catch { /* thử host kế tiếp */ }
  }
  return null;
}

export async function getMarket() {
  let cnbc = new Map();
  try { cnbc = await fromCnbc(); } catch (e) { console.warn(`  ! CNBC quote lỗi: ${e.message}`); }

  const rows = [];
  for (const t of TICKERS) {
    let q = cnbc.get(t.cnbc);
    if (!q) {
      q = await fromYahoo(t.yahoo);
      await sleep(800);
    }
    if (!q) console.warn(`  ! không lấy được giá: ${t.label}`);
    rows.push({ g: t.g, label: t.label, kind: t.kind, symbol: t.cnbc, ...(q || {}), ok: !!q });
  }
  return rows;
}
