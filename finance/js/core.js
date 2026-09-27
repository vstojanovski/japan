"use strict";
/* ===================================================================
   Kakeibo — core: utilities, state, categorization, aggregation.
   Data lives in one JSON object (S). In browser-only mode it's kept in
   localStorage; with server.mjs running it is also saved to disk.
   =================================================================== */

const LS_KEY = "kakeibo.v2", LS_OLD = "kakeibo.v1", LS_UI = "kakeibo.ui";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const pad = n => String(n).padStart(2, "0");
const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const TODAY = ymd(new Date());
const CUR_MONTH = TODAY.slice(0, 7);
const CUR_YEAR = TODAY.slice(0, 4);
const sum = a => a.reduce((x, y) => x + y, 0);
const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const round2 = n => Math.round(n * 100) / 100;
const byDesc = f => (a, b) => f(b) - f(a);

function addMonths(ym, k) { let [y, m] = ym.split("-").map(Number); m += k; y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1; return y + "-" + pad(m); }
function monthsBetween(a, b) { const [ay, am] = a.split("-").map(Number), [by, bm] = b.split("-").map(Number); return (by - ay) * 12 + bm - am; }
function monthsIn(from, to) { const o = []; for (let m = from; m <= to; m = addMonths(m, 1)) o.push(m); return o; }
function daysIn(ym) { const [y, m] = ym.split("-").map(Number); return new Date(y, m, 0).getDate(); }
function monthEnd(ym) { return ym + "-" + pad(daysIn(ym)); }
function addDays(s, k) { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + k); return ymd(d); }
function dayDiff(a, b) { return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5); }
function nextMonthSameDay(s) { const ym = addMonths(s.slice(0, 7), 1); return ym + "-" + pad(Math.min(+s.slice(8), daysIn(ym))); }
function monthName(ym, opts = { month: "long", year: "numeric" }) { const [y, m] = ym.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString(undefined, opts); }
const monthShort = ym => monthName(ym, { month: "short" });
const monthShortYear = ym => monthName(ym, { month: "short", year: "numeric" });
function dayName(s, opts = { weekday: "long", month: "long", day: "numeric" }) { return new Date(s + "T12:00:00").toLocaleDateString(undefined, opts); }
const dateShort = s => dayName(s, { month: "short", day: "numeric", year: "numeric" });
const titleCase = s => String(s).replace(/(^|[^\p{L}'’])(\p{L})/gu, (m, a, c) => a + c.toUpperCase());
function hueOf(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }

/* ---------- groups & categories ----------
   kind: income | expense | transfer. Groups only organize and color.
   color: categorical slot 1-8 (see --c1..--c8), 0 = neutral.        */
const DEFAULT_GROUPS = [
  { id: "income", name: "Income", color: 3 },
  { id: "food", name: "Food & Dining", color: 4 },
  { id: "bills", name: "Bills", color: 6 },
  { id: "transport", name: "Transportation", color: 5 },
  { id: "shopping", name: "Shopping", color: 2 },
  { id: "health", name: "Health", color: 0 },
  { id: "travel", name: "Travel", color: 0 },
  { id: "lifestyle", name: "Lifestyle", color: 0 },
  { id: "property", name: "Property", color: 0 },
  { id: "other", name: "Other", color: 0 },
  { id: "transfers", name: "Transfers", color: 0 }
];
const DEFAULT_CATS = [
  ["Paycheck", "💼", "income", "income"], ["Interest & dividends", "🏦", "income", "income"], ["Other income", "💵", "income", "income"],
  ["Groceries", "🛒", "food"], ["Restaurants", "🍜", "food"], ["Coffee", "☕", "food"],
  ["Rent", "🏠", "bills"], ["Utilities", "💡", "bills"], ["Internet & phone", "📶", "bills"], ["Insurance", "🛡️", "bills"], ["Subscriptions", "🔁", "bills"], ["Student loan", "🎓", "bills"],
  ["Auto loan", "🚗", "transport"], ["Gas", "⛽", "transport"], ["Rideshare & transit", "🚆", "transport"], ["Parking & tolls", "🅿️", "transport"], ["Auto maintenance", "🔧", "transport"],
  ["Household", "🧺", "shopping"], ["Clothing", "👕", "shopping"], ["Electronics", "💻", "shopping"],
  ["Medical", "🩺", "health"], ["Pharmacy", "💊", "health"], ["Fitness", "🏋️", "health"],
  ["Flights", "✈️", "travel"], ["Lodging", "🏨", "travel"], ["Travel spending", "🧳", "travel"],
  ["Entertainment", "🎬", "lifestyle"], ["Personal care", "💈", "lifestyle"], ["Gifts & donations", "🎁", "lifestyle"], ["Pets", "🐾", "lifestyle"],
  ["Rental income", "🔑", "property", "income"], ["Mortgage", "🏦", "property"], ["Property tax", "🧾", "property"], ["HOA", "🏘️", "property"],
  ["Repairs & maintenance", "🛠️", "property"], ["Home insurance", "🛡️", "property"], ["Property utilities", "💡", "property"], ["Property management", "📋", "property"],
  ["Fees", "🧾", "other"], ["Cash & ATM", "💴", "other"], ["Uncategorized", "❓", "other"],
  ["Transfer", "🔄", "transfers", "transfer"], ["Credit card payment", "💳", "transfers", "transfer"]
].map(([name, emoji, group, kind]) => ({ name, emoji, group, kind: kind || "expense" }));

// [pattern, category, sign] — sign 1 = only inflows, -1 = only outflows. First match wins.
const BUILTIN = [
  [/autopay|payment.{0,12}thank you|credit c(ar)?r?d pmt|card payment|epay/i, "Credit card payment"],
  [/payroll|salary|direct dep|paycheck|плата|plata|исплата на плата|pension|пензија/i, "Paycheck", 1],
  [/interest (paid|payment|earned)|^interest\b|dividend|камата|kamata|дивиденд/i, "Interest & dividends", 1],
  [/interest charge|late fee|overdraft|service fee|atm fee|foreign transaction|annual fee|monthly fee|провизија|provizija|надоместок|nadomestok|членарина за картичка|одржување на сметка/i, "Fees"],
  [/\batm\b|cash withdrawal|банкомат|bankomat|подигање на готовина|isplata gotov/i, "Cash & ATM"],
  [/transfer|zelle|venmo|cash app|vanguard|fidelity|schwab|robinhood|wealthfront|betterment|пренос|prenos|штедна|stedna|штедење/i, "Transfer"],
  [/mortgage|rocket mtg|mr\.? cooper|loan ?care/i, "Mortgage"],
  [/\bhoa\b|homeowners assoc/i, "HOA"],
  [/\brent\b|apartments/i, "Rent"],
  [/pg&e|electric|\bwater\b|utilit|con ed|duke energy|gas co\b|sewer|ebmud|\bevn\b|евн|струја|водовод|vodovod|топлификација|toplifikacija|\bбег\b|комунална|komunaln|ѓубре/i, "Utilities"],
  [/comcast|xfinity|verizon|at&t|t-mobile|tmobile|spectrum|mint mobile|google fi|телеком|telekom|\ba1\b|а1 македонија|lycamobile/i, "Internet & phone"],
  [/geico|state farm|progressive|allstate|insurance|lemonade|осигурување|osiguruvanje|triglav|триглав|sava osig|eurolink|винер|wiener|halk osig/i, "Insurance"],
  [/nelnet|navient|sallie mae|mohela|student ln|student loan/i, "Student loan"],
  [/toyota fin|honda fin|ally auto|auto (loan|pmt)|car payment/i, "Auto loan"],
  [/wolt|korpa|корпа|ресторан|restoran|пицерија|picerij|скара|кафана|kafana|uber ?eats|doordash|grubhub|postmates|seamless|caviar|sweetgreen|chipotle|restaurant|pizza|sushi|taco|burger|ramen|bistro|grill|kitchen|diner|ichiran|tst\*/i, "Restaurants"],
  [/starbucks|coffee|blue bottle|peet|dunkin|philz|\bcafe\b|\bkafe\b|\bкафе\b|kafeterija|кафетерија/i, "Coffee"],
  [/trader joe|whole foods|safeway|kroger|costco|aldi|grocery|market|wegmans|publix|sprouts|lawson|7-eleven|familymart|\bvero\b|\bверо\b|ramstore|рамстор|tinex|тинекс|\bkam\b|\bкам\b|stokomak|стокомак|reptil|рептил|маркет|супермаркет|пазар|pazar/i, "Groceries"],
  [/\buber\b|\blyft\b|metro|transit|clipper|\bbart\b|\bmta\b|suica|amtrak/i, "Rideshare & transit"],
  [/parking|toll|fastrak|sfmta/i, "Parking & tolls"],
  [/\bshell\b|chevron|exxon|mobil\b|arco|valero|sunoco|citgo|\bbp\b|makpetrol|макпетрол|\bokta\b|\bокта\b|lukoil|лукоил|бензинск|benzinsk|\bпетрол\b/i, "Gas"],
  [/jiffy lube|firestone|midas|auto repair|car wash/i, "Auto maintenance"],
  [/cvs|walgreens|pharmacy|rite aid|аптека|apteka|zegin|зегин|\bфармација|farmacij/i, "Pharmacy"],
  [/dental|doctor|medical|medicine|clinic|hospital|kaiser|urgent care/i, "Medical"],
  [/netflix|spotify|hulu|disney|apple\.com|icloud|youtube|hbo|max\.com|patreon|openai|chatgpt|claude|anthropic|dropbox|notion|adobe|audible|nytimes/i, "Subscriptions"],
  [/equinox|\bgym\b|peloton|classpass|yoga|fitness|crossfit/i, "Fitness"],
  [/airline|airways|delta air|united air|southwest|jetblue|alaska air/i, "Flights"],
  [/airbnb|hotel|marriott|hilton|hyatt|expedia|booking\.com|vrbo/i, "Lodging"],
  [/\bamc\b|cinema|theatre|theater|ticketmaster|stubhub|steam|playstation|xbox|nintendo|concert|museum/i, "Entertainment"],
  [/salon|barber|supercuts|\bspa\b|sephora|ulta/i, "Personal care"],
  [/chewy|petco|petsmart|\bvet\b|veterinary/i, "Pets"],
  [/home depot|lowe'?s|ace hardware/i, "Household"],
  [/uniqlo|zara|nordstrom|gap\b|old navy|h&m/i, "Clothing"],
  [/best buy|apple store|b&h photo/i, "Electronics"],
  [/amazon|amzn|target|walmart|ikea|etsy|bed bath/i, "Household"]
];

const KNOWN_MERCHANTS = [
  [/amazon|amzn/i, "Amazon"], [/trader joe/i, "Trader Joe's"], [/whole ?foods/i, "Whole Foods"], [/\btarget\b/i, "Target"], [/costco/i, "Costco"],
  [/safeway/i, "Safeway"], [/starbucks/i, "Starbucks"], [/blue bottle/i, "Blue Bottle Coffee"], [/peets? coffee/i, "Peet's Coffee"], [/netflix/i, "Netflix"],
  [/spotify/i, "Spotify"], [/apple\.com|icloud/i, "Apple iCloud"], [/uber ?eats/i, "Uber Eats"], [/\buber\b/i, "Uber"], [/\blyft\b/i, "Lyft"],
  [/doordash/i, "DoorDash"], [/chipotle/i, "Chipotle"], [/sweetgreen/i, "Sweetgreen"], [/venmo/i, "Venmo"], [/\bshell\b/i, "Shell"], [/chevron/i, "Chevron"],
  [/walgreens/i, "Walgreens"], [/\bcvs\b/i, "CVS"], [/comcast|xfinity/i, "Xfinity"], [/verizon/i, "Verizon"], [/geico/i, "GEICO"],
  [/claude\.ai|anthropic/i, "Claude"], [/airbnb/i, "Airbnb"], [/home ?depot/i, "Home Depot"], [/best ?buy/i, "Best Buy"], [/\bamc\b/i, "AMC Theatres"],
  [/equinox/i, "Equinox"], [/chewy/i, "Chewy"], [/japan airlines/i, "Japan Airlines"], [/nytimes|ny times/i, "New York Times"], [/pg&e/i, "PG&E"],
  [/rocket mortgage/i, "Rocket Mortgage"], [/mr\.? cooper/i, "Mr. Cooper"], [/nelnet/i, "Nelnet"], [/toyota fin/i, "Toyota Financial"],
  [/chase credit crd|automatic payment/i, "Credit card payment"], [/uniqlo/i, "Uniqlo"], [/ikea/i, "IKEA"], [/fidelity/i, "Fidelity"]
];

function merchantKey(d) {
  let s = String(d || "").toLowerCase();
  s = s.replace(/^(pos |debit card |debit |purchase |checkcard |recurring |sq ?\*|tst ?\*|pp ?\*|paypal ?\*)+/, "");
  s = s.replace(/[#*]?\d[\d\-\/.:]*/g, " ").replace(/[^\p{L}&.' ]+/gu, " ").replace(/\s+/g, " ").trim();
  const k = s.split(" ").filter(w => w.length > 1 || w === "&").slice(0, 3).join(" ");
  return k || String(d || "").toLowerCase().trim();
}
function cleanMerchant(d) {
  for (const [re, n] of KNOWN_MERCHANTS) if (re.test(d)) return n;
  const k = merchantKey(d).replace(/\b(llc|inc|co|direct|dep|deposit|pmt|payment|ach|web|online|purchase|autopay|recurring|des|ppd|id)\b\.?/g, " ").replace(/\s+/g, " ").trim();
  return k ? titleCase(k) : String(d || "Unknown");
}

/* ---------- state ---------- */
let S = null;
let CM = {}, GM = {}, PM = {}, AM = {};   // lookups: category, group, property, account
let RECUR = [];

const UI = {
  month: CUR_MONTH,
  range: { preset: "ytd", from: CUR_YEAR + "-01", to: CUR_MONTH },
  tx: { q: "", tab: "all", type: "", account: "", category: "", tag: "", property: "", limit: 200, sel: new Set() },
  cf: { mode: "groups", view: "sankey", inc: "category", exp: "group", open: {} },
  sp: { mode: "categories", picked: [] },
  nw: { view: "total", account: "", picked: [], open: {} },
  showAllBudget: false
};
function loadUI() {
  try {
    const u = JSON.parse(localStorage.getItem(LS_UI) || "null");
    if (u && u.range && u.range.from && u.range.to && u.range.to <= CUR_MONTH) UI.range = u.range;
    if (u && u.cf) Object.assign(UI.cf, u.cf, { open: {} });
    if (u && u.sp && u.sp.mode) UI.sp.mode = u.sp.mode;
  } catch (e) {}
  let savedView = false; try { savedView = !!(JSON.parse(localStorage.getItem(LS_UI) || "{}").cf || {}).view; } catch (e) {}
  if (!savedView && innerWidth < 640) UI.cf.view = "pl";
  if (UI.range.preset !== "custom") setPreset(UI.range.preset, true);
}
function saveUI() { try { localStorage.setItem(LS_UI, JSON.stringify({ range: UI.range, cf: { mode: UI.cf.mode, view: UI.cf.view, inc: UI.cf.inc, exp: UI.cf.exp }, sp: { mode: UI.sp.mode } })); } catch (e) {} }

const PRESETS = [["month", "This month"], ["3m", "Last 3 months"], ["6m", "Last 6 months"], ["12m", "Last 12 months"], ["ytd", "Year to date"], ["lastyear", "Last year"], ["all", "All time"]];
function setPreset(p, quiet) {
  const r = UI.range; r.preset = p; r.to = CUR_MONTH;
  if (p === "month") r.from = CUR_MONTH;
  else if (p === "3m") r.from = addMonths(CUR_MONTH, -2);
  else if (p === "6m") r.from = addMonths(CUR_MONTH, -5);
  else if (p === "12m") r.from = addMonths(CUR_MONTH, -11);
  else if (p === "ytd") r.from = CUR_YEAR + "-01";
  else if (p === "lastyear") { r.from = (+CUR_YEAR - 1) + "-01"; r.to = (+CUR_YEAR - 1) + "-12"; }
  else if (p === "all") r.from = S ? firstMonth() : addMonths(CUR_MONTH, -23);
  if (!quiet) saveUI();
}
function shiftRange(d) {
  const r = UI.range, len = monthsBetween(r.from, r.to) + 1;
  let from = addMonths(r.from, d * len), to = addMonths(r.to, d * len);
  if (to > CUR_MONTH) { to = CUR_MONTH; from = addMonths(CUR_MONTH, -(len - 1)); }
  r.from = from; r.to = to; r.preset = "custom"; saveUI();
}
function rangeLabel(r = UI.range) { return r.from === r.to ? monthName(r.from) : `${monthShortYear(r.from)} – ${monthShortYear(r.to)}`; }
function rangeMonths(r = UI.range) { const fm = firstMonth(); return monthsIn(r.from < fm ? fm : r.from, r.to); }

function readLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY); if (raw) return normalize(JSON.parse(raw));
    const old = localStorage.getItem(LS_OLD); if (old) { const o = JSON.parse(old); if (!o.settings || !o.settings.demo) return migrateV1(o); }
  } catch (e) {}
  return null;
}
let saveWarned = false;
function saveLocal() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); }
  catch (e) { if (!saveWarned && !SERVER) { saveWarned = true; toast("This browser isn't letting the page save. Changes last until you close the tab."); } }
}
function normalize(st) {
  st.version = 2;
  st.accounts ||= []; st.transactions ||= []; st.properties ||= [];
  st.groups ||= DEFAULT_GROUPS.map(g => ({ ...g }));
  st.categories ||= DEFAULT_CATS.map(c => ({ ...c }));
  st.budgets ||= {}; st.rules ||= []; st.notes ||= {}; st.hiddenRecurring ||= {}; st.sync ||= {};
  st.settings = Object.assign({ currency: "USD", savingsGoal: 0, demo: false }, st.settings || {});
  for (const g of DEFAULT_GROUPS) if (["income", "other", "transfers", "property"].includes(g.id) && !st.groups.some(x => x.id === g.id)) st.groups.push({ ...g });
  if (!st.categories.some(c => c.name === "Uncategorized")) st.categories.push({ name: "Uncategorized", emoji: "❓", group: "other", kind: "expense" });
  for (const t of st.transactions) { if (!t.merchant) t.merchant = cleanMerchant(t.desc); }
  return st;
}
function migrateV1(o) {
  const groups = DEFAULT_GROUPS.map(g => ({ ...g })), cats = [];
  for (const c of o.categories || []) {
    let g = groups.find(x => x.name === c.group);
    if (!g) { g = { id: uid(), name: c.group, color: 0 }; groups.push(g); }
    cats.push({ name: c.name, emoji: c.emoji, group: g.id, kind: c.group === "Income" ? "income" : c.group === "Transfers" ? "transfer" : "expense" });
  }
  return normalize({ ...o, groups, categories: cats });
}
function emptyState() { return normalize({}); }

