// Tiện ích dùng chung — cố ý không phụ thuộc package ngoài nào.

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36";

export async function fetchText(url, { tries = 3, timeout = 25000 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const ctl = AbortSignal.timeout(timeout);
      const r = await fetch(url, { headers: { "user-agent": UA, accept: "*/*" }, signal: ctl });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      last = e;
      if (i < tries - 1) await new Promise(s => setTimeout(s, 1200 * (i + 1)));
    }
  }
  throw last;
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", "#8217": "’", "#8216": "‘", "#8220": "“", "#8221": "”", "#8230": "…" };

export function decodeEntities(s = "") {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z0-9#]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? ENTITIES[n] ?? m);
}

export function stripTags(s = "") {
  return decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return "";
  return decodeEntities(m[1].replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "")).trim();
}

/** Parse RSS 2.0 / Atom tối thiểu -> [{title, link, date, summary}] */
export function parseFeed(xml) {
  const out = [];
  const blocks = xml.match(/<(item|entry)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi) || [];
  for (const b of blocks) {
    let link = tag(b, "link");
    if (!link) link = (b.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || "";
    const rawTitle = stripTags(tag(b, "title"));
    if (!rawTitle) continue;
    const dateStr = tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date");
    const d = dateStr ? new Date(dateStr) : null;
    out.push({
      title: rawTitle,
      link: link.trim(),
      date: d && !isNaN(d) ? d.toISOString() : null,
      summary: stripTags(tag(b, "description") || tag(b, "summary") || tag(b, "content")).slice(0, 400),
    });
  }
  return out;
}

const STOP = new Set("a an the of to in on for with and or as at by from is are was were be been will would could should this that these those its it his her their he she they we you i us new say says said after before over under more most than then how why what when who".split(" "));

/** Cắt đuôi thô để "keeps"/"keeping"/"kept" gom về cùng gốc khi so trùng tiêu đề. */
function stem(w) {
  return w
    .replace(/(ies)$/, "y")
    .replace(/(sses|shes|ches|xes)$/, "")
    .replace(/(ing|ed|es|s)$/, "")
    || w;
}

export function tokens(s) {
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/)
      .filter(w => w.length > 2 && !STOP.has(w))
      .map(stem)
      .filter(w => w.length > 2)
  );
}

export function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Google News gắn " - Tên báo" vào cuối tiêu đề; bỏ đi cho gọn. */
export function cleanGoogleTitle(t) {
  return t.replace(/\s+-\s+[^-]{2,40}$/, "").trim();
}
