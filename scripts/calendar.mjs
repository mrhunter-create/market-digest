import { fetchText } from "./lib.mjs";

// Lịch sự kiện phiên tới. Nguồn: Nasdaq calendar API — miễn phí, không cần khoá.
// Lưu ý: trường "gmt" của Nasdaq thực chất là giờ New York, không phải GMT
// (ADP Employment Change báo 08:15 — đúng giờ ET công bố, còn GMT phải là 12:15).

const API = "https://api.nasdaq.com/api/calendar";

// Sự kiện vĩ mô đáng đưa vào bản tin, kèm nhãn tiếng Việt.
// weight cao = ảnh hưởng thị trường mạnh hơn.
const EVENT_RULES = [
  [10, "Quyết định lãi suất Fed",        ["fed interest rate decision", "fomc", "interest rate decision"]],
  [10, "Chỉ số giá tiêu dùng (CPI)",     ["cpi", "consumer price index"]],
  [10, "Chỉ số giá PCE",                 ["pce price index", "core pce"]],
  [10, "Báo cáo việc làm phi nông nghiệp", ["nonfarm payroll", "non-farm payroll"]],
  [9,  "Tỷ lệ thất nghiệp",              ["unemployment rate"]],
  [9,  "GDP",                            ["gdp"]],
  [9,  "Chỉ số giá sản xuất (PPI)",      ["ppi", "producer price"]],
  [8,  "Doanh số bán lẻ",                ["retail sales"]],
  [8,  "Phát biểu quan chức Fed",        ["fed chair", "fed governor", "fed president", "fomc member", "powell", "speaks"]],
  [7,  "Đơn xin trợ cấp thất nghiệp",    ["initial jobless claims", "continuing claims"]],
  [7,  "Chỉ số ISM",                     ["ism"]],
  [6,  "Niềm tin tiêu dùng",             ["consumer confidence", "michigan sentiment", "consumer sentiment"]],
  [6,  "Đơn hàng hàng hoá lâu bền",      ["durable goods"]],
  [6,  "Sản xuất công nghiệp",           ["industrial production", "capacity utilization"]],
  [6,  "Cơ hội việc làm JOLTS",          ["jolts"]],
  [5,  "Cán cân thương mại",             ["trade balance"]],
  [5,  "Thị trường nhà ở",               ["housing starts", "building permits", "existing home sales", "new home sales"]],
  [5,  "Đấu giá trái phiếu Kho bạc",     ["note auction", "bond auction", "bill auction"]],
  [4,  "Tồn kho dầu thô",                ["crude oil stock", "crude oil inventories", "eia petroleum status"]],
  [3,  "Báo cáo năng lượng EIA",         ["eia"]],
];

function classify(name) {
  const t = (name || "").toLowerCase();
  for (const [weight, vi, keys] of EVENT_RULES) {
    if (keys.some(k => t.includes(k))) return { weight, vi };
  }
  return null;
}

/** Chênh lệch giờ New York so với UTC cho một ngày cụt thể (tự xử lý giờ mùa hè). */
function etOffset(dateStr) {
  const probe = new Date(`${dateStr}T17:00:00Z`);
  const s = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" }).format(probe);
  const m = s.match(/GMT([+-]\d{1,2})/);
  return m ? Number(m[1]) : -5;
}

/** "08:30" giờ ET của ngày dateStr -> ISO instant. */
function etToIso(dateStr, hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || "");
  if (!m) return null;
  const off = etOffset(dateStr);
  const sign = off < 0 ? "-" : "+";
  const pad = String(Math.abs(off)).padStart(2, "0");
  const d = new Date(`${dateStr}T${m[1].padStart(2, "0")}:${m[2]}:00${sign}${pad}:00`);
  return isNaN(d) ? null : d.toISOString();
}

const clean = v => {
  const s = String(v ?? "").replace(/&nbsp;/g, " ").trim();
  return s && s !== "-" ? s : null;
};

async function json(url) {
  return JSON.parse(await fetchText(url, { tries: 2 }));
}

/** Ngày giao dịch Mỹ kế tiếp sau mốc `after` (bỏ cuối tuần; ngày lễ thì API trả rỗng). */
function nextTradingDay(after) {
  const d = new Date(after);
  for (let i = 0; i < 5; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    const et = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
    }).formatToParts(d);
    const wd = et.find(p => p.type === "weekday").value;
    if (wd !== "Sat" && wd !== "Sun") {
      return et.filter(p => ["year", "month", "day"].includes(p.type))
        .reduce((o, p) => ({ ...o, [p.type]: p.value }), {});
    }
  }
  return null;
}

async function economic(date) {
  const rows = (await json(`${API}/economicevents?date=${date}`))?.data?.rows || [];
  return rows
    .filter(r => r.country === "United States")
    .map(r => {
      const c = classify(r.eventName);
      if (!c) return null;
      return {
        name: r.eventName,
        nameVi: c.vi,
        weight: c.weight,
        at: etToIso(date, r.gmt),
        consensus: clean(r.consensus),
        previous: clean(r.previous),
      };
    })
    .filter(Boolean)
    // Chọn 8 sự kiện quan trọng nhất, rồi xếp lại theo giờ để đọc như một cái lịch.
    .sort((a, b) => (b.weight - a.weight) || String(a.at).localeCompare(String(b.at)))
    .slice(0, 8)
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

const MIN_CAP = 5e9;   // dưới 5 tỷ USD thì gần như không ảnh hưởng chỉ số chung
const WHEN = { "time-pre-market": "trước giờ mở", "time-after-hours": "sau giờ đóng", "time-not-supplied": null };

async function earnings(date) {
  const rows = (await json(`${API}/earnings?date=${date}`))?.data?.rows || [];
  return rows
    .map(r => {
      const cap = Number(String(r.marketCap || "").replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(cap) || cap < MIN_CAP) return null;
      return {
        symbol: r.symbol,
        name: (r.name || "").replace(/[\s,]+(Inc\.?|Corporation|Corp\.?|Ltd\.?|Limited|Company|Co\.?|plc|Holdings?|Group)\.?$/i, "").replace(/[\s,]+$/, "").trim(),
        when: WHEN[r.time] ?? null,
        epsForecast: clean(r.epsForecast),
        marketCap: cap,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, 10);
}

/** Lỗi ở đây không được làm hỏng bản tin — thiếu lịch thì bỏ mục đó. */
export async function getCalendar(now = new Date()) {
  const d = nextTradingDay(now);
  if (!d) return null;
  const date = `${d.year}-${d.month}-${d.day}`;
  const [eco, earn] = await Promise.all([
    economic(date).catch(e => (console.warn(`  ! lịch vĩ mô: ${e.message}`), [])),
    earnings(date).catch(e => (console.warn(`  ! lịch earnings: ${e.message}`), [])),
  ]);
  if (!eco.length && !earn.length) return null;
  return { date, economic: eco, earnings: earn };
}
