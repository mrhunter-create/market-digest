// Nguồn tin — tất cả đều free, không cần khoá API.
// weight: độ tin cậy/tầm quan trọng của nguồn, cộng thẳng vào điểm bài viết.
export const FEEDS = [
  // Nguồn gốc (cơ quan nhà nước) — trọng số cao nhất, tin ở đây gần như luôn đáng đăng.
  { id: "fed",        name: "Federal Reserve", weight: 14, url: "https://www.federalreserve.gov/feeds/press_all.xml" },
  { id: "fed-speech", name: "Fed (phát biểu)", weight: 12, url: "https://www.federalreserve.gov/feeds/speeches.xml" },
  { id: "sec",        name: "SEC",             weight: 9,  url: "https://www.sec.gov/news/pressreleases.rss" },

  // Hãng tin lớn
  { id: "cnbc-top",   name: "CNBC",            weight: 4,  url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114" },
  { id: "cnbc-mkt",   name: "CNBC Markets",    weight: 4,  url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664" },
  { id: "cnbc-econ",  name: "CNBC Economy",    weight: 5,  url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258" },
  { id: "cnbc-earn",  name: "CNBC Earnings",   weight: 4,  url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839135" },
  { id: "cnbc-inv",   name: "CNBC Investing",  weight: 3,  url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069" },
  { id: "cnbc-tech",  name: "CNBC Tech",       weight: 3,  url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910" },
  { id: "cnbc-biz",   name: "CNBC Business",   weight: 3,  url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147" },
  { id: "cnbc-pol",   name: "CNBC Politics",   weight: 2,  url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000113" },
  { id: "mw-top",     name: "MarketWatch",     weight: 4,  url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" },
  { id: "mw-rt",      name: "MarketWatch RT",  weight: 3,  url: "https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines" },
  { id: "yahoo",      name: "Yahoo Finance",   weight: 2,  url: "https://finance.yahoo.com/news/rssindex" },
  { id: "investing",  name: "Investing.com",   weight: 2,  url: "https://www.investing.com/rss/news_25.rss" },
  { id: "nasdaq",     name: "Nasdaq",          weight: 3,  url: "https://www.nasdaq.com/feed/rssoutbound?category=Markets" },
  { id: "bi",         name: "Business Insider",weight: 2,  url: "https://markets.businessinsider.com/rss/news" },
  { id: "sa",         name: "Seeking Alpha",   weight: 3,  url: "https://seekingalpha.com/market_currents.xml" },

  // Các báo không còn RSS công khai -> đi vòng qua Google News
  { id: "gn-reuters", name: "Reuters",         weight: 5,  url: "https://news.google.com/rss/search?q=when:1d+site:reuters.com+(%22Wall+Street%22+OR+%22Federal+Reserve%22+OR+inflation+OR+tariffs+OR+earnings+OR+stocks+OR+treasury)&hl=en-US&gl=US&ceid=US:en" },
  { id: "gn-wsj",     name: "WSJ",             weight: 5,  url: "https://news.google.com/rss/search?q=when:1d+site:wsj.com+(%22Wall+Street%22+OR+%22Federal+Reserve%22+OR+inflation+OR+tariffs+OR+earnings+OR+stocks+OR+treasury)&hl=en-US&gl=US&ceid=US:en" },
  { id: "gn-bberg",   name: "Bloomberg",       weight: 5,  url: "https://news.google.com/rss/search?q=when:1d+site:bloomberg.com&hl=en-US&gl=US&ceid=US:en" },
  { id: "gn-ft",      name: "Financial Times", weight: 5,  url: "https://news.google.com/rss/search?q=when:1d+site:ft.com&hl=en-US&gl=US&ceid=US:en" },
  { id: "gn-barrons", name: "Barron's",        weight: 4,  url: "https://news.google.com/rss/search?q=when:1d+site:barrons.com&hl=en-US&gl=US&ceid=US:en" },
  { id: "gn-treas",   name: "US Treasury",     weight: 8,  url: "https://news.google.com/rss/search?q=when:1d+site:home.treasury.gov&hl=en-US&gl=US&ceid=US:en" },
];

// group quyết định mã nằm ở khối nào trên trang.
export const TICKERS = [
  // Dải chính trên đầu trang
  { g: "core",   cnbc: ".SPX",    yahoo: "^GSPC",    label: "S&P 500",       kind: "index" },
  { g: "core",   cnbc: ".IXIC",   yahoo: "^IXIC",    label: "Nasdaq",        kind: "index" },
  { g: "core",   cnbc: ".DJI",    yahoo: "^DJI",     label: "Dow Jones",     kind: "index" },
  { g: "core",   cnbc: ".RUT",    yahoo: "^RUT",     label: "Russell 2000",  kind: "index" },
  { g: "core",   cnbc: ".VIX",    yahoo: "^VIX",     label: "VIX",           kind: "level" },
  { g: "core",   cnbc: "US10Y",   yahoo: "^TNX",     label: "Lợi suất 10 năm", kind: "yield" },
  { g: "core",   cnbc: ".DXY",    yahoo: "DX-Y.NYB", label: "Chỉ số USD",    kind: "level" },
  { g: "core",   cnbc: "@CL.1",   yahoo: "CL=F",     label: "Dầu WTI",       kind: "usd" },
  { g: "core",   cnbc: "@GC.1",   yahoo: "GC=F",     label: "Vàng",          kind: "usd" },
  { g: "core",   cnbc: "BTC.CM=", yahoo: "BTC-USD",  label: "Bitcoin",       kind: "usd" },

  { g: "rates",  cnbc: "US2Y",    yahoo: "^IRX",     label: "Lợi suất 2 năm",  kind: "yield" },
  { g: "rates",  cnbc: "US30Y",   yahoo: "^TYX",     label: "Lợi suất 30 năm", kind: "yield" },

  { g: "mega",   cnbc: "NVDA",    yahoo: "NVDA",     label: "Nvidia",        kind: "usd" },
  { g: "mega",   cnbc: "AAPL",    yahoo: "AAPL",     label: "Apple",         kind: "usd" },
  { g: "mega",   cnbc: "MSFT",    yahoo: "MSFT",     label: "Microsoft",     kind: "usd" },
  { g: "mega",   cnbc: "GOOGL",   yahoo: "GOOGL",    label: "Alphabet",      kind: "usd" },
  { g: "mega",   cnbc: "AMZN",    yahoo: "AMZN",     label: "Amazon",        kind: "usd" },
  { g: "mega",   cnbc: "META",    yahoo: "META",     label: "Meta",          kind: "usd" },
  { g: "mega",   cnbc: "TSLA",    yahoo: "TSLA",     label: "Tesla",         kind: "usd" },
  { g: "mega",   cnbc: "AVGO",    yahoo: "AVGO",     label: "Broadcom",      kind: "usd" },

  { g: "sector", cnbc: "XLK",     yahoo: "XLK",      label: "Công nghệ",     kind: "usd" },
  { g: "sector", cnbc: "XLF",     yahoo: "XLF",      label: "Tài chính",     kind: "usd" },
  { g: "sector", cnbc: "XLE",     yahoo: "XLE",      label: "Năng lượng",    kind: "usd" },
  { g: "sector", cnbc: "XLV",     yahoo: "XLV",      label: "Y tế",          kind: "usd" },
  { g: "sector", cnbc: "XLY",     yahoo: "XLY",      label: "Tiêu dùng",     kind: "usd" },
  { g: "sector", cnbc: "XLI",     yahoo: "XLI",      label: "Công nghiệp",   kind: "usd" },

  { g: "world",  cnbc: ".N225",   yahoo: "^N225",    label: "Nikkei 225",    kind: "index" },
  { g: "world",  cnbc: ".HSI",    yahoo: "^HSI",     label: "Hang Seng",     kind: "index" },
  { g: "world",  cnbc: ".TWII",   yahoo: "^TWII",    label: "Đài Loan",      kind: "index" },
  { g: "world",  cnbc: ".KS11",   yahoo: "^KS11",    label: "KOSPI",         kind: "index" },
  { g: "world",  cnbc: ".GDAXI",  yahoo: "^GDAXI",   label: "DAX",           kind: "index" },
  { g: "world",  cnbc: ".FTSE",   yahoo: "^FTSE",    label: "FTSE 100",      kind: "index" },

  { g: "commod", cnbc: "@NG.1",   yahoo: "NG=F",     label: "Khí đốt",       kind: "usd" },
  { g: "commod", cnbc: "@HG.1",   yahoo: "HG=F",     label: "Đồng",          kind: "usd" },
];

// Tiêu đề các khối số liệu phụ, hiển thị theo đúng thứ tự này.
export const TICKER_GROUPS = [
  { id: "mega",   label: "Cổ phiếu vốn hoá lớn", sortByChange: true },
  { id: "sector", label: "Nhóm ngành",           sortByChange: true },
  { id: "world",  label: "Thị trường thế giới",  sortByChange: false },
  { id: "rates",  label: "Lợi suất & hàng hoá khác", sortByChange: false, merge: ["commod"] },
];

// Từ khoá chấm điểm mức ảnh hưởng tới thị trường Mỹ.
export const KEYWORDS = [
  [12, ["fomc", "federal reserve", "interest rate decision", "rate cut", "rate hike", "jerome powell", "basis point", "fed chair", "fed official", "monetary policy"]],
  [10, ["cpi", "inflation data", "core pce", "pce price", "nonfarm payroll", "jobs report", "unemployment rate", "gdp report", "ppi"]],
  [9,  ["tariff", "trade war", "government shutdown", "debt ceiling", "credit rating", "recession", "yield curve", "treasury yield"]],
  [7,  ["earnings beat", "earnings miss", "cuts guidance", "raises guidance", "profit warning", "revenue forecast", "quarterly results"]],
  [6,  ["nvidia", "apple", "microsoft", "amazon", "tesla", "meta platforms", "alphabet", "broadcom", "semiconductor", "ai chip", "openai"]],
  [6,  ["opec", "oil price", "crude", "oil output", "output cut", "sanction", "export control", "stimulus", "bank failure", "credit market", "middle east", "supply chain"]],
  [4,  ["fed", "powell", "central bank", "bond yield", "10-year", "hawkish", "dovish"]],
  [3,  ["s&p 500", "nasdaq", "dow jones", "wall street", "stock market", "stocks", "selloff", "rally", "bond market", "dollar index", "gold price", "investor", "futures", "bonds", "yields", "equities", "index fund"]],
];

export const CATEGORIES = [
  { id: "fed",     label: "Fed & Vĩ mô",           match: ["fomc","federal reserve","powell","rate cut","rate hike","cpi","inflation","pce","payroll","jobs report","unemployment","gdp","ppi","treasury yield","yield curve","recession","basis point","fed","fomc minutes","rate decision"] },
  { id: "policy",  label: "Chính sách & Địa chính trị", match: ["tariff","trade war","shutdown","debt ceiling","sanction","white house","congress","regulation","antitrust","election","war","middle east","ukraine","taiwan"] },
  { id: "earnings",label: "Doanh nghiệp & Earnings", match: ["earnings","guidance","results","revenue","profit","ipo","merger","acquisition","buyback","dividend","ceo"] },
  { id: "tech",    label: "Big Tech & AI",          match: ["nvidia","apple","microsoft","amazon","tesla","meta","alphabet","google","broadcom","semiconductor","chip","ai ","artificial intelligence","openai","data center"] },
  { id: "commod",  label: "Hàng hoá & Tiền tệ",     match: ["oil","crude","opec","gold","copper","dollar index","currency","bitcoin","crypto","ether","natural gas"] },
  { id: "markets", label: "Thị trường chung",       match: [] },
];

// Loại thẳng: nội dung không liên quan thị trường lọt vào các feed tổng hợp.
export const BLOCK_TITLE = [
  // Không phải tin thị trường
  "review", "podcast", "print edition", "recipe", "obituary", "crossword",
  "what to watch", "best deals", "gift guide", "horoscope", "photos of the",
  "opinion |", "letters to the editor", "cartoon", "quiz", "puzzle",
  // Clickbait bán lẻ / nội dung syndicated tràn vào feed Yahoo Finance
  "jim cramer", "cramer", "motley fool", "zacks", "insider monkey", "morning download",
  "should you buy", "is it too late to buy", "here's why you should", "millionaire",
  "best stocks to", "top stocks to", "stocks to buy now", "prediction:", "my top",
  "billionaire", "this dividend", "retire", "if you invested",
];

export const BLOCK_URL = [
  "/lifestyle/", "/travel/", "/sports/", "/arts-culture/", "/arts/", "/life-work/",
  "/podcast", "/video/", "/food/", "/style/", "/books/", "/real-estate/", "/personal-finance/",
  "/investingclub/", "/pro/", "/select/", "/make-it/", "/slideshows/",
];
