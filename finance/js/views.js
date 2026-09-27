"use strict";
/* ===================================================================
   Views. Each takes the #view element and fills it.
   =================================================================== */
const ICONS = {
  overview: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  transactions: '<path d="M7 3h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 0 1 2-2z"/><path d="M9 8h6M9 12h6"/>',
  cashflow: '<path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/>',
  spending: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/>',
  networth: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  budget: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  recurring: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  accounts: '<path d="M3 21h18M5 21V10M19 21V10M9 21v-7M15 21v-7M2 10l10-6 10 6"/>',
  loans: '<path d="M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/>',
  uncategorized: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  property: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'
};
const icon = (k, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;
const ROUTES = [
  ["overview", "Overview"], ["transactions", "Transactions"], ["cashflow", "Cash flow"], ["spending", "Spending"], ["networth", "Net worth"],
  ["budget", "Budget"], ["recurring", "Recurring"], ["accounts", "Accounts"], ["loans", "Loans"], ["uncategorized", "Uncategorized"], ["settings", "Settings & sync"]
];
function route() {
  const h = location.hash.replace(/^#\/?/, "");
  if (h.startsWith("property-")) return { id: "property", arg: h.slice(9) };
  return { id: ROUTES.some(r => r[0] === h) ? h : "overview" };
}
const badge = n => n ? `<span class="badge">${n > 99 ? "99+" : n}</span>` : "";

function renderNav() {
  const cur = route(), nr = needsReview(), unc = uncategorizedCount();
  const link = (id, label, b) => `<a href="#${id}" ${cur.id === id ? 'aria-current="page"' : ""}>${icon(id)}<span>${label}</span>${b || ""}</a>`;
  $("#nav").innerHTML = ROUTES.filter(r => r[0] !== "settings").map(([id, label]) => link(id, label, id === "transactions" ? badge(nr) : id === "uncategorized" ? badge(unc) : "")).join("") +
    `<div class="nav-h">Properties</div>` +
    S.properties.map(p => `<a href="#property-${p.id}" ${cur.id === "property" && cur.arg === p.id ? 'aria-current="page"' : ""}>${icon("property")}<span>${esc(p.name)}</span></a>`).join("") +
    `<button class="nav-add" data-act="new-prop">+ Add property</button>`;
  $("#navfoot").innerHTML = link("settings", "Settings & sync");
  const tab = (id, label, b) => `<a href="#${id}" ${cur.id === id ? 'aria-current="page"' : ""}>${icon(id)}<span>${label}</span>${b || ""}</a>`;
  const inMore = !["transactions", "cashflow", "spending", "networth"].includes(cur.id);
  $("#tabbar").innerHTML = tab("transactions", "Transactions", badge(nr)) + tab("cashflow", "Cash flow") + tab("spending", "Spending") + tab("networth", "Net worth") +
    `<button data-act="more" ${inMore ? 'aria-current="page"' : ""}>${icon("more")}<span>More</span>${badge(unc)}</button>`;
}

function rangeCtl() {
  const r = UI.range;
  return `<div class="rangectl"><button class="iconbtn" data-act="range-shift" data-d="-1" aria-label="Earlier period">‹</button><span class="rl">${esc(rangeLabel())}</span><button class="iconbtn" data-act="range-shift" data-d="1" aria-label="Later period" ${r.to >= CUR_MONTH ? "disabled" : ""}>›</button></div>
  <label class="preset">${icon("cal")}<select id="preset" data-change="preset" aria-label="Date range">${PRESETS.map(([k, v]) => `<option value="${k}" ${r.preset === k ? "selected" : ""}>${v}</option>`).join("")}${r.preset === "custom" ? '<option value="custom" selected>Custom</option>' : ""}</select></label>`;
}
function monthNav() {
  const ym = UI.month;
  return `<div class="rangectl"><button class="iconbtn" data-act="month" data-d="-1" aria-label="Previous month">‹</button><span class="rl">${esc(monthName(ym))}</span><button class="iconbtn" data-act="month" data-d="1" aria-label="Next month" ${ym >= CUR_MONTH ? "disabled" : ""}>›</button></div>`;
}
function syncLine() {
  const parts = [];
  if (S.sync.lastSync) parts.push(`Banks synced ${new Date(S.sync.lastSync).toLocaleString()}`);
  parts.push(SERVER ? "Saved to your server" : "Saved in this browser");
  return parts.join(" · ");
}
function syncBtn() {
  if (SERVER && SERVER.simplefin) return `<button class="btn" data-act="sync" id="syncbtn">Sync banks</button>`;
  return `<button class="btn" data-act="import">Import CSV</button>`;
}
function sampleBanner() {
  if (!S.settings.demo) return "";
  return `<div class="banner"><p><b>You're looking at a sample household.</b> Connect your banks or import a CSV to see your own numbers. The sample clears as soon as your data comes in.</p>
    <div class="acts"><a class="btn brand small" href="#settings">Connect banks</a><button class="btn small" data-act="import">Import CSV</button><button class="btn small ghost" data-act="clear-demo">Start empty</button></div></div>`;
}
function pageHead(title, o = {}) {
  return `${sampleBanner()}<div class="ph"><div class="ph-t"><h1>${title}</h1><div class="syncline">${o.sub || syncLine()}</div></div>
    <div class="ph-a">${o.month ? monthNav() : o.range === false ? "" : rangeCtl()}${o.actions || ""}${o.noSync ? "" : syncBtn()}</div></div>`;
}
function seg(act, options, cur, label) {
  return `<div class="seg" role="group" aria-label="${esc(label || "")}">${options.map(([k, v]) => `<button data-act="${act}" data-v="${k}" aria-pressed="${k === cur}">${v}</button>`).join("")}</div>`;
}
const tile = (label, value, extra = "", o = {}) => `<section class="card tile ${o.cls || ""}"><div class="lbl">${o.dot ? `<span class="dot" style="background:${o.dot}"></span>` : ""}${label}</div><div class="val" ${o.style ? `style="${o.style}"` : ""}>${value}</div>${extra ? `<div class="tile-x">${extra}</div>` : ""}</section>`;
function deltaHtml(v, goodWhenUp, fmt, suffix) {
  if (v == null || !isFinite(v)) return "";
  const flat = Math.abs(v) < 0.5, cls = flat ? "flat" : (v > 0) === goodWhenUp ? "up" : "down";
  return `<span class="delta ${cls}">${flat ? "→" : v > 0 ? "▲" : "▼"} ${esc(fmt(Math.abs(v)))} ${esc(suffix)}</span>`;
}
const avatar = name => `<span class="av" style="--h:${hueOf(name)}" aria-hidden="true">${esc((String(name).match(/[A-Za-z0-9]/) || ["?"])[0].toUpperCase())}</span>`;

let VIEW_W = 0;
function render() {
  rebuild(); renderNav(); hideTip();
  const r = route(), el = $("#view");
  document.body.dataset.route = r.id;
  (VIEWS[r.id] || VIEWS.overview)(el, r.arg);
  LAST_ROUTE = r.id;
  VIEW_W = el.clientWidth;
  const t = { property: (PM[r.arg] || {}).name }[r.id] || (ROUTES.find(x => x[0] === r.id) || ["", "Overview"])[1];
  document.title = `${t} · Kakeibo`;
}

/* ---------- budget helpers ---------- */
const budgetCats = () => S.categories.filter(c => c.kind === "expense" && c.group !== "property");
function budgetTotals(ym) {
  const R = summarize(ym, ym); let budget = 0, spent = 0;
  for (const c of budgetCats()) { const b = S.budgets[c.name]; if (!b) continue; budget += b; spent += R.cat[c.name] || 0; }
  return { budget, spent };
}
function meterHtml(spent, budget) {
  const r = budget > 0 ? spent / budget : 0, cls = spent - budget >= 1 ? "over" : r >= 0.9 && budget - spent >= 1 ? "warn" : "";
  return `<div class="meter ${cls}" role="meter" aria-valuemin="0" aria-valuemax="${Math.round(budget)}" aria-valuenow="${Math.round(spent)}"><b style="width:${Math.min(100, Math.max(0, r * 100))}%"></b></div>`;
}
function budgetPill(spent, budget) {
  const left = budget - spent;
  if (Math.abs(left) < 1) return `<span class="pill good">✓ On budget</span>`;
  if (spent > budget) return `<span class="pill over">▲ ${esc(money(-left))} over</span>`;
  if (budget > 0 && spent / budget >= 0.9) return `<span class="pill warn">● ${esc(money(left))} left</span>`;
  return `<span class="pill ok">${esc(money(left))} left</span>`;
}
function txLine(t, showDate) {
  const c = catOf(t.category);
  return `<div class="li" data-act="edit-tx" data-id="${t.id}" role="button" tabindex="0">${avatar(t.merchant)}
    <div class="li-m"><div class="t">${esc(t.merchant)}</div><div class="s">${isSplit(t) ? "Split" : esc(c.name)} · ${showDate ? esc(dayName(t.date, { month: "short", day: "numeric" })) : esc(acctName(t.account))}</div></div>
    <div class="amt ${t.amount > 0 ? "pos" : ""}">${esc(signed(t.amount))}</div></div>`;
}

/* ---------- takeaways (computed locally) ---------- */
const FLEX_GROUPS = g => !["bills", "property", "income", "transfers"].includes(g);
function insights(ym) {
  const out = [], R = summarize(ym, ym), isCur = ym === CUR_MONTH;
  const frac = isCur ? (+TODAY.slice(8)) / daysIn(ym) : 1;
  if (!S.transactions.length) return out;
  if (isCur && frac < 1) {
    let flex = 0, fixed = 0;
    for (const [k, v] of Object.entries(R.cat)) { if (FLEX_GROUPS(catGroupKey(k))) flex += v; else fixed += v; }
    out.push(["nt", "→", `At this pace you'll spend about <b>${esc(money(fixed + flex / Math.max(frac, 0.05)))}</b> this month (${esc(money(R.expense))} so far).`]);
  }
  const moves = [];
  for (const c of budgetCats()) {
    if (!FLEX_GROUPS(c.group)) continue;
    const avg = avgCat(c.name, ym); if (avg == null) continue;
    const d = (R.cat[c.name] || 0) - avg * frac;
    if (Math.abs(d) >= 60) moves.push({ c, d });
  }
  moves.sort(byDesc(m => Math.abs(m.d)));
  for (const mv of moves.slice(0, 2)) out.push([mv.d > 0 ? "up" : "dn", mv.d > 0 ? "▲" : "▼", `${esc(mv.c.name)} is <b>${esc(money(Math.abs(mv.d)))} ${mv.d > 0 ? "above" : "below"}</b> your 3-month average${isCur ? " for this point in the month" : ""}.`]);
  const over = budgetCats().filter(c => S.budgets[c.name] > 0 && (R.cat[c.name] || 0) - S.budgets[c.name] >= 1);
  if (over.length) out.push(["up", "!", `${over.length} ${over.length === 1 ? "category is" : "categories are"} over budget: ${over.slice(0, 3).map(c => esc(c.name)).join(", ")}${over.length > 3 ? "…" : ""}.`]);
  for (const [pid, p] of Object.entries(R.props)) if (PM[pid]) out.push([p.net >= 0 ? "dn" : "nt", "⌂", `${esc(PM[pid].name)} ${p.net >= 0 ? "cash-flowed" : "cost"} <b>${esc(money(Math.abs(p.net)))}</b> this month.`]);
  const subs = RECUR.filter(r => r.amount < 0 && r.category === "Subscriptions");
  if (subs.length) out.push(["nt", "↻", `Subscriptions cost <b>${esc(money(-sum(subs.map(s => s.monthly)), true))}</b> a month across ${subs.length} services.`]);
  const net = R.income - R.expense, goal = S.settings.savingsGoal;
  if (!isCur && goal > 0) out.push([net >= goal ? "dn" : "up", net >= goal ? "✓" : "✗", net >= goal ? `You beat your savings goal by ${esc(money(net - goal))}.` : `You saved ${esc(money(net))}, ${esc(money(goal - net))} short of your ${esc(money(goal))} goal.`]);
  return out;
}

const VIEWS = {};

/* ---------------- Overview ---------------- */
VIEWS.overview = el => {
  const ym = UI.month, R = summarize(ym, ym), prev = summarize(addMonths(ym, -1), addMonths(ym, -1)), net = R.income - R.expense;
  const nwMonths = monthsIn(addMonths(CUR_MONTH, -11), CUR_MONTH), nw = balanceSeries(S.accounts, nwMonths);
  const bt = budgetTotals(ym), goal = S.settings.savingsGoal;
  const pm = [1, 2, 3].map(k => addMonths(ym, -k)).filter(m => m >= firstMonth());
  const avg3 = pm.length ? sum(pm.map(m => summarize(m, m).expense)) / pm.length : null;
  const cfRows = monthsIn(addMonths(ym, -5), ym).map(m => ({ ym: m, income: summarize(m, m).income, expense: summarize(m, m).expense }));
  const upcoming = RECUR.filter(r => r.next >= TODAY && dayDiff(TODAY, r.next) <= 31).slice(0, 6);
  const recent = S.transactions.filter(t => !t.hidden).sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 7);
  const topBudget = budgetCats().filter(c => S.budgets[c.name] > 0 && FLEX_GROUPS(c.group)).map(c => ({ c, b: S.budgets[c.name], s: R.cat[c.name] || 0 })).sort(byDesc(r => r.s / r.b)).slice(0, 5);
  const ins = insights(ym);
  el.innerHTML = pageHead(ym === CUR_MONTH ? "This month" : esc(monthName(ym)), { month: true }) + `
  <div class="grid">
    <section class="card c8">
      <div class="lbl">Net worth</div><div class="hero">${esc(money(nw[nw.length - 1]))}</div>
      <div class="row-flex">${deltaHtml(nw[nw.length - 1] - nw[nw.length - 2], true, v => money(v), "since last month")}${deltaHtml(nw[nw.length - 1] - nw[0], true, v => money(v), "over 12 months")}</div>
      <div class="chart" id="ovNw"></div>
    </section>
    <section class="card c4 tiles-stack">
      <div><div class="lbl">Income</div><div class="val">${esc(money(R.income))}</div>${deltaHtml(R.income - prev.income, true, v => money(v), "vs last month")}</div>
      <div><div class="lbl">Spending</div><div class="val">${esc(money(R.expense))}</div>${avg3 != null ? deltaHtml(R.expense - avg3, false, v => money(v), "vs 3-mo avg") : ""}</div>
      <div><div class="lbl">Saved</div><div class="val" style="${net < 0 ? "color:var(--bad-text)" : ""}">${esc(minus(net, false))}</div><span class="small muted">${R.income > 0 ? pct(net / R.income) + " of income" : "No income recorded"}${goal > 0 ? " · goal " + esc(money(goal)) : ""}</span></div>
    </section>
    <section class="card c7">
      <div class="ch"><h2>Cash flow</h2><span class="sub">last 6 months</span><span class="sp"></span><a class="linkbtn" href="#cashflow">Details</a></div>
      <div class="legend"><span><i style="background:var(--c1)"></i>Income</span><span><i style="background:var(--c2)"></i>Spending</span></div>
      <div class="chart" id="ovCf"></div>
    </section>
    <section class="card c5">
      <div class="ch"><h2>Budget</h2><span class="sp"></span><a class="linkbtn" href="#budget">Edit</a></div>
      ${bt.budget > 0 ? `<div class="bt-top"><span><b class="big">${esc(money(bt.spent))}</b> <span class="muted">of ${esc(money(bt.budget))}</span></span>${budgetPill(bt.spent, bt.budget)}</div>${meterHtml(bt.spent, bt.budget)}
      <div class="bt-list">${topBudget.map(r => `<div><div class="bt-row"><span>${esc(r.c.emoji)} ${esc(r.c.name)}</span><span class="num muted">${esc(money(r.s))} / ${esc(money(r.b))}</span></div>${meterHtml(r.s, r.b)}</div>`).join("")}</div>`
      : `<div class="empty small">No budgets yet. <a href="#budget">Set one up</a>.</div>`}
    </section>
    <section class="card c7">
      <div class="ch"><h2>Where it went</h2><span class="sub">${esc(monthName(ym))}</span><span class="sp"></span><a class="linkbtn" href="#spending">Spending</a></div>
      ${rankList(ranked(R.grp, "group", 8), R.expense)}
    </section>
    <section class="card c5">
      <div class="ch"><h2>Takeaways</h2><span class="sp"></span><button class="linkbtn" data-act="summary">Copy summary for Claude</button></div>
      ${ins.length ? `<ul class="ins">${ins.map(([cls, ic, txt]) => `<li><span class="ic2 ${cls}" aria-hidden="true">${ic}</span><span>${txt}</span></li>`).join("")}</ul>` : `<div class="empty small">Add a few weeks of transactions to see trends.</div>`}
    </section>
    <section class="card c6">
      <div class="ch"><h2>Coming up</h2><span class="sub">next 30 days</span><span class="sp"></span><a class="linkbtn" href="#recurring">Recurring</a></div>
      ${upcoming.length ? `<div class="list">${upcoming.map(r => `<div class="li">${avatar(r.name)}<div class="li-m"><div class="t">${esc(r.name)}</div><div class="s">${esc(dayName(r.next, { weekday: "short", month: "short", day: "numeric" }))} · ${esc(r.freq.label)}</div></div><div class="amt ${r.amount > 0 ? "pos" : ""}">${esc(signed(r.amount))}</div></div>`).join("")}</div>` : `<div class="empty small">No recurring charges found yet.</div>`}
    </section>
    <section class="card c6">
      <div class="ch"><h2>Recent transactions</h2><span class="sp"></span><a class="linkbtn" href="#transactions">See all</a></div>
      ${recent.length ? `<div class="list">${recent.map(t => txLine(t, true)).join("")}</div>` : `<div class="empty small">No transactions yet.</div>`}
    </section>
  </div>`;
  lineChart($("#ovNw"), nwMonths.map(m => ({ label: monthShort(m), title: m === CUR_MONTH ? "Today" : monthName(m) })), [{ name: "Net worth", color: "var(--c1)", values: nw }], { h: 190, label: "Net worth over 12 months" });
  cashChart($("#ovCf"), cfRows, { h: 200, selected: ym, onPick: m => { UI.month = m; render(); } });
};

/* ---------------- Transactions ---------------- */
const TX_TABS = [["all", "All"], ["review", "Needs review"], ["uncategorized", "Uncategorized"], ["split", "Split"], ["hidden", "Hidden"]];
VIEWS.transactions = (el, arg, title) => {
  const f = UI.tx;
  const tags = [...new Set(S.transactions.flatMap(t => t.tags || []))].sort();
  el.innerHTML = pageHead(title || "Transactions", { actions: `<button class="btn brand" data-act="new-tx">+ Add transaction</button>` }) + `
  <section class="card txcard">
    <div class="txtools">
      <input type="search" id="fq" placeholder="Search merchant, notes, category or amount" value="${esc(f.q)}" aria-label="Search transactions">
      <div class="seg tabs" role="group" aria-label="Show">${TX_TABS.map(([k, v]) => `<button data-act="tx-tab" data-v="${k}" aria-pressed="${f.tab === k}">${v}</button>`).join("")}</div>
      <div class="filters">
        <select id="ft" aria-label="Type"><option value="">All types</option><option value="income" ${f.type === "income" ? "selected" : ""}>Income</option><option value="expense" ${f.type === "expense" ? "selected" : ""}>Expenses</option><option value="transfer" ${f.type === "transfer" ? "selected" : ""}>Transfers</option></select>
        <select id="fa" aria-label="Account"><option value="">All accounts</option>${S.accounts.filter(a => (txByAcct()[a.id] || []).length).map(a => `<option value="${a.id}" ${f.account === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>
        <select id="fc" aria-label="Category"><option value="">All categories</option>${catOptions(f.category)}</select>
        <select id="fg" aria-label="Tag"><option value="">All tags</option>${tags.map(t => `<option ${f.tag === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
        ${S.properties.length ? `<select id="fp" aria-label="Property"><option value="">All properties</option>${S.properties.map(p => `<option value="${p.id}" ${f.property === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select>` : ""}
      </div>
    </div>
    <div class="txsum" id="txsum"></div>
    <div class="bulk" id="bulk" hidden></div>
    <div class="txr txhead"><label class="cb"><input type="checkbox" id="selall" aria-label="Select all shown"></label><span>Merchant</span><span>Category</span><span class="acc">Account</span><span class="r">Amount</span></div>
    <div id="txlist"></div>
  </section>`;
  const upd = () => { f.q = $("#fq").value; f.type = $("#ft").value; f.account = $("#fa").value; f.category = $("#fc").value; f.tag = $("#fg").value; f.property = $("#fp") ? $("#fp").value : ""; f.limit = 200; f.sel.clear(); renderTxList(); };
  $("#fq").addEventListener("input", upd);
  for (const id of ["#ft", "#fa", "#fc", "#fg", "#fp"]) if ($(id)) $(id).addEventListener("change", upd);
  $("#selall").addEventListener("change", e => { const list = filteredTx().slice(0, f.limit); f.sel.clear(); if (e.target.checked) list.forEach(t => f.sel.add(t.id)); renderTxList(); });
  renderTxList();
};
VIEWS.uncategorized = el => { UI.tx.tab = "uncategorized"; VIEWS.transactions(el, null, "Uncategorized"); };
function catOptions(sel) {
  return S.groups.map(g => {
    const cs = S.categories.filter(c => c.group === g.id); if (!cs.length) return "";
    return `<optgroup label="${esc(g.name)}">${cs.map(c => `<option value="${esc(c.name)}" ${c.name === sel ? "selected" : ""}>${esc(c.emoji)} ${esc(c.name)}</option>`).join("")}</optgroup>`;
  }).join("");
}
function filteredTx() {
  const f = UI.tx, q = f.q.trim().toLowerCase(), r = UI.range, qn = q.replace(/[$,−-]/g, "");
  return S.transactions.filter(t => {
    const ym = t.date.slice(0, 7); if (ym < r.from || ym > r.to) return false;
    if (f.tab === "hidden") { if (!t.hidden) return false; } else if (t.hidden) return false;
    const ls = linesOf(t);
    if (f.tab === "review" && !t.needsReview) return false;
    if (f.tab === "uncategorized" && !ls.some(l => l.category === "Uncategorized")) return false;
    if (f.tab === "split" && !isSplit(t)) return false;
    if (f.type && !ls.some(l => kindOf(l.category) === f.type)) return false;
    if (f.account && t.account !== f.account) return false;
    if (f.category && !ls.some(l => l.category === f.category)) return false;
    if (f.tag && !(t.tags || []).includes(f.tag)) return false;
    if (f.property && t.property !== f.property) return false;
    if (q && !(t.merchant.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || (t.notes || "").toLowerCase().includes(q) || ls.some(l => l.category.toLowerCase().includes(q)) || (qn && Math.abs(t.amount).toFixed(2).includes(qn)))) return false;
    return true;
  }).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
}
function renderTxList() {
  const f = UI.tx, list = filteredTx(), shown = list.slice(0, f.limit);
  const inflow = sum(list.filter(t => t.amount > 0).map(t => t.amount)), outflow = sum(list.filter(t => t.amount < 0).map(t => t.amount));
  const nr = list.filter(t => t.needsReview).length;
  $("#txsum").innerHTML = list.length ? `${list.length.toLocaleString()} transactions · <span class="pos">${esc(money(inflow, true))} in</span> · ${esc(money(-outflow, true))} out${nr ? ` · <button class="linkbtn warn" data-act="tx-tab" data-v="review">${nr} need review</button>` : ""}` : "";
  renderBulk();
  if (!list.length) {
    $("#txlist").innerHTML = `<div class="empty">${S.transactions.length ? (f.tab === "review" ? "All caught up. Nothing needs review in this period." : f.tab === "uncategorized" ? "Everything in this period has a category." : "No transactions match these filters in " + esc(rangeLabel()) + ".") : "No transactions yet. Connect your banks or import a CSV."}</div>`;
    return;
  }
  const byDay = {}; for (const t of shown) byDay[t.date] = (byDay[t.date] || 0) + t.amount;
  let html = "", day = "";
  for (const t of shown) {
    if (t.date !== day) { day = t.date; html += `<div class="dayh"><span>${esc(dayName(day, { month: "short", day: "numeric", year: "numeric" }))}</span><span class="num">${esc(signed(byDay[day]))}</span></div>`; }
    const unc = linesOf(t).some(l => l.category === "Uncategorized");
    const catCell = isSplit(t)
      ? `<span class="pill split">Split</span> <span class="splitcats">${esc([...new Set(t.splits.map(s => s.category))].join(", "))}</span>`
      : `<select class="catsel ${unc ? "unc" : ""}" data-change="tx-cat" data-id="${t.id}" aria-label="Category for ${esc(t.merchant)}">${CM[t.category] ? "" : `<option selected>${esc(t.category)}</option>`}${catOptions(t.category)}</select>`;
    const sub = isSplit(t) ? "Split" : catOf(t.category).name;
    html += `<div class="txr ${f.sel.has(t.id) ? "sel" : ""}" data-act="edit-tx" data-id="${t.id}">
      <label class="cb"><input type="checkbox" data-change="tx-sel" data-id="${t.id}" ${f.sel.has(t.id) ? "checked" : ""} aria-label="Select ${esc(t.merchant)}"></label>
      <div class="m">${t.needsReview ? '<span class="rv" title="Needs review"></span>' : '<span class="rv off"></span>'}${avatar(t.merchant)}<div class="mt"><div class="t">${esc(t.merchant)}${t.pending ? ' <span class="pill ok">Pending</span>' : ""}${t.property && PM[t.property] ? ` <span class="pill prop">${esc(PM[t.property].name)}</span>` : ""}</div><div class="s mob ${unc ? "unc" : ""}">${esc(sub)}</div>${t.notes ? `<div class="s">${esc(t.notes)}</div>` : ""}</div></div>
      <div class="c">${catCell}</div>
      <div class="acc">${esc(acctName(t.account))}</div>
      <div class="amt ${t.amount > 0 ? "pos" : ""}">${esc(signed(t.amount))}</div></div>`;
  }
  if (list.length > shown.length) html += `<div class="more"><button class="btn" data-act="more-tx">Show ${Math.min(200, list.length - shown.length)} more</button></div>`;
  $("#txlist").innerHTML = html;
  const sa = $("#selall"); if (sa) { sa.checked = shown.length > 0 && shown.every(t => f.sel.has(t.id)); sa.indeterminate = f.sel.size > 0 && !sa.checked; }
}
function renderBulk() {
  const b = $("#bulk"), n = UI.tx.sel.size; if (!b) return;
  b.hidden = !n; if (!n) return;
  const hiddenTab = UI.tx.tab === "hidden";
  b.innerHTML = `<b>${n} selected</b><button class="btn small" data-act="bulk-review">Mark reviewed</button>
    <select class="btn small" data-change="bulk-cat" aria-label="Set category"><option value="">Set category…</option>${catOptions("")}</select>
    ${S.properties.length ? `<select class="btn small" data-change="bulk-prop" aria-label="Assign property"><option value="">Assign property…</option><option value="__none">No property</option>${S.properties.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select>` : ""}
    <button class="btn small" data-act="bulk-hide">${hiddenTab ? "Unhide" : "Hide"}</button><button class="btn small danger" data-act="bulk-del">Delete</button><span class="sp"></span><button class="linkbtn" data-act="bulk-clear">Clear selection</button>`;
}

/* ---------------- Cash flow ---------------- */
function flowNodes(R, mode) {
  const income = ranked(R.inc, "cat", 8).map(r => ({ id: "i:" + r.key, name: r.name, v: r.v, color: colorVar(r.key.startsWith("prop:") ? r.color : 3) }));
  if (R.expense > R.income) income.push({ id: "i:deficit", name: "From savings", v: R.expense - R.income, color: "var(--c0)" });
  const through = Math.max(R.income, R.expense);
  const mid = [{ id: "mid", name: "Income", v: through, color: "var(--c3)", lv: R.income }];
  const saved = R.income - R.expense;
  const savings = saved > 0 ? [{ id: "sav", name: "Savings", v: saved, color: "var(--c3)" }] : [];
  const links = income.map(n => ({ from: n.id, to: "mid", v: n.v }));
  const cols = [income, mid];
  if (mode === "categories") {
    const cats = ranked(R.cat, "cat", 14).map(r => ({ id: "c:" + r.key, name: r.name, v: r.v, color: colorVar(r.color) }));
    cols.push(savings.concat(cats));
  } else {
    const groups = ranked(R.grp, "group", mode === "both" ? 8 : 12).map(r => ({ id: "g:" + r.key, key: r.key, name: r.name, v: r.v, color: colorVar(r.color) }));
    cols.push(savings.concat(groups));
    if (mode === "both") {
      const cats = [], shown = new Set(groups.map(g => g.key));
      for (const g of groups) {
        const kids = ranked(Object.fromEntries(Object.entries(R.cat).filter(([k]) => g.key === "__other" ? !shown.has(catGroupKey(k)) : catGroupKey(k) === g.key)), "cat");
        const top = kids.slice(0, 2), rest = kids.slice(2);
        for (const c of top) { cats.push({ id: "c:" + c.key, name: c.name, v: c.v, color: g.color }); links.push({ from: g.id, to: "c:" + c.key, v: c.v }); }
        if (rest.length) { const v = sum(rest.map(c => c.v)); cats.push({ id: "c:rest:" + g.key, name: `More ${g.name.replace(/^Other.*/, "other")}`, v, color: g.color }); links.push({ from: g.id, to: "c:rest:" + g.key, v }); }
      }
      cols.push(cats);
    }
  }
  for (const n of cols[2]) links.push({ from: "mid", to: n.id, v: n.v });
  return { cols, links };
}
VIEWS.cashflow = el => {
  const r = UI.range, R = summarize(r.from, r.to), cf = UI.cf, saved = R.income - R.expense;
  const months = rangeMonths(); const chartMonths = months.length >= 3 ? months : monthsIn(addMonths(r.to, -5), r.to);
  el.innerHTML = pageHead("Cash flow") + `
  <div class="grid">
    ${tile("Income", esc(money(R.income, true)), "", { cls: "c3", dot: "var(--c3)" })}
    ${tile("Expenses", esc(money(R.expense, true)), "", { cls: "c3", dot: "var(--c2)" })}
    ${tile(saved >= 0 ? "Saved" : "Overspent", esc(money(Math.abs(saved), true)), "", { cls: "c3", style: saved < 0 ? "color:var(--bad-text)" : "" })}
    ${tile("Savings rate", R.income > 0 ? pct(saved / R.income, 1) : "—", S.settings.savingsGoal ? `Goal ${esc(money(S.settings.savingsGoal))} a month` : "", { cls: "c3" })}
    <section class="card c12">
      <div class="ch wrapx"><h2>Where the money went</h2><span class="sp"></span>${seg("cf-mode", [["groups", "Groups"], ["categories", "Categories"], ["both", "Both"]], cf.mode, "Detail")}${seg("cf-view", [["sankey", "Sankey"], ["pl", "Profit & loss"]], cf.view, "View")}</div>
      <div id="flow" class="chart ${cf.view === "sankey" ? "flowscroll" : ""}"></div>
    </section>
    <section class="card c6"><div class="ch"><h2>Income</h2><span class="sp"></span>${seg("cf-inc", [["category", "Category"], ["merchant", "Merchant"]], cf.inc, "Income by")}</div>
      ${cf.inc === "merchant" ? rankList(ranked(R.incMer, "merchant", 12).map(x => ({ ...x, color: 3 })), R.income) : rankList(ranked(R.inc, "cat", 12), R.income)}</section>
    <section class="card c6"><div class="ch"><h2>Expenses</h2><span class="sp"></span>${seg("cf-exp", [["group", "Group"], ["category", "Category"], ["merchant", "Merchant"]], cf.exp, "Expenses by")}</div>
      ${cf.exp === "group" ? rankList(ranked(R.grp, "group", 12), R.income || R.expense) : cf.exp === "category" ? rankList(ranked(R.cat, "cat", 15), R.income || R.expense, { showSub: true }) : rankList(ranked(R.mer, "merchant", 15).map(x => ({ ...x, color: merchantColor(R, x.key) })), R.income || R.expense)}
      <p class="small muted note">Percentages are of income, as in the flow above.</p></section>
    <section class="card c12">
      <div class="ch"><h2>Month by month</h2><span class="sub">Tap a month to open its transactions</span></div>
      <div class="legend"><span><i style="background:var(--c1)"></i>Income</span><span><i style="background:var(--c2)"></i>Spending</span></div>
      <div class="chart" id="cfMonths"></div>
      <details class="tbl"><summary>Show as table</summary><div class="tbl-wrap"><table><thead><tr><th>Month</th><th>Income</th><th>Spending</th><th>Saved</th><th>Rate</th></tr></thead><tbody>
      ${chartMonths.slice().reverse().map(m => { const x = summarize(m, m); return `<tr><td>${esc(monthName(m))}</td><td>${esc(money(x.income))}</td><td>${esc(money(x.expense))}</td><td>${esc(signed(x.income - x.expense, false))}</td><td>${x.income > 0 ? pct((x.income - x.expense) / x.income) : "—"}</td></tr>`; }).join("")}
      </tbody></table></div></details>
    </section>
  </div>`;
  const flow = $("#flow");
  if (!R.income && !R.expense) flow.innerHTML = `<div class="empty">No income or spending in ${esc(rangeLabel())}.</div>`;
  else if (cf.view === "sankey") { const { cols, links } = flowNodes(R, cf.mode); sankey(flow, cols, links, { base: R.income || R.expense, minW: 720, label: "Where the money went" }); }
  else flow.innerHTML = plTable(R);
  cashChart($("#cfMonths"), chartMonths.map(m => ({ ym: m, ...summarize(m, m) })), { h: 240, onPick: m => { UI.range = { preset: "custom", from: m, to: m }; saveUI(); UI.tx.tab = "all"; location.hash = "#transactions"; } });
};
function merchantColor(R, m) { const g = R.merGrp[m]; if (!g) return 0; if (g.startsWith("prop:")) return (PM[g.slice(5)] || {}).color || 0; return (GM[g] || {}).color || 0; }
function plTable(R) {
  const base = R.income || 1, open = UI.cf.open;
  const isOpen = k => open[k] ?? (k === "__inc" || k === "__exp");
  const row = (cls, name, p, amt, attrs = "") => `<tr class="${cls}" ${attrs}><td>${name}</td><td class="num">${p}</td><td class="num">${amt}</td></tr>`;
  const chev = k => `<span class="chev ${isOpen(k) ? "open" : ""}" aria-hidden="true">›</span>`;
  let h = `<div class="tbl-wrap"><table class="pl"><thead><tr><th>Category</th><th>% of income</th><th>Amount</th></tr></thead><tbody>`;
  h += row("plh", chev("__inc") + "Income", "", esc(money(R.income, true)), `data-act="pl-toggle" data-key="__inc" tabindex="0"`);
  if (isOpen("__inc")) for (const r of ranked(R.inc, "cat")) h += row("pl1", (r.prop ? `<a href="${r.href}">${esc(r.name)}</a>` : esc(r.name)), pct(r.v / base, 1), esc(money(r.v, true)));
  h += row("plh", chev("__exp") + "Expenses", pct(R.expense / base, 1), esc(minus(-R.expense)), `data-act="pl-toggle" data-key="__exp" tabindex="0"`);
  if (isOpen("__exp")) for (const g of ranked(R.grp, "group")) {
    const k = "g:" + g.key;
    h += row("pl1 plg", `${chev(k)}<span class="dot" style="background:${colorVar(g.color)}"></span>${esc(g.name)}`, pct(g.v / base, 1), esc(minus(-g.v)), `data-act="pl-toggle" data-key="${esc(k)}" tabindex="0"`);
    if (isOpen(k)) for (const c of ranked(Object.fromEntries(Object.entries(R.cat).filter(([ck]) => catGroupKey(ck) === g.key)), "cat")) h += row("pl2", esc(c.name), pct(c.v / base, 1), esc(minus(-c.v)));
  }
  const net = R.income - R.expense;
  h += `</tbody><tfoot>${row("plt", net >= 0 ? "Net savings" : "Net loss", R.income ? pct(net / base, 1) : "—", esc(signed(net)))}</tfoot></table></div>`;
  return h;
}

/* ---------------- Spending ---------------- */
const PICK_COLORS = [1, 2, 3, 5];
function spendItems(R, mode) {
  if (mode === "groups") return ranked(R.grp, "group");
  if (mode === "merchants") return ranked(R.mer, "merchant").map(x => ({ ...x, color: merchantColor(R, x.key) }));
  return ranked(R.cat, "cat");
}
VIEWS.spending = el => {
  const r = UI.range, R = summarize(r.from, r.to), months = rangeMonths(), sp = UI.sp;
  const items = spendItems(R, sp.mode), groups = ranked(R.grp, "group");
  const largest = groups[0];
  const avg = R.expense / Math.max(1, months.length);
  const donutItems = items.slice(0, 9).map(i => ({ name: i.name, v: i.v, color: colorVar(i.color) }));
  if (items.length > 9) donutItems.push({ name: "Everything else", v: sum(items.slice(9).map(i => i.v)), color: "var(--c0)" });
  const legendGroups = sp.mode === "merchants" ? groups.filter(g => items.slice(0, 9).some(i => merchantGroupKey(R, i.key) === g.key)) : groups;
  el.innerHTML = pageHead("Spending") + `
  <div class="grid">
    ${tile("Total spending", esc(money(R.expense, true)), "", { cls: "c3", dot: "var(--c2)" })}
    ${tile("Average per month", esc(money(avg, true)), `${months.length} month${months.length === 1 ? "" : "s"}`, { cls: "c3" })}
    ${tile("Largest group", largest ? esc(largest.name) : "—", largest ? `${pct(largest.v / R.expense, 1)} of spending` : "", { cls: "c3" })}
    ${tile("Transactions", R.count.toLocaleString(), "", { cls: "c3" })}
    <section class="card c12">
      <div class="ch"><h2>Spending breakdown</h2><span class="sp"></span>${seg("sp-mode", [["groups", "Groups"], ["categories", "Categories"], ["merchants", "Merchants"]], sp.mode, "Break down by")}</div>
      ${items.length ? `<div class="breakdown">
        <div class="bd-l"><div class="chart donut" id="spDonut"></div>
          <div class="legend wrap">${legendGroups.slice(0, 10).map(g => `<span><i style="background:${colorVar(g.color)}"></i>${esc(g.name)}</span>`).join("")}</div></div>
        <div class="bd-r">${rankList(items.slice(0, 20), R.expense, { showSub: sp.mode === "categories", pick: "sp-pick", picked: sp.picked })}
          ${items.length > 20 ? `<p class="small muted note">${items.length - 20} more with smaller amounts.</p>` : ""}</div>
      </div>` : `<div class="empty">No spending in ${esc(rangeLabel())}.</div>`}
    </section>
    <section class="card c12">
      <div class="ch"><h2>Spending trend</h2>${sp.picked.length ? `<span class="sp"></span><button class="linkbtn" data-act="sp-clear">Show total</button>` : ""}</div>
      <p class="small muted note">Click rows in the breakdown above to chart them (up to four). Click a month to see its transactions.</p>
      ${sp.picked.length > 1 ? `<div class="legend">${sp.picked.map((k, i) => `<span><i style="background:${colorVar(PICK_COLORS[i])}"></i>${esc((items.find(x => x.key === k) || keyInfo(k, sp.mode === "groups" ? "group" : sp.mode === "merchants" ? "merchant" : "cat")).name)}</span>`).join("")}</div>` : ""}
      <div class="chart" id="spTrend"></div>
    </section>
  </div>`;
  if (items.length) donut($("#spDonut"), donutItems, R.expense, { size: 230, label: "Spending breakdown" });
  const tm = months.length >= 2 ? months : monthsIn(addMonths(r.to, -5), r.to);
  const labels = tm.map(m => ({ label: tm.length > 12 ? monthName(m, { month: "short", year: "2-digit" }) : monthShort(m), title: monthName(m) }));
  const openMonth = i => { UI.range = { preset: "custom", from: tm[i], to: tm[i] }; saveUI(); UI.tx.tab = "all"; if (sp.mode === "categories" && sp.picked.length === 1 && CM[sp.picked[0]]) UI.tx.category = sp.picked[0]; location.hash = "#transactions"; };
  if (!sp.picked.length) barChart($("#spTrend"), tm.map((m, i) => ({ label: labels[i].label, title: labels[i].title, v: summarize(m, m).expense })), { h: 230, color: "var(--c2)", series: "Spending", label: "Spending by month", onPick: (row, i) => openMonth(i) });
  else {
    const map = x => sp.mode === "groups" ? x.grp : sp.mode === "merchants" ? x.mer : x.cat;
    const series = sp.picked.map((k, i) => ({ name: (items.find(x => x.key === k) || { name: k }).name, color: colorVar(PICK_COLORS[i]), values: tm.map(m => map(summarize(m, m))[k] || 0) }));
    lineChart($("#spTrend"), labels, series, { h: 240, zero: true, label: "Spending trend", onPick: openMonth });
  }
};
function merchantGroupKey(R, m) { return R.merGrp[m]; }

/* ---------------- Net worth ---------------- */
VIEWS.networth = el => {
  const r = UI.range, nw = UI.nw;
  let months = monthsIn(r.from, r.to); if (months.length < 3) months = monthsIn(addMonths(r.to, -11), r.to);
  const endDate = r.to >= CUR_MONTH ? TODAY : monthEnd(r.to), startDate = monthEnd(addMonths(months[0], -1));
  const at = (list, d) => sum(list.map(a => balanceAt(a, d)));
  const assets = S.accounts.filter(a => !isLiability(a)), liabs = S.accounts.filter(isLiability);
  const nwEnd = at(S.accounts, endDate), nwStart = at(S.accounts, startDate), tA = at(assets, endDate), tL = at(liabs, endDate);
  const labels = months.map(m => ({ label: months.length > 12 ? monthName(m, { month: "short", year: "2-digit" }) : monthShort(m), title: m === CUR_MONTH ? "Today" : "End of " + monthName(m) }));
  el.innerHTML = pageHead("Net worth") + `
  <div class="grid">
    ${tile("Net worth", esc(money(nwEnd, true)), `As of ${r.to >= CUR_MONTH ? "today" : "end of " + esc(monthName(r.to))}`, { cls: "c3" })}
    ${tile("Change this period", `<span style="color:${nwEnd - nwStart >= 0 ? "var(--good-text)" : "var(--bad-text)"}">${esc(signed(nwEnd - nwStart))}</span>`, `Since the start of ${esc(monthName(months[0]))}`, { cls: "c3", dot: nwEnd - nwStart >= 0 ? "var(--good)" : "var(--bad)" })}
    ${tile("Assets", esc(money(tA, true)), `${assets.length} accounts`, { cls: "c3" })}
    ${tile("Liabilities", esc(money(Math.abs(tL), true)), `${liabs.length} accounts`, { cls: "c3" })}
    <section class="card c12">
      <div class="ch wrapx"><h2>Net worth over time</h2><span class="sp"></span>${seg("nw-view", [["total", "Net worth"], ["type", "By type"]], nw.view, "Chart")}
        <select id="nwacct" data-change="nw-acct" class="btn small" aria-label="Account"><option value="">All accounts</option>${S.accounts.map(a => `<option value="${a.id}" ${nw.account === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></div>
      <p class="small muted note">Open a type in the lists below, then tap accounts to chart them. Pick several to compare.</p>
      <div id="nwLegend"></div><div class="chart" id="nwChart"></div>
    </section>
    ${nwList("Assets", assets, tA, endDate)}
    ${nwList("Liabilities", liabs, tL, endDate)}
  </div>`;
  let series;
  if (nw.picked.length) series = nw.picked.filter(id => AM[id]).map((id, i) => ({ name: AM[id].name, color: colorVar(PICK_COLORS[i]), values: balanceSeries([AM[id]], months) }));
  else if (nw.account && AM[nw.account]) series = [{ name: AM[nw.account].name, color: "var(--c1)", values: balanceSeries([AM[nw.account]], months) }];
  else if (nw.view === "type") series = TYPE_GROUPS.map(g => ({ g, accts: S.accounts.filter(a => g.types.includes(a.type)) })).filter(x => x.accts.length).map(x => ({ name: x.g.name, color: colorVar(x.g.color), values: balanceSeries(x.accts, months) }));
  else series = [{ name: "Net worth", color: "var(--c2)", values: balanceSeries(S.accounts, months) }];
  if (series.length > 1) $("#nwLegend").innerHTML = `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("")}</div>`;
  lineChart($("#nwChart"), labels, series, { h: 260, zero: series.length > 1, label: "Net worth over time" });
};
function nwList(title, list, total, date) {
  const groups = TYPE_GROUPS.map(g => ({ g, accts: list.filter(a => g.types.includes(a.type)) })).filter(x => x.accts.length);
  const abs = Math.abs(total) || 1;
  return `<section class="card c6"><div class="ch"><h2>${title}</h2><span class="sp"></span><b class="num">${esc(money(Math.abs(total), true))}</b></div>
    <div class="stackbar">${groups.map(x => `<b style="width:${Math.abs(sum(x.accts.map(a => balanceAt(a, date)))) / abs * 100}%;background:${colorVar(x.g.color)}" title="${esc(x.g.name)}"></b>`).join("")}</div>
    ${groups.length ? groups.map(x => {
      const tot = sum(x.accts.map(a => balanceAt(a, date))), open = UI.nw.open[x.g.id];
      return `<div class="nwg"><button class="nwg-h" data-act="nw-open" data-v="${x.g.id}" aria-expanded="${!!open}"><span class="chev ${open ? "open" : ""}">›</span><span class="dot" style="background:${colorVar(x.g.color)}"></span><span class="nm">${esc(x.g.name)} <span class="muted">${x.accts.length}</span></span><span class="num">${esc(money(Math.abs(tot), true))}</span><span class="muted num p">${pct(Math.abs(tot) / abs, 1)}</span></button>
        ${open ? `<div class="nwg-b">${x.accts.map(a => { const pk = UI.nw.picked.indexOf(a.id); return `<div class="nwa ${pk >= 0 ? "picked" : ""}" data-act="nw-pick" data-id="${a.id}" role="button" tabindex="0" aria-pressed="${pk >= 0}"><span class="dot" style="background:${pk >= 0 ? colorVar(PICK_COLORS[pk]) : "transparent"};outline:1px solid var(--axis)"></span><span class="nm">${esc(a.name)}<span class="muted small"> · ${esc(a.org || ACCT_TYPES[a.type])}</span></span><span class="num">${esc(money(balanceAt(a, date), true))}</span><button class="linkbtn" data-act="edit-acct" data-id="${a.id}">Edit</button></div>`; }).join("")}</div>` : ""}</div>`;
    }).join("") : `<div class="empty small">None yet.</div>`}</section>`;
}

/* ---------------- Budget ---------------- */
VIEWS.budget = el => {
  const ym = UI.month, R = summarize(ym, ym), bt = budgetTotals(ym);
  const isCur = ym === CUR_MONTH, frac = isCur ? (+TODAY.slice(8)) / daysIn(ym) : 1;
  const cats = budgetCats();
  const shown = UI.showAllBudget ? cats : cats.filter(c => (S.budgets[c.name] || 0) > 0 || (R.cat[c.name] || 0) > 0.5);
  const hidden = cats.length - shown.length;
  const unb = sum(cats.filter(c => !(S.budgets[c.name] > 0)).map(c => Math.max(0, R.cat[c.name] || 0)));
  const propNet = sum(Object.values(R.props).map(p => p.net));
  el.innerHTML = pageHead("Budget", { month: true }) + `
  <div class="grid">
    ${tile("Budgeted", esc(money(bt.budget)), `${esc(money(R.income))} income this month`, { cls: "c4" })}
    ${tile("Spent in budgeted categories", esc(money(bt.spent)), meterHtml(bt.spent, bt.budget), { cls: "c4" })}
    ${tile(bt.spent > bt.budget ? "Over budget" : "Left to spend", esc(money(Math.abs(bt.budget - bt.spent))), `${isCur ? (daysIn(ym) - +TODAY.slice(8)) + " days left" : "Month closed"}${unb > 0.5 ? " · " + esc(money(unb)) + " unbudgeted" : ""}`, { cls: "c4", style: bt.spent > bt.budget ? "color:var(--bad-text)" : "" })}
    <section class="card c8">
      <div class="ch"><h2>Categories</h2><span class="sp"></span><button class="btn small" data-act="fill-budget">Fill from 3-month average</button></div>
      ${S.groups.map(g => {
        const rs = shown.filter(c => c.group === g.id); if (!rs.length) return "";
        return `<div class="grp-h"><span class="dot" style="background:${colorVar(g.color)}"></span>${esc(g.name)}</div>` + rs.map(c => {
          const b = S.budgets[c.name] || 0, s = R.cat[c.name] || 0;
          const pace = isCur && b > 0 && FLEX_GROUPS(c.group) && s > b * frac * 1.15 && s < b ? " · ahead of pace" : "";
          return `<div class="brow"><div class="nm">${esc(c.emoji)} ${esc(c.name)}</div>
            <div class="mid">${b > 0 ? meterHtml(s, b) : `<div class="meter"><b style="width:0"></b></div>`}<div class="fig">${esc(money(s))} spent${b > 0 ? "" : " · no budget"}${pace}</div></div>
            <div class="bin">${b > 0 ? budgetPill(s, b) : ""}<input id="b-${esc(c.name.replace(/\W+/g, "-"))}" type="number" inputmode="decimal" min="0" step="10" value="${b || ""}" placeholder="—" aria-label="Budget for ${esc(c.name)}" data-change="budget" data-cat="${esc(c.name)}"></div></div>`;
        }).join("");
      }).join("")}
      <div class="note"><button class="linkbtn" data-act="toggle-all-budget">${UI.showAllBudget ? "Hide categories with no activity" : `Show ${hidden} more categor${hidden === 1 ? "y" : "ies"}`}</button></div>
      ${S.properties.length ? `<p class="small muted note">Property costs aren't budgeted here. Their net this month was ${esc(signed(propNet, false))}; see each property's page.</p>` : ""}
    </section>
    <section class="card c4">
      <div class="ch"><h2>Month reflection</h2></div>
      <p class="small muted" style="margin:0 0 8px">Kakeibo, the Japanese household ledger, closes each month with four questions:</p>
      <ol class="kq"><li>How much money did you receive?</li><li>How much would you like to save?</li><li>How much did you spend?</li><li>How can you improve?</li></ol>
      <textarea class="note-ta" id="note-${ym}" data-change="note" data-ym="${ym}" placeholder="Notes for ${esc(monthName(ym))}…" aria-label="Notes for ${esc(monthName(ym))}">${esc(S.notes[ym] || "")}</textarea>
      <div class="set-row"><div class="tx2"><b>Monthly savings goal</b><span>Shown on the overview and cash flow.</span></div>
        <input id="goal" class="inp num" type="number" min="0" step="50" value="${S.settings.savingsGoal || ""}" placeholder="0" data-change="goal" style="width:110px;text-align:right"></div>
    </section>
  </div>`;
};

/* ---------------- Recurring ---------------- */
VIEWS.recurring = el => {
  const exp = RECUR.filter(r => r.amount < 0), inc = RECUR.filter(r => r.amount > 0);
  const soon = exp.filter(r => dayDiff(TODAY, r.next) <= 7);
  const table = rows => `<div class="tbl-wrap"><table><thead><tr><th>Merchant</th><th>Frequency</th><th>Typical</th><th>Next</th><th>Per month</th><th></th></tr></thead><tbody>
    ${rows.map(r => `<tr><td><div class="mcell">${avatar(r.name)}<div><b>${esc(r.name)}</b><div class="small muted">${esc(r.category)}${r.property && PM[r.property] ? " · " + esc(PM[r.property].name) : ""} · ${r.count} payments</div></div></div></td><td>${esc(r.freq.label)}</td><td>${esc(money(Math.abs(r.amount), true))}</td>
      <td>${r.next < TODAY ? `<span class="pill warn">● Due ${esc(dayName(r.next, { month: "short", day: "numeric" }))}</span>` : esc(dayName(r.next, { month: "short", day: "numeric" }))}</td><td>${esc(money(Math.abs(r.monthly), true))}</td>
      <td><button class="linkbtn" data-act="hide-recur" data-key="${esc(r.key)}">Not recurring</button></td></tr>`).join("")}</tbody></table></div>`;
  const hiddenN = Object.keys(S.hiddenRecurring).length;
  el.innerHTML = pageHead("Recurring", { range: false }) + `
  <div class="grid">
    ${tile("Recurring bills", esc(money(-sum(exp.map(r => r.monthly)))), `a month across ${exp.length}`, { cls: "c4" })}
    ${tile("Recurring income", esc(money(sum(inc.map(r => r.monthly)))), `a month across ${inc.length}`, { cls: "c4" })}
    ${tile("Due in the next 7 days", esc(money(-sum(soon.map(r => r.amount)))), `${soon.length} charges`, { cls: "c4" })}
    <section class="card c12"><div class="ch"><h2>Bills and subscriptions</h2><span class="sub">Found from merchants that charge on a steady schedule</span></div>${exp.length ? table(exp) : `<div class="empty small">Nothing yet. A merchant needs at least three charges on a steady schedule.</div>`}</section>
    ${inc.length ? `<section class="card c12"><div class="ch"><h2>Income</h2></div>${table(inc)}</section>` : ""}
  </div>
  ${hiddenN ? `<p class="small muted note">${hiddenN} hidden. <button class="linkbtn" data-act="unhide-recur">Show them again</button></p>` : ""}`;
};

/* ---------------- Accounts ---------------- */
VIEWS.accounts = el => {
  const groups = TYPE_GROUPS.map(g => ({ g, accts: S.accounts.filter(a => g.types.includes(a.type)) })).filter(x => x.accts.length);
  const src = a => a.source === "simplefin" ? `<span class="pill ok">SimpleFIN</span>` : (txByAcct()[a.id] || []).length ? `<span class="pill ok">Transactions</span>` : `<span class="pill ok">Manual</span>`;
  el.innerHTML = pageHead("Accounts", { range: false, actions: `<button class="btn brand" data-act="new-acct">+ Add account</button>` }) + `
  <div class="grid">
    ${tile("Net worth", esc(money(netWorth(), true)), "", { cls: "c4" })}
    ${tile("Accounts", String(S.accounts.length), `${S.accounts.filter(a => a.source === "simplefin").length} synced from banks`, { cls: "c4" })}
    ${tile("Last bank sync", S.sync.lastSync ? esc(new Date(S.sync.lastSync).toLocaleDateString(undefined, { month: "short", day: "numeric" })) : "Never", S.sync.lastSync ? esc(new Date(S.sync.lastSync).toLocaleTimeString()) : `<a href="#settings">Connect banks</a>`, { cls: "c4" })}
    ${groups.map(x => `<section class="card c6"><div class="ch"><h2><span class="dot" style="background:${colorVar(x.g.color)}"></span>${esc(x.g.name)}</h2><span class="sp"></span><b class="num">${esc(money(sum(x.accts.map(a => a.balance)), true))}</b></div>
      <div class="list">${x.accts.map(a => `<div class="li" data-act="edit-acct" data-id="${a.id}" role="button" tabindex="0"><span class="emo" aria-hidden="true">${ACCT_EMOJI[a.type] || "📁"}</span>
        <div class="li-m"><div class="t">${esc(a.name)}</div><div class="s">${esc(a.org || ACCT_TYPES[a.type])} · ${(txByAcct()[a.id] || []).length.toLocaleString()} transactions ${src(a)}</div></div>
        <div class="amt">${esc(money(a.balance, true))}</div></div>`).join("")}</div></section>`).join("") || `<section class="card c12"><div class="empty">No accounts yet. Connect your banks, import a CSV, or add one by hand.</div></section>`}
  </div>`;
};

/* ---------------- Loans ---------------- */
VIEWS.loans = el => {
  const loans = S.accounts.filter(a => a.type === "loan");
  const owed = -sum(loans.map(a => a.balance)), pay = sum(loans.map(a => +(a.loan || {}).payment || 0));
  const wr = owed > 0 ? sum(loans.map(a => -a.balance * (+(a.loan || {}).rate || 0))) / owed : 0;
  const months = monthsIn(addMonths(CUR_MONTH, -23), CUR_MONTH);
  el.innerHTML = pageHead("Loans", { range: false, actions: `<button class="btn brand" data-act="new-acct" data-type="loan">+ Add loan</button>` }) + `
  <div class="grid">
    ${tile("Total owed", esc(money(owed, true)), `${loans.length} loans`, { cls: "c4" })}
    ${tile("Monthly payments", esc(money(pay, true)), "", { cls: "c4" })}
    ${tile("Average rate", wr ? wr.toFixed(2) + "%" : "—", "weighted by balance", { cls: "c4" })}
    ${loans.length ? `<section class="card c12"><div class="ch"><h2>Balance owed</h2><span class="sub">last 24 months</span></div><div class="chart" id="loanChart"></div></section>` : ""}
    ${loans.map(a => {
      const L = a.loan || {}, B = -a.balance, orig = +L.original || 0, paid = orig ? Math.max(0, Math.min(1, (orig - B) / orig)) : null, po = loanPayoff(a);
      const payoff = !po ? "Add a payment to estimate" : po.never ? "Payment doesn't cover interest" : po.months === 0 ? "Paid off" : `${monthName(addMonths(CUR_MONTH, po.months), { month: "short", year: "numeric" })} · ${Math.floor(po.months / 12)}y ${po.months % 12}m`;
      return `<section class="card c6 loan"><div class="ch"><h2>${esc(a.name)}</h2><span class="sub">${esc(a.org || "")}</span><span class="sp"></span><button class="linkbtn" data-act="edit-loan" data-id="${a.id}">Edit details</button></div>
        <div class="row-flex"><div><div class="lbl">Balance</div><div class="val2">${esc(money(B, true))}</div></div>${orig ? `<div><div class="lbl">Original</div><div class="val2 muted">${esc(money(orig))}</div></div>` : ""}</div>
        ${paid != null ? `<div class="meter good" style="margin:12px 0 4px"><b style="width:${paid * 100}%"></b></div><div class="small muted">${pct(paid, 1)} paid off</div>` : ""}
        <dl class="kv"><div><dt>Rate</dt><dd>${L.rate ? (+L.rate).toFixed(3).replace(/0+$/, "").replace(/\.$/, "") + "%" : "—"}</dd></div><div><dt>Payment</dt><dd>${L.payment ? esc(money(+L.payment, true)) + "/mo" : "—"}</dd></div>
        <div><dt>Interest this month</dt><dd>${L.rate ? "≈ " + esc(money(B * L.rate / 1200)) : "—"}</dd></div><div><dt>Paid off by</dt><dd>${esc(payoff)}</dd></div></dl></section>`;
    }).join("") || `<section class="card c12"><div class="empty">No loans. Add a mortgage, auto or student loan to track payoff.</div></section>`}
  </div>`;
  if (loans.length) lineChart($("#loanChart"), months.map(m => ({ label: monthName(m, { month: "short", year: "2-digit" }), title: monthName(m) })), [{ name: "Owed", color: "var(--c7)", values: balanceSeries(loans, months).map(v => -v) }], { h: 220, label: "Total loan balance" });
};

/* ---------------- Property ---------------- */
VIEWS.property = (el, id) => {
  const p = PM[id];
  if (!p) { el.innerHTML = pageHead("Property not found", { range: false }) + `<div class="card"><div class="empty">That property doesn't exist anymore. <a href="#overview">Back to overview</a></div></div>`; return; }
  const r = UI.range, R = summarize(r.from, r.to, id), net = R.income - R.expense, months = rangeMonths();
  const cm = months.length >= 3 ? months : monthsIn(addMonths(r.to, -11), r.to);
  const val = AM[p.valueAccount], loan = AM[p.loanAccount];
  const equity = val ? val.balance + (loan ? loan.balance : 0) : null;
  const txs = S.transactions.filter(t => t.property === id && !t.hidden && t.date.slice(0, 7) >= r.from && t.date.slice(0, 7) <= r.to);
  const biggest = txs.filter(t => t.amount < 0 && kindOf(t.category) !== "transfer").sort((a, b) => a.amount - b.amount).slice(0, 6);
  const recent = [...txs].sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 8);
  el.innerHTML = pageHead(esc(p.name), { sub: esc(p.address || "Property") + " · " + syncLine(), actions: `<button class="btn" data-act="edit-prop" data-id="${p.id}">Edit</button>` }) + `
  <div class="grid">
    ${tile("Net cash flow", `<span style="color:${net >= 0 ? "var(--good-text)" : "var(--bad-text)"}">${esc(signed(net))}</span>`, esc(rangeLabel()), { cls: "c3", dot: colorVar(p.color) })}
    ${tile("Average per month", esc(signed(net / Math.max(1, months.length), false)), `${months.length} months`, { cls: "c3" })}
    ${tile("Income", esc(money(R.income, true)), "", { cls: "c3" })}
    ${tile("Expenses", esc(money(R.expense, true)), R.income ? `${pct(R.expense / R.income)} of income` : "", { cls: "c3" })}
    ${equity != null ? `<section class="card c12 equity"><div class="row-flex"><div><div class="lbl">Equity</div><div class="val2">${esc(money(equity))}</div></div>
      <div><div class="lbl">Value</div><div class="val2 muted">${esc(money(val.balance))}</div></div>${loan ? `<div><div class="lbl">Mortgage</div><div class="val2 muted">${esc(money(-loan.balance))}</div></div>` : ""}
      <div class="grow">${loan ? `<div class="meter good"><b style="width:${Math.max(0, Math.min(100, equity / val.balance * 100))}%"></b></div><div class="small muted">${pct(equity / val.balance)} equity · loan-to-value ${pct(-loan.balance / val.balance)}</div>` : ""}</div></div></section>` : ""}
    <section class="card c12">
      <div class="ch"><h2>Monthly cash flow</h2><span class="sub">income minus expenses</span></div>
      <div class="chart" id="propChart"></div>
      <p class="small muted note">Only this net amount feeds your household cash flow and spending, so ${esc(p.name)} doesn't crowd your everyday budget.</p>
    </section>
    <section class="card c6"><div class="ch"><h2>Income</h2></div>${rankList(ranked(R.inc, "cat").map(x => ({ ...x, color: 3 })), R.income)}</section>
    <section class="card c6"><div class="ch"><h2>Expenses</h2><span class="sub">biggest first</span></div>${rankList(ranked(R.cat, "cat").map(x => ({ ...x, color: p.color })), R.expense)}</section>
    <section class="card c6"><div class="ch"><h2>Largest expenses</h2></div>${biggest.length ? `<div class="list">${biggest.map(t => txLine(t, true)).join("")}</div>` : `<div class="empty small">No expenses in this period.</div>`}</section>
    <section class="card c6"><div class="ch"><h2>Recent transactions</h2><span class="sp"></span><button class="linkbtn" data-act="prop-tx" data-id="${p.id}">See all</button></div>${recent.length ? `<div class="list">${recent.map(t => txLine(t, true)).join("")}</div>` : `<div class="empty small">No transactions tagged to this property yet. Open a transaction and set its property, or assign several at once from Transactions.</div>`}</section>
  </div>`;
  barChart($("#propChart"), cm.map(m => { const x = summarize(m, m, id); return { label: cm.length > 12 ? monthName(m, { month: "short", year: "2-digit" }) : monthShort(m), title: monthName(m), v: x.income - x.expense,
    tip: tipRow("var(--c3)", money(x.income), "Income") + tipRow(colorVar(p.color), money(x.expense), "Expenses") + `<div class="r sep"><i></i><b>${esc(signed(x.income - x.expense, false))}</b><span>Net</span></div>` }; }),
    { h: 230, color: "var(--c1)", negColor: "var(--c8)", signed: true, label: "Monthly net cash flow" });
};

/* ---------------- Settings & sync ---------------- */
const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "MKD", "SEK", "NOK", "DKK", "INR", "SGD", "NZD", "MXN", "BRL"];
VIEWS.settings = el => {
  const byCat = {}; for (const t of S.transactions) for (const l of linesOf(t)) byCat[l.category] = (byCat[l.category] || 0) + 1;
  const syncCard = !SERVER
    ? `<p>Bank sync runs through <a href="https://beta-bridge.simplefin.org" target="_blank" rel="noopener">SimpleFIN Bridge</a> (about $1.50 a month), which needs the small companion server that comes with this app. Run it on your computer, a mini-PC or a Raspberry Pi and open the app from there:</p>
       <pre class="code">cd finance
node server.mjs</pre>
       <p class="small muted">Then visit <b>http://localhost:8787</b>. The server stores your data in <code>finance/data/</code> on that machine and keeps your SimpleFIN access key out of the browser. See <code>finance/README.md</code> for running it on a home server.</p>`
    : SERVER.simplefin
      ? `<div class="set-row"><div class="tx2"><b>SimpleFIN is connected</b><span>${S.sync.lastSync ? "Last synced " + esc(new Date(S.sync.lastSync).toLocaleString()) : "Not synced yet"}${S.sync.lastError ? ` · <span class="bad">${esc(S.sync.lastError)}</span>` : ""}</span></div><div class="btns"><button class="btn brand" data-act="sync">Sync banks now</button><button class="btn danger" data-act="sf-disconnect">Disconnect</button></div></div>`
      : `<p>Create a SimpleFIN Bridge account at <a href="https://beta-bridge.simplefin.org" target="_blank" rel="noopener">beta-bridge.simplefin.org</a>, link your banks there, then create a <b>setup token</b> and paste it here. The server trades it for a private access key that stays on your machine.</p>
         <form class="sfform" data-form="sf-connect"><input class="inp" id="sftoken" name="token" required placeholder="Paste your SimpleFIN setup token" autocomplete="off"><button class="btn brand">Connect</button></form>`;
  el.innerHTML = pageHead("Settings & sync", { range: false, noSync: true }) + `
  <div class="grid">
    <section class="card c7" id="sync"><div class="ch"><h2>Bank sync</h2><span class="sub">${SERVER ? "Server connected" : "Browser-only mode"}</span></div>${syncCard}</section>
    <section class="card c5">
      <div class="ch"><h2>Preferences</h2></div>
      <div class="set-row"><div class="tx2"><b>Currency</b></div><select id="cur" class="inp" data-change="currency">${[...new Set([S.settings.currency, ...CURRENCIES])].map(c => `<option ${c === S.settings.currency ? "selected" : ""}>${c}</option>`).join("")}</select></div>
      <div class="set-row"><div class="tx2"><b>Monthly savings goal</b></div><input id="goal2" class="inp num" type="number" min="0" step="50" value="${S.settings.savingsGoal || ""}" placeholder="0" data-change="goal" style="width:110px;text-align:right"></div>
      <div class="set-row"><div class="tx2"><b>Properties</b><span>Each gets its own page; only its net cash flow reaches your household numbers.</span></div><button class="btn" data-act="new-prop">Add property</button></div>
    </section>
    <section class="card c7">
      <div class="ch"><h2>Your data</h2></div>
      <div class="set-row"><div class="tx2"><b>Import transactions</b><span>CSV exports from any bank or card. Columns are matched automatically and duplicates are skipped.</span></div><button class="btn" data-act="import">Import CSV</button></div>
      <div class="set-row"><div class="tx2"><b>Back up everything</b><span>Accounts, transactions, budgets, rules and notes as one JSON file.</span></div><div class="btns"><button class="btn" data-act="export-json">Download</button><button class="btn" data-act="copy-json">Copy</button></div></div>
      <div class="set-row"><div class="tx2"><b>Restore a backup</b><span>Replaces everything here with the backup's contents.</span></div><label class="btn">Choose file<input type="file" accept=".json,application/json" id="restore" hidden></label></div>
      <div class="set-row"><div class="tx2"><b>Export transactions</b><span>A CSV for spreadsheets.</span></div><button class="btn" data-act="export-csv">Download CSV</button></div>
      <div class="set-row"><div class="tx2"><b>Summary for Claude</b><span>Copies a plain-text summary of the last three months to paste into a chat.</span></div><button class="btn" data-act="summary">Copy summary</button></div>
      <div class="set-row"><div class="tx2"><b>Start over</b><span>Deletes every account, transaction and budget${SERVER ? " on the server and in this browser" : " in this browser"}.</span></div><button class="btn danger" data-act="reset">Delete all data</button></div>
    </section>
    <section class="card c5">
      <div class="ch"><h2>Merchant rules</h2><span class="sub">${S.rules.length}</span></div>
      <p class="small muted note0">Made when you recategorize a transaction and apply it to the rest from that merchant. New imports and syncs follow these first.</p>
      ${S.rules.length ? `<div class="chips">${S.rules.map((r, i) => `<span class="chip">${esc(titleCase(r.key))} → ${esc(r.category)}${r.property && PM[r.property] ? " · " + esc(PM[r.property].name) : ""}<button data-act="del-rule" data-i="${i}" aria-label="Delete rule">×</button></span>`).join("")}</div>` : `<div class="small muted">No rules yet.</div>`}
    </section>
    <section class="card c12">
      <div class="ch"><h2>Groups and categories</h2><span class="sp"></span><button class="btn small" data-act="new-group">Add group</button><button class="btn small" data-act="new-cat">Add category</button></div>
      ${S.groups.map(g => { const cs = S.categories.filter(c => c.group === g.id); return `<div class="grp-h"><span class="dot" style="background:${colorVar(g.color)}"></span>${esc(g.name)}${g.id === "transfers" ? " · left out of income and spending" : g.id === "property" ? " · used on property pages" : ""}${["income", "other", "transfers", "property"].includes(g.id) || cs.length ? "" : ` <button class="linkbtn" data-act="del-group" data-id="${g.id}">Delete</button>`}</div>
        <div class="chips">${cs.map(c => `<span class="chip">${esc(c.emoji)} ${esc(c.name)}${c.kind !== "expense" && g.id !== "income" && g.id !== "transfers" ? ` <span class="muted small">${c.kind}</span>` : ""} <span class="muted small">${byCat[c.name] || 0}</span>${c.name === "Uncategorized" ? "" : `<button data-act="del-cat" data-name="${esc(c.name)}" aria-label="Delete ${esc(c.name)}">×</button>`}</span>`).join("") || `<span class="small muted">Empty</span>`}</div>`; }).join("")}
    </section>
  </div>`;
  $("#restore").addEventListener("change", e => { const f = e.target.files[0]; if (f) restoreBackup(f); e.target.value = ""; });
};