/* ---------- formatting ---------- */
let NF, NF0, NFC;
function setFormatters() {
  const c = S.settings.currency || "USD";
  try {
    NF = new Intl.NumberFormat(undefined, { style: "currency", currency: c });
    NF0 = new Intl.NumberFormat(undefined, { style: "currency", currency: c, maximumFractionDigits: 0, minimumFractionDigits: 0 });
    NFC = new Intl.NumberFormat(undefined, { style: "currency", currency: c, notation: "compact", maximumFractionDigits: 1 });
  } catch (e) { S.settings.currency = "USD"; setFormatters(); }
}
const money = (n, cents) => (cents ? NF : NF0).format(Math.abs(n) < 0.005 ? 0 : n);
const moneyC = n => NFC.format(n);
const signed = (n, cents = true) => (n > 0 ? "+" : n < 0 ? "−" : "") + (cents ? NF : NF0).format(Math.abs(n));
const minus = (n, cents = true) => (n < -0.004 ? "−" : "") + (cents ? NF : NF0).format(Math.abs(n));
const pct = (n, d = 0) => (isFinite(n) ? (n * 100).toFixed(d) : "0") + "%";

/* ---------- lookups ---------- */
function rebuild() {
  CM = {}; for (const c of S.categories) CM[c.name] = c;
  GM = {}; for (const g of S.groups) GM[g.id] = g;
  PM = {}; for (const p of S.properties) PM[p.id] = p;
  AM = {}; for (const a of S.accounts) AM[a.id] = a;
  invalidate();
  RECUR = detectRecurring();
}
const catOf = name => CM[name] || CM.Uncategorized || { name: "Uncategorized", emoji: "❓", group: "other", kind: "expense" };
const kindOf = name => catOf(name).kind;
const groupOf = name => GM[catOf(name).group] || { id: "other", name: "Other", color: 0 };
const acctName = id => (AM[id] || { name: "—" }).name;
const colorVar = slot => slot ? `var(--c${slot})` : "var(--c0)";
function firstMonth() { let m = CUR_MONTH; for (const t of S.transactions) if (t.date.slice(0, 7) < m) m = t.date.slice(0, 7); return m; }
const needsReview = () => S.transactions.filter(t => t.needsReview && !t.hidden).length;
const uncategorizedCount = () => S.transactions.filter(t => !t.hidden && linesOf(t).some(l => l.category === "Uncategorized")).length;
const linesOf = t => (t.splits && t.splits.length ? t.splits : [t]);
const isSplit = t => !!(t.splits && t.splits.length);

