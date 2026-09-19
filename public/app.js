/* Bản tin Thị trường Mỹ — JS dùng chung cho mọi trang.
   Mỗi trang gọi Page.mount("<tên trang>") ở cuối file HTML. */
(() => {
const TZ = "Asia/Taipei";
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

const PAGES = [
  { id: "index",     file: "index.html",     label: "Tổng quan" },
  { id: "news",      file: "news.html",      label: "Tin" },
  { id: "watchlist", file: "watchlist.html", label: "Danh mục" },
  { id: "analysis",  file: "analysis.html",  label: "Phân tích" },
  { id: "market",    file: "market.html",    label: "Thị trường" },
];

/* ── giao diện sáng/tối ── */
try { const t = localStorage.getItem("theme"); if (t) document.documentElement.dataset.theme = t; } catch {}
function toggleTheme() {
  const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch {}
}

/* ── định dạng ── */
const nf = (a, b) => new Intl.NumberFormat("vi-VN", { minimumFractionDigits: a, maximumFractionDigits: b });
const dtf = o => new Intl.DateTimeFormat("vi-VN", { timeZone: TZ, ...o });
const WD = ["Chủ nhật","Thứ hai","Thứ ba","Thứ tư","Thứ năm","Thứ sáu","Thứ bảy"];
const IMPACT = { high: "Tác động cao", medium: "Đáng chú ý", low: "Tham khảo" };
const TONE = { positive: ["Tích cực", "calm"], negative: ["Tiêu cực", "alert"], mixed: ["Trái chiều", "watch"], neutral: ["Trung tính", "watch"] };

function fmtPrice(kind, v) {
  if (v == null) return "—";
  if (kind === "yield") return nf(3, 3).format(v) + "%";
  if (kind === "usd")   return "$" + nf(2, 2).format(v);
  return nf(2, 2).format(v);
}
function fmtChange(kind, chg, pct) {
  if (kind === "yield") {
    if (chg == null) return { text: "—", cls: "flat" };
    const bp = Math.round(chg * 100);
    return { text: `${bp > 0 ? "+" : ""}${bp} bp`, cls: bp > 0 ? "up" : bp < 0 ? "down" : "flat" };
  }
  const v = pct ?? chg;
  if (v == null) return { text: "—", cls: "flat" };
  return { text: `${v > 0 ? "+" : ""}${nf(2, 2).format(v)}%`, cls: v > 0.0001 ? "up" : v < -0.0001 ? "down" : "flat" };
}
function fmtSession(id) {
  const [y, m, d] = id.split("-").map(Number);
  return `${WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")}/${y}`;
}
function relTime(iso) {
  if (!iso) return "";
  const h = (Date.now() - Date.parse(iso)) / 3600e3;
  if (!isFinite(h)) return "";
  if (h < 1) return "vừa xong";
  if (h < 24) return `${Math.round(h)} giờ trước`;
  return dtf({ day: "2-digit", month: "2-digit" }).format(new Date(iso));
}
function trunc(text, max) {
  const t = String(text).trim().replace(/[.…\s]+$/, "");
  if (t.length <= max) return t + "…";
  const cut = t.lastIndexOf(" ", max);
  return t.slice(0, cut > max * 0.6 ? cut : max).replace(/[.,;:\s]+$/, "") + "…";
}
// Không dùng lookbehind: Safari iOS < 16.4 sẽ chết ngay lúc parse.
const first = (t, n = 1) => (String(t || "").match(/[^.!?]+[.!?]+(\s|$)/g) || [String(t || "")]).slice(0, n).join("").trim();
const confHtml = c => `<span class="conf">Tin cậy ${[1,2,3,4,5].map(i => `<i class="${i <= (c || 0) ? "f" : ""}"></i>`).join("")}</span>`;

/* ── URL: giữ ?d=YYYY-MM-DD khi chuyển trang ── */
const params = new URLSearchParams(location.search);
const dateParam = params.get("d");
const href = file => file + (dateParam ? `?d=${encodeURIComponent(dateParam)}` : "");

/* ── khung chung: nav + masthead ── */
function renderNav(active) {
  const nav = $("#nav");
  if (!nav) return;
  nav.innerHTML = `<div class="wrap">${PAGES.map(p =>
    `<a href="${href(p.file)}" class="${p.id === active ? "on" : ""}">${p.label}<span class="k" data-count="${p.id}"></span></a>`).join("")}</div>`;
}
function setCounts(d) {
  const c = {
    news: (d.stories || []).length,
    watchlist: (d.watch || []).filter(w => w.stories?.length).length,
    analysis: (d.links || []).length + (d.feature ? 1 : 0),
    market: (d.market || []).filter(m => m.ok && m.g !== "signal").length,
  };
  document.querySelectorAll("[data-count]").forEach(el => { const v = c[el.dataset.count]; if (v) el.textContent = v; });
}
function renderHead(d) {
  $("#session").textContent = "Phiên " + fmtSession(d.sessionDate);
  const g = new Date(d.generatedAt);
  $("#generated").textContent = `Tổng hợp ${dtf({ hour: "2-digit", minute: "2-digit", hour12: false }).format(g)} · ${dtf({ day: "2-digit", month: "2-digit", year: "numeric" }).format(g)} giờ Đài Bắc`;
}

/* ── các khối ── */
function tape(rows) {
  return rows.map(m => {
    const c = fmtChange(m.kind, m.change, m.changePct);
    return `<div class="tick"><div class="lbl">${esc(m.label)}</div>
      <div class="val">${m.ok ? fmtPrice(m.kind, m.price) : "—"}</div>
      <div class="chg ${c.cls}">${m.ok ? c.text : ""}</div></div>`;
  }).join("");
}
function verdict(d) {
  return d.verdict ? `<div class="verdict"><div class="eyebrow">Kết luận phiên</div><p class="q">${esc(d.verdict)}</p></div>` : "";
}
function pickHot(stories) {
  const byScore = (a, b) => (b.score ?? 0) - (a.score ?? 0);
  const hot = stories.filter(s => s.impact === "high").sort(byScore).slice(0, 6);
  if (hot.length < 3) for (const s of stories.filter(s => s.impact === "medium").sort(byScore)) { if (hot.length >= 3) break; hot.push(s); }
  return hot;
}
function storyFoot(s) {
  const impact = s.impact || "medium";
  return `<div class="foot"><span class="badge ${impact}">${IMPACT[impact] || IMPACT.medium}</span>
    <span class="dot">·</span><span class="src">${esc(s.sources.join(" · "))}</span>
    ${s.sources.length > 1 ? `<span class="dot">·</span><span class="mono">${s.sources.length} nguồn</span>` : ""}
    ${s.date ? `<span class="dot">·</span><span>${esc(relTime(s.date))}</span>` : ""}</div>`;
}
function storyBody(s) {
  return `${s.summaryVi ? `<p class="sum">${esc(s.summaryVi)}</p>` : (s.summary ? `<p class="sum">${esc(trunc(s.summary, 240))}</p>` : "")}
    ${s.implicationVi ? `<div class="imp"><b>Ẩn ý &amp; hệ quả</b>${esc(s.implicationVi)}</div>` : ""}
    ${s.titleVi && s.titleVi !== s.title ? `<p class="orig">${esc(s.title)}</p>` : ""}`;
}
function hot(list) {
  if (!list.length) return "";
  return `<section class="hot"><h2 class="sec">Tin nóng — ảnh hưởng trực tiếp tới thị trường<span class="n">${list.length} tin</span></h2>
    ${list.map((s, i) => `<div class="hot-item ${i === 0 ? "lead" : ""}"><div class="rk">${String(i + 1).padStart(2, "0")}</div><div class="bd">
      <h3><a href="${esc(s.link)}" target="_blank" rel="noopener noreferrer">${esc(s.titleVi || s.title)}</a></h3>${storyBody(s)}${storyFoot(s)}</div></div>`).join("")}</section>`;
}
function story(s) {
  return `<article class="story ${s.impact === "high" ? "high" : ""}">
    <h3><a href="${esc(s.link)}" target="_blank" rel="noopener noreferrer">${esc(s.titleVi || s.title)}</a></h3>${storyBody(s)}${storyFoot(s)}</article>`;
}
function categories(d, exclude) {
  const order = (d.categories || []).map(c => c.id);
  const label = Object.fromEntries((d.categories || []).map(c => [c.id, c.label]));
  const groups = new Map();
  for (const s of d.stories || []) {
    if (exclude.has(s.link)) continue;
    if (!groups.has(s.category)) groups.set(s.category, []);
    groups.get(s.category).push(s);
  }
  const sorted = [...groups.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  if (!sorted.length) return "";
  const n = sorted.reduce((a, [, l]) => a + l.length, 0);
  return `<h2 class="sec" style="margin-top:34px">Các tin còn lại theo nhóm<span class="n">${n} tin</span></h2>`
    + sorted.map(([cat, list]) => `<section class="cat"><h4 class="blk-h">${esc(label[cat] || cat)} · ${list.length}</h4>${list.map(story).join("")}</section>`).join("");
}
function signals(d, compact) {
  const list = d.signals || [];
  if (!list.length) return "";
  return `<section class="signals"><h2 class="sec">Tín hiệu suy ra<span class="n">tính bằng công thức cố định</span></h2>
    <div class="sig-grid">${list.map(s => `<div class="sig">
      <div class="top"><span class="nm">${esc(s.label)}</span><span class="v ${s.dir === "up" ? "up" : s.dir === "down" ? "down" : "flat"}">${esc(s.value)}</span></div>
      <span class="chip ${esc(s.tone)}">${esc(s.state)}</span>
      ${compact ? "" : `<div class="note">${esc(s.note)}</div><div class="inp">${esc(s.inputs)}</div>`}</div>`).join("")}</div></section>`;
}
function chains(d) {
  const list = d.chains || [];
  if (!list.length) return "";
  return `<section class="chains"><h2 class="sec">Chuỗi suy luận<span class="n">${list.length} mạch</span></h2>
    ${list.map(c => `<div class="chain"><div class="sig-t">${esc(c.signal)}</div>
      ${c.hidden ? `<p class="hid">${esc(c.hidden)}</p>` : ""}
      <ol class="steps">${c.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
      ${c.evidence?.length ? `<div class="ev">${c.evidence.map(e => `<span>${esc(e)}</span>`).join("")}</div>` : ""}
      ${c.invalidate ? `<div class="inv"><b>Chuỗi này sai khi</b>${esc(c.invalidate)}</div>` : ""}</div>`).join("")}</section>`;
}
const itemHtml = p => `<div class="item"><span class="h">${esc(p.title)}</span><span class="x">${esc(p.text)}</span></div>`;
function overlooked(d) {
  const list = d.overlooked || [];
  if (!list.length) return "";
  const h = Math.ceil(list.length / 2);
  return `<section class="pad"><h2 class="sec">Dễ bị bỏ qua</h2><div class="two"><div>${list.slice(0, h).map(itemHtml).join("")}</div><div>${list.slice(h).map(itemHtml).join("")}</div></div></section>`;
}
function calendar(d, compact) {
  const c = d.calendar;
  if (!c || (!c.economic?.length && !c.earnings?.length)) return "";
  const hhmm = iso => iso ? dtf({ hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)) : "—";
  const eco = (c.economic || []).slice(0, compact ? 4 : 99).map(e => {
    const sub = [e.name, e.consensus && `dự báo ${e.consensus}`, e.previous && `kỳ trước ${e.previous}`].filter(Boolean).map(esc);
    return `<div class="ev-row"><span class="t">${esc(hhmm(e.at))}</span><span class="b"><span class="n">${esc(e.nameVi || e.name)}</span>
      <span class="d"><em>${sub[0]}</em>${sub.length > 1 ? " · " + sub.slice(1).join(" · ") : ""}</span></span></div>`;
  }).join("");
  const earn = (c.earnings || []).slice(0, compact ? 4 : 99).map(e => {
    const cap = e.marketCap >= 1e12 ? `${(e.marketCap / 1e12).toFixed(1)} nghìn tỷ` : `${Math.round(e.marketCap / 1e9)} tỷ`;
    const sub = [e.when, e.epsForecast && `EPS dự báo ${e.epsForecast}`, `vốn hoá ${cap} USD`].filter(Boolean).map(esc);
    return `<div class="ev-row"><span class="b"><span class="n"><b>${esc(e.symbol)}</b>${esc(e.name || "")}</span><span class="d">${sub.join(" · ")}</span></span></div>`;
  }).join("");
  const [y, mo, da] = c.date.split("-").map(Number);
  return `<section class="pad"><h2 class="sec">Lịch phiên tới — ${esc(WD[new Date(Date.UTC(y, mo - 1, da)).getUTCDay()])}, ${String(da).padStart(2,"0")}/${String(mo).padStart(2,"0")}<span class="n">giờ Đài Bắc</span></h2>
    <div class="two">${eco ? `<div><h4 class="blk-h">Số liệu &amp; sự kiện</h4>${eco}</div>` : "<div></div>"}${earn ? `<div><h4 class="blk-h">Báo cáo lợi nhuận</h4>${earn}</div>` : ""}</div></section>`;
}
function board(d) {
  const groups = d.tickerGroups || [];
  const rows = (d.market || []).filter(m => m.ok);
  const blocks = groups.map(g => {
    const ids = [g.id, ...(g.merge || [])];
    let list = rows.filter(m => ids.includes(m.g));
    if (!list.length) return "";
    if (g.sortByChange) list = [...list].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0));
    return `<div><h4 class="blk-h">${esc(g.label)}</h4>` + list.map(m => {
      const c = fmtChange(m.kind, m.change, m.changePct);
      return `<div class="row"><span class="nm">${esc(m.label)}</span><span class="pv">${fmtPrice(m.kind, m.price)}</span><span class="pc ${c.cls}">${c.text}</span></div>`;
    }).join("") + `</div>`;
  }).filter(Boolean);
  if (!blocks.length) return "";
  const shown = groups.flatMap(g => [g.id, ...(g.merge || [])]);
  return `<section class="pad"><h2 class="sec">Bảng thị trường<span class="n">${rows.filter(m => shown.includes(m.g)).length} mã</span></h2><div class="two">${blocks.join("")}</div></section>`;
}

/* ── danh mục ── */
const wpx = w => {
  if (!w.ok) return `<span class="px flat">—</span>`;
  const c = fmtChange("usd", w.change, w.changePct);
  return `<span class="px"><b>$${nf(2, 2).format(w.price)}</b><span class="${c.cls}">${c.text}</span></span>`;
};
const linkTitle = (d, id) => (d.links || []).find(l => l.id === id)?.title || id;
function watchCard(d, w) {
  const t = w.tone && TONE[w.tone];
  return `<div class="wc">
    <div class="top"><span class="id"><span class="sym">${esc(w.sym)}</span><span class="nm">${esc(w.label)}</span></span>${wpx(w)}</div>
    ${t ? `<span class="chip ${t[1]}">${t[0]}</span>` : ""}
    ${w.noteVi ? `<div class="note">${esc(w.noteVi)}</div>` : ""}
    ${w.links?.length ? `<div class="chips">${w.links.map(id => `<a class="tk dim" href="${href("analysis.html")}#link-${esc(id)}">${esc(linkTitle(d, id))}</a>`).join("")}</div>` : ""}
    ${w.secondOrder ? `<div class="so"><b>Tầng hai</b>${esc(w.secondOrder)}</div>` : ""}
    ${w.changeView ? `<div class="cv">${esc(w.changeView)}</div>` : ""}
    <ul>${w.stories.map(s => `<li><a href="${esc(s.link)}" target="_blank" rel="noopener noreferrer">${esc(s.titleVi || s.title)}</a><span class="s">${esc(s.source)}</span></li>`).join("")}</ul></div>`;
}
function watch(d, full) {
  const list = d.watch || [];
  if (!list.length) return "";
  const abs = w => Math.abs(w.changePct ?? 0);
  const withNews = list.filter(w => w.stories?.length).sort((a, b) => abs(b) - abs(a));
  const rest = list.filter(w => !w.stories?.length).sort((a, b) => abs(b) - abs(a));
  const rows = rest.map(w => {
    const c = w.ok ? fmtChange("usd", w.change, w.changePct) : { text: "—", cls: "flat" };
    const big = w.ok && Math.abs(w.changePct) >= 3;
    return `<div class="row"><span class="nm"><b>${esc(w.sym)}</b>${esc(w.label)}${big ? `<span class="flag">±3% không có tin</span>` : ""}</span>
      <span class="pv">${w.ok ? "$" + nf(2, 2).format(w.price) : "—"}</span><span class="pc ${c.cls}">${c.text}</span></div>`;
  }).join("");
  return `<section class="watch"><h2 class="sec">Danh mục theo dõi<span class="n">${withNews.length} mã có tin · ${list.length} mã</span></h2>
    ${withNews.length ? `<div class="w-grid">${withNews.map(w => watchCard(d, w)).join("")}</div>` : ""}
    ${rows ? `<h4 class="blk-h" style="margin-top:22px">Không có tin trong phiên</h4><div class="w-rest">${rows}</div>` : ""}</section>`;
}

/* ── phân tích sâu ── */
function feature(d) {
  const f = d.feature;
  if (!f) return "";
  const ul = a => `<ul>${a.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
  return `<section class="pad"><h2 class="sec">Phân tích sâu<span class="n">${f.linkId ? esc(linkTitle(d, f.linkId)) : ""}</span></h2>
    <div class="feature">
      <div class="fk">${confHtml(f.confidence)}${f.linkId ? `<a class="tk dim" href="#link-${esc(f.linkId)}">${esc(linkTitle(d, f.linkId))}</a>` : ""}</div>
      <h3>${esc(f.title)}</h3>
      <div class="fb"><h4>Chuyện gì đã xảy ra<em>sự kiện</em></h4><p>${esc(f.context)}</p></div>
      ${f.whySurface ? `<div class="fb"><h4>Lý do bề nổi</h4><p>${esc(f.whySurface)}</p></div>` : ""}
      <div class="fb root"><h4>Vì sao — suy luận gốc rễ<em>giả thuyết</em></h4><p>${esc(f.whyRoot)}</p></div>
      ${f.whyNow ? `<div class="fb"><h4>Vì sao lúc này</h4><p>${esc(f.whyNow)}</p></div>` : ""}
      ${f.evidenceFor.length || f.evidenceAgainst.length ? `<div class="ev2">
        ${f.evidenceFor.length ? `<div class="fb for"><h4>Bằng chứng ủng hộ</h4>${ul(f.evidenceFor)}</div>` : "<div></div>"}
        ${f.evidenceAgainst.length ? `<div class="fb against"><h4>Bằng chứng ngược chiều</h4>${ul(f.evidenceAgainst)}</div>` : ""}</div>` : ""}
      <div class="fb"><h4>Kịch bản</h4><div class="scen">${f.scenarios.map(s => `<div class="sc"><div class="n">${esc(s.name)}</div><div class="e">${esc(s.effect)}</div>${s.why ? `<div class="w">${esc(s.why)}</div>` : ""}</div>`).join("")}</div></div>
      ${f.indicators.length ? `<div class="fb"><h4>Chỉ báo cần theo dõi</h4>${ul(f.indicators)}</div>` : ""}
      <div class="fb inv"><h4>Bài này sai khi</h4><p>${esc(f.invalidate)}</p></div>
    </div></section>`;
}
function links(d) {
  const list = d.links || [];
  if (!list.length) return "";
  const byLink = new Map((d.stories || []).map(s => [s.link, s]));
  return `<section class="pad"><h2 class="sec">Mạch liên kết trong ngày<span class="n">${list.length} mạch</span></h2><div class="link-grid">
    ${list.map(l => `<div class="lk" id="link-${esc(l.id)}"><div class="t">${esc(l.title)}</div><div class="th">${esc(l.thesis)}</div>
      ${l.tickers?.length ? `<div class="chips">${l.tickers.map(t => `<span class="tk">${esc(t)}</span>`).join("")}</div>` : ""}
      <ul>${l.storyLinks.map(k => byLink.get(k)).filter(Boolean).map(s => `<li><a href="${esc(s.link)}" target="_blank" rel="noopener noreferrer">${esc(s.titleVi || s.title)}</a></li>`).join("")}</ul></div>`).join("")}</div></section>`;
}

/* ── tổng quan ── */
function overview(d) {
  const hotList = pickHot(d.stories || []).slice(0, 4);
  const f = d.feature;
  const movers = (d.watch || []).filter(w => w.ok).sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 6);
  const li = (t, extra = "") => `<div class="li">${t}${extra}</div>`;
  const pc = w => { const c = fmtChange("usd", w.change, w.changePct); return `<span class="pc ${c.cls}">${c.text}</span>`; };

  const cards = [
    `<div class="lead"><h3>Tin nóng<a href="${href("news.html")}">${(d.stories || []).length} tin →</a></h3>
      ${hotList.map(s => li(`<a href="${esc(s.link)}" target="_blank" rel="noopener noreferrer">${esc(s.titleVi || s.title)}</a><span class="m">${esc(s.sources[0])}</span>`)).join("") || `<div class="empty">Chưa có tin.</div>`}</div>`,
    `<div class="lead"><h3>Phân tích sâu<a href="${href("analysis.html")}">đọc đủ →</a></h3>
      ${f ? `<p class="t"><b>${esc(f.title)}</b>${esc(first(f.whyRoot, 2))}</p><div class="more">${confHtml(f.confidence)}</div>` : `<div class="empty">Phiên này chưa có bài phân tích sâu${d.meta?.llm ? "" : " — chưa bật LLM"}.</div>`}
      ${(d.links || []).length ? `<div class="more" style="padding-top:8px">${(d.links || []).map(l => `<a href="${href("analysis.html")}#link-${esc(l.id)}">${esc(l.title)}</a>`).join(" · ")}</div>` : ""}</div>`,
    `<div class="lead"><h3>Danh mục theo dõi<a href="${href("watchlist.html")}">${(d.watch || []).filter(w => w.stories?.length).length} mã có tin →</a></h3>
      ${movers.map(w => { const t = w.tone && TONE[w.tone]; return li(`<span class="sym">${esc(w.sym)}</span>${esc(w.label)}${t ? ` <span class="chip ${t[1]}" style="margin:0 0 0 8px;padding:2px 6px">${t[0]}</span>` : ""}`, pc(w)); }).join("")}</div>`,
    `<div class="lead"><h3>Tín hiệu &amp; lịch<a href="${href("market.html")}">bảng đầy đủ →</a></h3>
      <div class="chips" style="margin-bottom:10px">${(d.signals || []).map(s => `<span class="chip ${esc(s.tone)}" style="margin:0">${esc(s.label)}: ${esc(s.state)}</span>`).join("")}</div>
      ${(d.calendar?.economic || []).slice(0, 3).map(e => li(`${esc(e.nameVi || e.name)}<span class="m">${e.at ? esc(dtf({ hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(e.at))) : ""}</span>`)).join("")}
      ${(d.calendar?.earnings || []).slice(0, 3).map(e => li(`<span class="sym">${esc(e.symbol)}</span>${esc(e.name || "")}<span class="m">${esc(e.when || "")}</span>`)).join("")}</div>`,
  ];
  return `<div class="lead-grid">${cards.join("")}</div>`;
}

/* ── trang ── */
const RENDER = {
  index: d => `${verdict(d)}${overview(d)}${chains(d)}`,
  news: d => { const h = pickHot(d.stories || []); return `${hot(h)}${categories(d, new Set(h.map(s => s.link)))}` || `<div class="state">Không có tin trong phiên này.</div>`; },
  watchlist: d => watch(d, true) || `<div class="state">Chưa có danh mục.</div>`,
  analysis: d => `${verdict(d)}${feature(d)}${links(d)}${chains(d)}${overlooked(d)}${signals(d, false)}`
    || `<div class="state">Phiên này chưa có phân tích.</div>`,
  market: d => `${signals(d, true)}${board(d)}${calendar(d, false)}`,
};

function stats(d) {
  const m = d.meta || {};
  const el = $("#stats");
  if (!el) return;
  el.innerHTML = `Quét <code>${m.scanned ?? "?"}</code> bài từ <code>${m.feeds ?? "?"}</code> nguồn · giữ lại <code>${m.published ?? (d.stories || []).length}</code> tin · <code>${m.marketOk ?? "?"}</code> mã giá`
    + (m.llm ? ` · biên tập bằng <code>${esc(m.llm)}</code>` : ` · chưa bật tóm tắt tiếng Việt`)
    + (m.llmError ? `<br>LLM lỗi: <code>${esc(m.llmError)}</code>` : "");
}
function showError(e) {
  $("#main").innerHTML = `<div class="state err">${esc(e.message)}</div>`;
  const g = $("#generated"); if (g) g.textContent = "Lỗi tải dữ liệu";
}
async function loadArchive(currentId) {
  try {
    const r = await fetch("data/index.json?t=" + Date.now());
    if (!r.ok) return;
    const sel = $("#archive");
    sel.innerHTML = (await r.json()).map(e => `<option value="${esc(e.id)}"${e.id === currentId ? " selected" : ""}>${esc(fmtSession(e.id))}</option>`).join("");
    sel.onchange = () => { location.search = "?d=" + encodeURIComponent(sel.value); };
  } catch {}
}

async function mount(page) {
  renderNav(page);
  $("#theme").onclick = toggleTheme;
  // Báo lỗi ra màn hình thay vì đứng im ở "Đang tải…"
  window.addEventListener("error", ev => showError(new Error("Lỗi trang: " + (ev.message || "không rõ"))));
  window.addEventListener("unhandledrejection", ev => showError(new Error("Lỗi tải: " + (ev.reason?.message || ev.reason || "không rõ"))));
  try {
    const url = dateParam ? `data/${encodeURIComponent(dateParam)}.json` : "data/latest.json";
    const r = await fetch(url + "?t=" + Date.now());
    if (!r.ok) throw new Error(dateParam ? `Không có bản tin cho ${dateParam}.` : "Chưa có bản tin nào. Chạy `npm run build` hoặc đợi workflow chạy lần đầu.");
    const d = await r.json();
    renderHead(d);
    setCounts(d);
    const t = $("#tape"); if (t) t.innerHTML = tape((d.market || []).filter(m => !m.g || m.g === "core"));
    $("#main").innerHTML = RENDER[page](d);
    stats(d);
    loadArchive(d.id);
  } catch (e) { showError(e); }
}

window.Page = { mount };
})();