/* key -> display info for summarize() output keys.
   Keys are category names, group ids, "prop:<id>" or "prop:<id>|<category>". */
function keyInfo(key, kind) {
  if (key.startsWith("prop:")) {
    const [pk, cn] = key.split("|"), p = PM[pk.slice(5)];
    const pname = p ? p.name : "Property", color = p ? p.color : 0;
    if (cn) { const c = catOf(cn); return { name: c.name, emoji: c.emoji, sub: pname, color }; }
    return { name: pname, emoji: "🏠", sub: "Property", color, href: p ? "#property-" + p.id : null, prop: true };
  }
  if (kind === "group") { const g = GM[key] || { name: key, color: 0 }; return { name: g.name, color: g.color }; }
  if (kind === "merchant") return { name: key, color: null };
  const c = catOf(key), g = GM[c.group] || { name: "Other", color: 0 };
  return { name: c.name, emoji: c.emoji, sub: g.name, color: c.kind === "income" ? 3 : g.color };
}

/* ---------- aggregation ----------
   summarize(from, to)            → the household view: each property collapses
                                    into one line (its net cash flow).
   summarize(from, to, propId)    → one property's own books.            */
let SUM_CACHE = new Map();
function summarize(from, to, propId) {
  const k = from + "|" + to + "|" + (propId || "");
  if (!SUM_CACHE.has(k)) SUM_CACHE.set(k, summarizeRaw(from, to, propId));
  return SUM_CACHE.get(k);
}
function summarizeRaw(from, to, propId) {
  const R = { income: 0, expense: 0, inc: {}, incMer: {}, grp: {}, cat: {}, mer: {}, merGrp: {}, months: {}, count: 0 };
  const props = {};
  const addMonth = (ym, k, v) => { const m = R.months[ym] || (R.months[ym] = { income: 0, expense: 0 }); m[k] += v; };
  for (const t of S.transactions) {
    if (t.hidden) continue;
    const ym = t.date.slice(0, 7); if (ym < from || ym > to) continue;
    if (propId != null && t.property !== propId) continue;
    const collapse = propId == null && t.property && PM[t.property];
    let counted = false;
    for (const l of linesOf(t)) {
      const c = catOf(l.category); if (c.kind === "transfer") continue;
      if (collapse) {
        const p = props[t.property] || (props[t.property] = { net: 0, months: {}, cats: {}, mer: {} });
        p.net += l.amount; p.months[ym] = (p.months[ym] || 0) + l.amount;
        if (c.kind !== "income") { p.cats[c.name] = (p.cats[c.name] || 0) - l.amount; p.mer[t.merchant] = (p.mer[t.merchant] || 0) - l.amount; }
        continue;
      }
      if (c.kind === "income") {
        R.income += l.amount; R.inc[c.name] = (R.inc[c.name] || 0) + l.amount;
        R.incMer[t.merchant] = (R.incMer[t.merchant] || 0) + l.amount; addMonth(ym, "income", l.amount);
      } else {
        const v = -l.amount;
        R.expense += v; R.grp[c.group] = (R.grp[c.group] || 0) + v; R.cat[c.name] = (R.cat[c.name] || 0) + v;
        R.mer[t.merchant] = (R.mer[t.merchant] || 0) + v; R.merGrp[t.merchant] ||= c.group; addMonth(ym, "expense", v);
        if (!counted && v > 0) { R.count++; counted = true; }
      }
    }
  }
  for (const [pid, p] of Object.entries(props)) {
    const key = "prop:" + pid;
    if (p.net >= 0) {
      R.income += p.net; R.inc[key] = p.net; R.incMer[PM[pid].name] = (R.incMer[PM[pid].name] || 0) + p.net;
      for (const [ym, v] of Object.entries(p.months)) addMonth(ym, "income", v);
    } else {
      R.expense += -p.net; R.grp[key] = -p.net;
      for (const [ym, v] of Object.entries(p.months)) addMonth(ym, "expense", -v);
      // The property's own categories, scaled so they add up to its net loss (rent offsets costs).
      const gross = sum(Object.values(p.cats).filter(v => v > 0)), f = gross > 0 ? -p.net / gross : 0;
      for (const [cn, v] of Object.entries(p.cats)) if (v > 0) R.cat[key + "|" + cn] = v * f;
      for (const [m, v] of Object.entries(p.mer)) if (v > 0) { R.mer[m] = (R.mer[m] || 0) + v * f; R.merGrp[m] ||= key; }
    }
  }
  R.props = props;
  return R;
}
const catGroupKey = key => key.startsWith("prop:") ? key.split("|")[0] : catOf(key).group;
function ranked(obj, kind, limit) {
  let rows = Object.entries(obj).filter(([, v]) => Math.abs(v) >= 0.005).map(([key, v]) => ({ key, v, ...keyInfo(key, kind) })).sort(byDesc(r => r.v));
  if (limit && rows.length > limit) {
    const rest = rows.slice(limit - 1);
    rows = rows.slice(0, limit - 1).concat([{ key: "__other", v: sum(rest.map(r => r.v)), name: `Other (${rest.length})`, color: 0, other: true }]);
  }
  return rows;
}
function avgCat(cat, ym, n = 3) {
  const fm = firstMonth(), vals = [];
  for (let k = 1; k <= n; k++) { const m = addMonths(ym, -k); if (m < fm) break; vals.push(summarize(m, m).cat[cat] || 0); }
  return vals.length ? sum(vals) / vals.length : null;
}

/* ---------- accounts & net worth ---------- */
const ACCT_TYPES = { checking: "Checking", savings: "Savings", credit: "Credit card", investment: "Investment", retirement: "Retirement", property: "Real estate", vehicle: "Vehicle", cash: "Cash", loan: "Loan", other: "Other" };
const ACCT_EMOJI = { checking: "🏦", savings: "🐷", credit: "💳", investment: "📈", retirement: "🌱", property: "🏡", vehicle: "🚙", cash: "💴", loan: "🧾", other: "📁" };
const TYPE_GROUPS = [
  { id: "cash", name: "Cash", types: ["checking", "savings", "cash"], color: 3 },
  { id: "investments", name: "Investments", types: ["investment"], color: 4 },
  { id: "retirement", name: "Retirement", types: ["retirement"], color: 2 },
  { id: "realestate", name: "Real estate", types: ["property"], color: 1 },
  { id: "vehicles", name: "Vehicles", types: ["vehicle"], color: 5 },
  { id: "otherassets", name: "Other assets", types: ["other"], color: 0 },
  { id: "credit", name: "Credit cards", types: ["credit"], color: 8, liability: true },
  { id: "loans", name: "Loans", types: ["loan"], color: 7, liability: true }
];
const typeGroupOf = a => TYPE_GROUPS.find(g => g.types.includes(a.type)) || TYPE_GROUPS[5];
const isLiability = a => a.type === "credit" || a.type === "loan";
const MANUAL_TYPES = ["investment", "retirement", "property", "vehicle", "loan", "other"];

let TX_BY_ACCT = null;
function txByAcct() {
  if (TX_BY_ACCT) return TX_BY_ACCT;
  TX_BY_ACCT = {};
  for (const t of S.transactions) (TX_BY_ACCT[t.account] ||= []).push(t);
  for (const k in TX_BY_ACCT) TX_BY_ACCT[k].sort((a, b) => a.date < b.date ? 1 : -1);
  return TX_BY_ACCT;
}
function balanceAt(a, date) {
  if (date >= TODAY) return a.balance;
  if (a.snapshots && a.snapshots.length) {
    let b = null, first = null;
    for (const s of a.snapshots) { if (!first || s.date < first.date) first = s; if (s.date <= date && (!b || s.date > b.date)) b = s; }
    return (b || first).balance;
  }
  let b = a.balance;
  for (const t of txByAcct()[a.id] || []) { if (t.date <= date) break; b -= t.amount; }
  return b;
}
function balanceSeries(accts, months) {
  return months.map(ym => { const date = ym >= CUR_MONTH ? TODAY : monthEnd(ym); return sum(accts.map(a => balanceAt(a, date))); });
}
const netWorth = () => sum(S.accounts.map(a => a.balance));

/* Loan payoff: months left at the current payment, from the standard amortization formula. */
function loanPayoff(a) {
  const L = a.loan || {}, B = Math.abs(a.balance), P = +L.payment || 0, r = (+L.rate || 0) / 1200;
  if (!B) return { months: 0 };
  if (!P) return null;
  if (!r) return { months: Math.ceil(B / P) };
  if (P <= B * r) return { never: true };
  return { months: Math.ceil(-Math.log(1 - r * B / P) / Math.log(1 + r)) };
}

/* ---------- recurring ---------- */
const FREQS = [
  { id: "weekly", min: 6, max: 8, days: 7, label: "Weekly", perMonth: 52 / 12 },
  { id: "biweekly", min: 12, max: 17, days: 14, label: "Every 2 weeks", perMonth: 26 / 12 },
  { id: "monthly", min: 26, max: 35, days: 30, label: "Monthly", perMonth: 1 },
  { id: "quarterly", min: 80, max: 100, days: 91, label: "Quarterly", perMonth: 1 / 3 },
  { id: "semiannual", min: 170, max: 195, days: 182, label: "Twice a year", perMonth: 1 / 6 },
  { id: "yearly", min: 350, max: 380, days: 365, label: "Yearly", perMonth: 1 / 12 }
];
const TWICE_MONTHLY = { id: "twice", min: 12, max: 17, days: 15, label: "Twice a month", perMonth: 2 };
function detectRecurring() {
  const groups = {};
  for (const t of S.transactions) {
    if (t.hidden || kindOf(t.category) === "transfer") continue;
    const k = (t.merchant || merchantKey(t.desc)).toLowerCase() + "|" + (t.amount < 0 ? "-" : "+");
    (groups[k] ||= []).push(t);
  }
  const out = [];
  for (const [key, list] of Object.entries(groups)) {
    if (list.length < 3 || S.hiddenRecurring[key]) continue;
    list.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    const diffs = []; for (let i = 1; i < list.length; i++) diffs.push(dayDiff(list[i - 1].date, list[i].date));
    const md = median(diffs);
    let f = FREQS.find(x => md >= x.min && md <= x.max);
    if (!f) continue;
    if (diffs.filter(d => Math.abs(d - md) <= Math.max(3, md * 0.25)).length / diffs.length < 0.7) continue;
    const amts = list.map(t => Math.abs(t.amount)), ma = median(amts);
    if (amts.filter(a => Math.abs(a - ma) <= ma * 0.45).length / amts.length < 0.7) continue;
    const last = list[list.length - 1];
    if (dayDiff(last.date, TODAY) > f.days * 2 + 5) continue;
    // Paid on the same two days each month (e.g. the 1st and 15th) reads as twice a month, not every two weeks.
    if (f.id === "biweekly" && new Set(list.slice(-8).map(t => t.date.slice(8))).size <= 2) f = TWICE_MONTHLY;
    let next = f.id === "monthly" ? nextMonthSameDay(last.date) : addDays(last.date, Math.round(md));
    if (f.id === "twice") {
      const days = [...new Set(list.slice(-8).map(t => +t.date.slice(8)))].sort((a, b) => a - b), ym = last.date.slice(0, 7), d = +last.date.slice(8);
      const later = days.find(x => x > d);
      next = later ? ym + "-" + pad(Math.min(later, daysIn(ym))) : addMonths(ym, 1) + "-" + pad(days[0]);
    }
    const sign = last.amount < 0 ? -1 : 1;
    out.push({ key, name: last.merchant || titleCase(merchantKey(last.desc)), category: last.category, property: last.property, freq: f, amount: sign * ma,
      last: last.date, next, monthly: sign * ma * f.perMonth, count: list.length });
  }
  return out.sort((a, b) => a.next < b.next ? -1 : 1);
}

/* ---------- categorization ---------- */
function ruleFor(desc) { const k = merchantKey(desc); return S.rules.find(r => r.key === k); }
function categorize(desc, amount) {
  const r = ruleFor(desc);
  if (r && CM[r.category]) return r.category;
  for (const [re, cat, sign] of BUILTIN) {
    if (sign && (sign > 0) !== (amount > 0)) continue;
    if (re.test(desc) && CM[cat]) return cat;
  }
  return amount > 0 && CM["Other income"] ? "Other income" : "Uncategorized";
}
function newTx(fields) {
  const t = { id: uid(), merchant: cleanMerchant(fields.desc), ...fields };
  if (!t.category) t.category = categorize(t.desc, t.amount);
  const r = ruleFor(t.desc);
  if (r && r.property && PM[r.property] && !t.property) t.property = r.property;
  return t;
}
function invalidate() { TX_BY_ACCT = null; SUM_CACHE = new Map(); }
