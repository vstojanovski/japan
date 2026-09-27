"use strict";
/* ===================================================================
   Dialogs, import, bank sync, events and boot.
   =================================================================== */
let SERVER = null;           // { ok, simplefin } when server.mjs is serving this page
let serverSaveT = null, serverDirty = false;

async function api(method, url, body) {
  const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const txt = await res.text(); let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = { error: txt }; }
  if (!res.ok) throw new Error((data && data.error) || res.statusText || "Request failed");
  return data;
}
function save() {
  saveLocal();
  if (!SERVER) return;
  serverDirty = true; clearTimeout(serverSaveT);
  serverSaveT = setTimeout(async () => {
    try { await api("PUT", "api/state", S); serverDirty = false; }
    catch (e) { toast("Couldn't reach your server. Changes are kept in this browser until it's back."); }
  }, 600);
}
addEventListener("beforeunload", e => { if (serverDirty) { e.preventDefault(); e.returnValue = ""; } });

/* ---------- dialog plumbing ---------- */
const dlg = () => $("#dlg");
function openDlg(html, onSubmit, cls = "") {
  const d = dlg(); d.className = cls;
  d.innerHTML = `<form class="dlg" method="dialog" novalidate>${html}</form>`;
  const form = d.firstChild;
  form.addEventListener("submit", e => {
    e.preventDefault();
    if (e.submitter && e.submitter.value !== "delete" && !form.reportValidity()) return;
    const ok = onSubmit ? onSubmit(new FormData(form), e.submitter, form) : true;
    if (ok !== false) d.close();
  });
  $$("[data-close]", form).forEach(b => b.addEventListener("click", () => d.close()));
  if (!d.open) d.showModal();
  return form;
}
function askConfirm(title, body, okLabel, danger) {
  return new Promise(res => {
    let result = false;
    openDlg(`<h3>${esc(title)}</h3><p>${esc(body)}</p><div class="dlg-foot"><span class="sp"></span><button type="button" class="btn" data-close>Cancel</button><button class="btn ${danger ? "danger-fill" : "brand"}" value="ok">${esc(okLabel)}</button></div>`, () => { result = true; });
    dlg().addEventListener("close", () => res(result), { once: true });
  });
}
let toastT;
function toast(msg, actLabel, act) {
  const t = $("#toast");
  t.innerHTML = `<span>${esc(msg)}</span>${actLabel ? `<button type="button">${esc(actLabel)}</button>` : ""}`;
  t.hidden = false;
  if (actLabel) t.querySelector("button").onclick = () => { t.hidden = true; act(); };
  clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, actLabel ? 9000 : 3800);
}
const acctOptions = (sel, filter = () => true) => S.accounts.filter(filter).map(a => `<option value="${a.id}" ${a.id === sel ? "selected" : ""}>${esc(a.name)}</option>`).join("");
const propOptions = sel => `<option value="">None</option>` + S.properties.map(p => `<option value="${p.id}" ${p.id === sel ? "selected" : ""}>${esc(p.name)}</option>`).join("");
function adjustBalance(acctId, delta) { const a = AM[acctId]; if (a && !(a.snapshots && a.snapshots.length) && a.source !== "simplefin") a.balance = round2(a.balance + delta); }

/* ---------- transaction editor (with splits) ---------- */
function editTx(id) {
  const t = id ? S.transactions.find(x => x.id === id) : null;
  if (!t && !S.accounts.length) { toast("Add an account first."); location.hash = "#accounts"; return; }
  const d = t || { date: TODAY, desc: "", merchant: "", amount: "", category: "Uncategorized", account: S.accounts[0].id, notes: "", tags: [] };
  const kind = t ? (t.amount > 0 ? "in" : "out") : "out";
  let splits = t && isSplit(t) ? t.splits.map(s => ({ ...s })) : null;
  const splitRows = () => splits.map((s, i) => `<div class="splitrow"><select class="inp" data-split="${i}" data-f="category" aria-label="Split ${i + 1} category">${catOptions(s.category)}</select><input class="inp num" type="number" step="0.01" min="0" inputmode="decimal" data-split="${i}" data-f="amount" value="${Math.abs(s.amount) || ""}" aria-label="Split ${i + 1} amount"><button type="button" class="iconbtn" data-rm="${i}" aria-label="Remove split">×</button></div>`).join("");
  const form = openDlg(`<h3>${t ? esc(t.merchant) : "Add transaction"}</h3>
    ${t ? `<p class="small">${esc(dateShort(t.date))} · ${esc(acctName(t.account))}${t.desc !== t.merchant ? ` · <span title="As it appears on the statement">${esc(t.desc)}</span>` : ""}</p>` : ""}
    <div class="fields">
      <label class="field full"><span>Merchant</span><input class="inp" name="merchant" id="f-merchant" required value="${esc(d.merchant || d.desc)}"></label>
      <label class="field"><span>Amount</span><input class="inp num" name="amount" id="f-amt" type="number" step="0.01" min="0" required inputmode="decimal" value="${d.amount === "" ? "" : Math.abs(d.amount)}"></label>
      <label class="field"><span>Direction</span><select class="inp" name="kind" id="f-kind"><option value="out" ${kind === "out" ? "selected" : ""}>Money out</option><option value="in" ${kind === "in" ? "selected" : ""}>Money in</option></select></label>
      <label class="field"><span>Date</span><input class="inp" name="date" id="f-date" type="date" required value="${esc(d.date)}"></label>
      <label class="field"><span>Account</span><select class="inp" name="account" id="f-acct">${acctOptions(d.account)}</select></label>
      <div class="field full" id="catwrap" ${splits ? "hidden" : ""}><span>Category</span><div class="catline"><select class="inp" name="category" id="f-cat">${catOptions(d.category)}</select><button type="button" class="btn small" id="dosplit">Split</button></div></div>
      <div class="field full" id="splitwrap" ${splits ? "" : "hidden"}><span>Split between categories</span><div id="splits">${splits ? splitRows() : ""}</div>
        <div class="splitfoot"><button type="button" class="linkbtn" id="addsplit">+ Add a split</button><span id="splitleft" class="small"></span><button type="button" class="linkbtn" id="unsplit">Remove split</button></div></div>
      ${S.properties.length ? `<label class="field"><span>Property</span><select class="inp" name="property" id="f-prop">${propOptions(d.property)}</select></label>` : ""}
      <label class="field ${S.properties.length ? "" : "full"}"><span>Tags</span><input class="inp" name="tags" id="f-tags" value="${esc((d.tags || []).join(", "))}" placeholder="e.g. japan-trip, tax"></label>
      <label class="field full"><span>Notes</span><input class="inp" name="notes" id="f-notes" value="${esc(d.notes || "")}"></label>
      ${t ? `<label class="check"><input type="checkbox" name="reviewed" ${t.needsReview ? "" : "checked"}> Reviewed</label><label class="check"><input type="checkbox" name="hidden" ${t.hidden ? "checked" : ""}> Hide from reports</label>
      <label class="check full"><input type="checkbox" name="rule"> Always use this category${S.properties.length ? " and property" : ""} for ${esc(t.merchant)}</label>` : ""}
    </div>
    <div class="dlg-foot">${t ? `<button type="submit" class="btn danger" value="delete">Delete</button>` : ""}<span class="sp"></span><button type="button" class="btn" data-close>Cancel</button><button class="btn brand" value="save">${t ? "Save" : "Add"}</button></div>`,
  (fd, sub) => {
    if (sub && sub.value === "delete") {
      adjustBalance(t.account, -t.amount);
      S.transactions = S.transactions.filter(x => x !== t); commit(); toast("Transaction deleted"); return;
    }
    const sign = fd.get("kind") === "in" ? 1 : -1, amt = round2(sign * Math.abs(parseFloat(fd.get("amount")) || 0));
    let sp = null;
    if (splits) {
      sp = splits.filter(s => Math.abs(s.amount) > 0).map(s => ({ category: s.category, amount: round2(sign * Math.abs(s.amount)) }));
      const diff = round2(amt - sum(sp.map(s => s.amount)));
      if (Math.abs(diff) > 0.009) { toast(`The splits need to add up to ${money(Math.abs(amt), true)}. ${money(Math.abs(diff), true)} is left to assign.`); return false; }
      if (sp.length < 2) sp = null;
    }
    const next = {
      date: fd.get("date"), merchant: fd.get("merchant").trim(), amount: amt, account: fd.get("account"),
      category: sp ? sp[0].category : fd.get("category"), splits: sp || undefined, notes: fd.get("notes").trim(),
      tags: fd.get("tags").split(",").map(s => s.trim()).filter(Boolean), property: fd.get("property") || undefined
    };
    if (t) {
      adjustBalance(t.account, -t.amount);
      Object.assign(t, next); if (!sp) delete t.splits; if (!next.property) delete t.property;
      t.needsReview = !fd.get("reviewed"); t.hidden = !!fd.get("hidden");
      if (fd.get("rule")) {
        const key = merchantKey(t.desc); S.rules = S.rules.filter(r => r.key !== key); S.rules.push({ key, category: t.category, property: t.property });
        let n = 0; for (const x of S.transactions) if (x !== t && merchantKey(x.desc) === key && !isSplit(x)) { x.category = t.category; if (t.property) x.property = t.property; n++; }
        toast(`Saved. ${n} other ${t.merchant} transactions updated.`);
      } else toast("Saved");
    } else {
      S.transactions.push({ id: uid(), desc: next.merchant, ...next }); toast("Transaction added");
    }
    adjustBalance(next.account, amt);
    commit();
  });
  const refreshLeft = () => {
    if (!splits) return;
    const total = Math.abs(parseFloat($("#f-amt", form).value) || 0), used = sum(splits.map(s => Math.abs(+s.amount || 0))), left = round2(total - used);
    const el = $("#splitleft", form); el.textContent = Math.abs(left) < 0.01 ? "Fully assigned" : left > 0 ? `${money(left, true)} left to assign` : `${money(-left, true)} too much`;
    el.className = "small " + (Math.abs(left) < 0.01 ? "pos" : "bad");
  };
  const drawSplits = () => { $("#splits", form).innerHTML = splitRows(); refreshLeft(); };
  $("#dosplit", form).addEventListener("click", () => {
    const total = Math.abs(parseFloat($("#f-amt", form).value) || 0);
    splits = [{ category: $("#f-cat", form).value, amount: round2(total / 2) }, { category: "Uncategorized", amount: round2(total - round2(total / 2)) }];
    $("#catwrap", form).hidden = true; $("#splitwrap", form).hidden = false; drawSplits();
  });
  $("#addsplit", form).addEventListener("click", () => { splits.push({ category: "Uncategorized", amount: 0 }); drawSplits(); });
  $("#unsplit", form).addEventListener("click", () => { if (splits && splits[0]) $("#f-cat", form).value = splits[0].category; splits = null; $("#catwrap", form).hidden = false; $("#splitwrap", form).hidden = true; });
  $("#splits", form).addEventListener("input", e => { const i = e.target.dataset.split; if (i == null) return; splits[+i][e.target.dataset.f] = e.target.dataset.f === "amount" ? (parseFloat(e.target.value) || 0) : e.target.value; refreshLeft(); });
  $("#splits", form).addEventListener("change", e => { const i = e.target.dataset.split; if (i != null && e.target.dataset.f === "category") splits[+i].category = e.target.value; });
  $("#splits", form).addEventListener("click", e => { const b = e.target.closest("[data-rm]"); if (b) { splits.splice(+b.dataset.rm, 1); drawSplits(); } });
  $("#f-amt", form).addEventListener("input", refreshLeft);
  refreshLeft();
  if (!t) $("#f-merchant", form).addEventListener("change", e => {
    const amt = parseFloat($("#f-amt", form).value) || 1, sign = $("#f-kind", form).value === "in" ? 1 : -1;
    $("#f-cat", form).value = categorize(e.target.value, sign * amt);
  });
}

/* ---------- account, loan, property, category dialogs ---------- */
function editAcct(id, presetType) {
  const a = id ? AM[id] : null;
  const d = a || { name: "", type: presetType || "checking", balance: 0, org: "" };
  const n = a ? (txByAcct()[a.id] || []).length : 0;
  openDlg(`<h3>${a ? "Edit account" : "Add account"}</h3>
    <div class="fields">
      <label class="field"><span>Name</span><input class="inp" name="name" id="a-name" required value="${esc(d.name)}" placeholder="e.g. Joint Checking"></label>
      <label class="field"><span>Institution</span><input class="inp" name="org" id="a-org" value="${esc(d.org || "")}" placeholder="e.g. Chase"></label>
      <label class="field"><span>Type</span><select class="inp" name="type" id="a-type">${Object.entries(ACCT_TYPES).map(([k, v]) => `<option value="${k}" ${k === d.type ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label class="field"><span>Current balance</span><input class="inp num" name="balance" id="a-bal" type="number" step="0.01" inputmode="decimal" value="${Math.abs(d.balance || 0)}" ${a && a.source === "simplefin" ? 'readonly title="Updated by bank sync"' : ""}></label>
      <p class="full small">For cards and loans, enter what you owe as a positive number.${a && a.source === "simplefin" ? " This balance comes from your bank." : ""}</p>
    </div>
    <div class="dlg-foot">${a ? `<button type="submit" class="btn danger" value="delete">Delete</button>` : ""}<span class="sp"></span><button type="button" class="btn" data-close>Cancel</button><button class="btn brand" value="save">${a ? "Save" : "Add account"}</button></div>`,
  (fd, sub) => {
    if (sub && sub.value === "delete") {
      askConfirm(`Delete ${a.name}?`, n ? `This also deletes its ${n.toLocaleString()} transactions.` : "This can't be undone.", "Delete account", true).then(ok => {
        if (!ok) return; S.accounts = S.accounts.filter(x => x !== a); S.transactions = S.transactions.filter(t => t.account !== a.id);
        for (const p of S.properties) { if (p.valueAccount === a.id) delete p.valueAccount; if (p.loanAccount === a.id) delete p.loanAccount; }
        commit(); toast("Account deleted");
      });
      return;
    }
    const type = fd.get("type"), raw = Math.abs(parseFloat(fd.get("balance")) || 0), bal = round2(type === "credit" || type === "loan" ? -raw : raw);
    if (a) {
      a.name = fd.get("name").trim(); a.org = fd.get("org").trim(); a.type = type;
      if (a.source !== "simplefin") {
        if (a.snapshots || MANUAL_TYPES.includes(type)) { a.snapshots = (a.snapshots || []).filter(s => s.date !== TODAY); a.snapshots.push({ date: TODAY, balance: bal }); }
        a.balance = bal;
      }
    } else {
      const na = { id: uid(), name: fd.get("name").trim(), org: fd.get("org").trim(), type, balance: bal };
      if (MANUAL_TYPES.includes(type)) na.snapshots = [{ date: TODAY, balance: bal }];
      S.accounts.push(na);
    }
    commit(); toast(a ? "Account saved" : "Account added");
  });
}
function editLoan(id) {
  const a = AM[id]; if (!a) return; const L = a.loan || {};
  openDlg(`<h3>${esc(a.name)}</h3><p>Used to show payoff progress and estimate when it's paid off.</p>
    <div class="fields">
      <label class="field"><span>Interest rate (APR %)</span><input class="inp num" name="rate" id="l-rate" type="number" step="0.001" min="0" value="${L.rate ?? ""}"></label>
      <label class="field"><span>Monthly payment</span><input class="inp num" name="payment" id="l-pay" type="number" step="0.01" min="0" value="${L.payment ?? ""}"></label>
      <label class="field"><span>Original amount</span><input class="inp num" name="original" id="l-orig" type="number" step="1" min="0" value="${L.original ?? ""}"></label>
      <label class="field"><span>Balance owed</span><input class="inp num" name="balance" id="l-bal" type="number" step="0.01" min="0" value="${Math.abs(a.balance)}" ${a.source === "simplefin" ? "readonly" : ""}></label>
    </div>
    <div class="dlg-foot"><span class="sp"></span><button type="button" class="btn" data-close>Cancel</button><button class="btn brand">Save</button></div>`, fd => {
    a.loan = { rate: parseFloat(fd.get("rate")) || 0, payment: parseFloat(fd.get("payment")) || 0, original: parseFloat(fd.get("original")) || 0 };
    if (a.source !== "simplefin") { const b = -Math.abs(parseFloat(fd.get("balance")) || 0); if (b !== a.balance) { a.balance = b; a.snapshots = (a.snapshots || []).filter(s => s.date !== TODAY); a.snapshots.push({ date: TODAY, balance: b }); } }
    commit(); toast("Loan saved");
  });
}
function editProp(id) {
  const p = id ? PM[id] : null, d = p || { name: "", address: "", color: [1, 7, 8, 5, 4][S.properties.length % 5] };
  const n = p ? S.transactions.filter(t => t.property === p.id).length : 0;
  openDlg(`<h3>${p ? "Edit property" : "Add property"}</h3>
    <p>A property gets its own page with its income and costs. Your household cash flow only sees its net result.</p>
    <div class="fields">
      <label class="field"><span>Name</span><input class="inp" name="name" id="p-name" required value="${esc(d.name)}" placeholder="e.g. 412 Maple St"></label>
      <label class="field"><span>Note</span><input class="inp" name="address" id="p-addr" value="${esc(d.address || "")}" placeholder="City · Rental"></label>
      <label class="field"><span>Value account</span><select class="inp" name="valueAccount" id="p-val"><option value="">None</option>${acctOptions(d.valueAccount, a => a.type === "property")}</select></label>
      <label class="field"><span>Mortgage account</span><select class="inp" name="loanAccount" id="p-loan"><option value="">None</option>${acctOptions(d.loanAccount, a => a.type === "loan")}</select></label>
      <label class="field full"><span>Color</span><select class="inp" name="color" id="p-color">${[[1, "Blue"], [7, "Violet"], [8, "Red"], [5, "Pink"], [4, "Yellow"], [6, "Green"], [2, "Orange"], [3, "Aqua"]].map(([k, v]) => `<option value="${k}" ${+d.color === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <p class="full small">To track its value and equity, add a Real estate account (and a Loan for the mortgage) on the Accounts page, then pick them here.</p>
    </div>
    <div class="dlg-foot">${p ? `<button type="submit" class="btn danger" value="delete">Delete</button>` : ""}<span class="sp"></span><button type="button" class="btn" data-close>Cancel</button><button class="btn brand" value="save">${p ? "Save" : "Add property"}</button></div>`,
  (fd, sub) => {
    if (sub && sub.value === "delete") {
      askConfirm(`Delete ${p.name}?`, n ? `Its ${n} transactions stay, but go back to your household numbers.` : "It has no transactions.", "Delete property", true).then(ok => {
        if (!ok) return; S.properties = S.properties.filter(x => x !== p); for (const t of S.transactions) if (t.property === p.id) delete t.property;
        for (const r of S.rules) if (r.property === p.id) delete r.property; location.hash = "#overview"; commit();
      });
      return;
    }
    const v = { name: fd.get("name").trim(), address: fd.get("address").trim(), valueAccount: fd.get("valueAccount") || undefined, loanAccount: fd.get("loanAccount") || undefined, color: +fd.get("color") };
    if (p) Object.assign(p, v); else { const np = { id: uid(), ...v }; S.properties.push(np); location.hash = "#property-" + np.id; }
    commit(); toast(p ? "Property saved" : "Property added. Tag transactions to it from Transactions.");
  });
}
function newCat() {
  openDlg(`<h3>Add category</h3><div class="fields">
    <label class="field"><span>Name</span><input class="inp" name="name" id="c-name" required maxlength="40"></label>
    <label class="field"><span>Icon (an emoji)</span><input class="inp" name="emoji" id="c-emoji" maxlength="4" value="🏷️"></label>
    <label class="field"><span>Group</span><select class="inp" name="group" id="c-group">${S.groups.map(g => `<option value="${g.id}" ${g.id === "lifestyle" ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select></label>
    <label class="field"><span>Counts as</span><select class="inp" name="kind" id="c-kind"><option value="expense">Spending</option><option value="income">Income</option><option value="transfer">Transfer (left out)</option></select></label></div>
    <div class="dlg-foot"><span class="sp"></span><button type="button" class="btn" data-close>Cancel</button><button class="btn brand">Add category</button></div>`, fd => {
    const name = fd.get("name").trim();
    if (!name || CM[name]) { toast(name ? "That category already exists." : "Give the category a name."); return false; }
    let kind = fd.get("kind"); if (fd.get("group") === "income") kind = "income"; if (fd.get("group") === "transfers") kind = "transfer";
    S.categories.push({ name, emoji: fd.get("emoji").trim() || "🏷️", group: fd.get("group"), kind }); commit(); toast("Category added");
  });
}
function newGroup() {
  openDlg(`<h3>Add group</h3><p>Groups organize categories on the cash flow and spending pages.</p><div class="fields">
    <label class="field"><span>Name</span><input class="inp" name="name" id="g-name" required maxlength="40"></label>
    <label class="field"><span>Color</span><select class="inp" name="color" id="g-color"><option value="0">Gray</option>${[[1, "Blue"], [2, "Orange"], [3, "Aqua"], [4, "Yellow"], [5, "Pink"], [6, "Green"], [7, "Violet"], [8, "Red"]].map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label></div>
    <div class="dlg-foot"><span class="sp"></span><button type="button" class="btn" data-close>Cancel</button><button class="btn brand">Add group</button></div>`, fd => {
    const name = fd.get("name").trim(); if (!name) return false;
    const i = S.groups.findIndex(g => g.id === "property");
    S.groups.splice(i < 0 ? S.groups.length : i, 0, { id: uid(), name, color: +fd.get("color") }); commit(); toast("Group added");
  });
}
function moreSheet() {
  const cur = route(), nr = needsReview(), unc = uncategorizedCount();
  const item = (href, label, ic, b) => `<a href="${href}" class="sheet-i" ${("#" + cur.id) === href || (cur.id === "property" && href === "#property-" + cur.arg) ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span>${b || ""}</a>`;
  const f = openDlg(`<h3>More</h3><div class="sheet">
    ${item("#overview", "Overview", "overview")}${item("#budget", "Budget", "budget")}${item("#recurring", "Recurring", "recurring")}${item("#accounts", "Accounts", "accounts")}
    ${item("#loans", "Loans", "loans")}${item("#uncategorized", "Uncategorized", "uncategorized", badge(unc))}${item("#transactions", "Needs review", "transactions", badge(nr))}
    ${S.properties.map(p => item("#property-" + p.id, esc(p.name), "property")).join("")}${item("#settings", "Settings & sync", "settings")}</div>
    <div class="dlg-foot"><span class="sp"></span><button type="button" class="btn" data-close>Close</button></div>`, null, "sheetdlg");
  $$("a", f).forEach(a => a.addEventListener("click", () => { if (a.textContent.includes("Needs review")) UI.tx.tab = "review"; dlg().close(); }));
}

/* ---------- CSV import ---------- */
function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const first = text.split(/\r?\n/).find(l => l.trim()) || "";
  const delim = [",", ";", "\t", "|"].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows.map(r => r.map(x => x.trim())).filter(r => r.some(x => x !== ""));
}
function parseAmount(s) {
  s = String(s || "").trim(); if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || /-/.test(s) || /\bDR\b/i.test(s);
  s = s.replace(/[^\d.,]/g, ""); if (!s) return null;
  if (/,\d{1,2}$/.test(s) && !/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", "."); else s = s.replace(/,/g, "");
  const v = parseFloat(s); if (!isFinite(v)) return null;
  return neg ? -v : v;
}
function detectDateOrder(samples) {
  const ss = samples.filter(Boolean).map(s => String(s).split(/[ T]/)[0]);
  if (ss.length && ss.every(s => /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(s))) return "ymd";
  for (const s of ss) { const p = s.split(/[\/.\-]/).map(Number); if (p[0] > 12 && p[0] <= 31) return "dmy"; }
  if (ss.some(s => /^\d{1,2}\.\d{1,2}\.\d{2,4}/.test(s))) return "dmy";   // dotted dates are day-first everywhere
  return "mdy";
}
function parseDate(s, order) {
  s = String(s || "").trim().replace(/\.$/, ""); if (!s) return null;
  const p = s.split(/[ T]/)[0].split(/[\/.\-]/);
  let y, m, d;
  if (p.length === 3 && p.every(x => /^\d+$/.test(x))) {
    if (p[0].length === 4) [y, m, d] = p.map(Number);
    else if (order === "dmy") [d, m, y] = p.map(Number);
    else [m, d, y] = p.map(Number);
    if (y < 100) y += 2000;
  } else { const t = new Date(s); if (isNaN(t)) return null; y = t.getFullYear(); m = t.getMonth() + 1; d = t.getDate(); }
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 1970 && y < 2100)) return null;
  return y + "-" + pad(m) + "-" + pad(d);
}
// Column names in English and in Macedonian/Serbian/Croatian (Latin and Cyrillic).
const HDR = {
  date: /date|datum|датум|дата|valuta|валута|posted|knji[zž]|књиж/i,
  desc: /descr|payee|merchant|^name$|memo|details|narrative|opis|опис|namena|намена|namjena|svrha|сврха|цел на|primač|primalac|примач|корисник|korisnik|nalogoprim|налогоприм|назив|naziv|partner|партнер/i,
  amount: /amount|iznos|износ|^value$|сума|suma/i,
  debit: /debit|withdraw|money out|paid out|dolzi|dolži|должи|isplat|исплат|zadu[zž]|задолж|задуж|rashod|расход|odliv|одлив/i,
  credit: /credit(?! ?card)|deposit|money in|paid in|pobaruva|побарува|potra[zž]|uplat|уплат|odobr|одобр|priliv|прилив|prihod|приход/i,
  balance: /balance|saldo|салдо|stanje|состојба|состојба|стање/i,
  category: /category|kategorij|категориј/i
};
function guessColumns(header) {
  const h = header.map(x => String(x || ""));
  const find = (re, not) => h.findIndex(x => re.test(x) && !(not && not.test(x)));
  const amount = find(HDR.amount, new RegExp([HDR.debit.source, HDR.credit.source, HDR.balance.source].join("|"), "i"));
  return {
    date: find(HDR.date),
    desc: find(HDR.desc),
    amount,
    debit: amount >= 0 ? -1 : find(HDR.debit, HDR.balance),
    credit: amount >= 0 ? -1 : find(HDR.credit, HDR.balance),
    category: find(HDR.category)
  };
}

/* ---------- reading bank files: CSV, Excel (.xls/.xlsx, incl. HTML/XML "xls"), PDF ---------- */
const SCRIPTS = {};
function loadScript(src) {
  return SCRIPTS[src] ||= new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => { delete SCRIPTS[src]; rej(new Error("Couldn't load the file reader (" + src + ").")); }; document.head.appendChild(s); });
}
const readBuf = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsArrayBuffer(file); });
function decodeText(buf) {
  const head = new TextDecoder("latin1").decode(buf.slice(0, 4096));
  const cs = (head.match(/charset=["']?([\w-]+)/i) || head.match(/encoding=["']([\w-]+)/i) || [])[1];
  if (cs) { try { return new TextDecoder(cs.toLowerCase()).decode(buf); } catch (e) {} }
  const utf = new TextDecoder("utf-8").decode(buf);
  // Not valid UTF-8 → most likely an older Windows export (Cyrillic or Central European).
  if (utf.includes("�")) { try { const t = new TextDecoder("windows-1251").decode(buf); if (/[а-яА-Я]{3}/.test(t)) return t; return new TextDecoder("windows-1250").decode(buf); } catch (e) {} }
  return utf;
}
function sheetRows(wb) {
  let best = [];
  for (const n of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: "", blankrows: false });
    if (rows.length > best.length) best = rows;
  }
  return best.map(r => r.map(c => c instanceof Date ? ymd(new Date(c.getTime() + 12 * 3600e3)) : typeof c === "number" ? String(c) : String(c ?? "").replace(/\s+/g, " ").trim()))
    .filter(r => r.some(c => c !== ""));
}
async function readFileRows(file, password) {
  const buf = await readBuf(file), b = new Uint8Array(buf.slice(0, 8));
  const isPdf = b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;              // %PDF
  const isZip = b[0] === 0x50 && b[1] === 0x4b;                                                 // .xlsx
  const isOle = b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;               // classic .xls
  if (isPdf) { const rows = await readPdf(buf, password); return { rows, kind: "PDF", text: PDF_TEXT }; }
  if (isZip || isOle) {
    await loadScript("vendor/xlsx.full.min.js");
    return { rows: sheetRows(XLSX.read(new Uint8Array(buf), { type: "array", cellDates: true })), kind: "Excel" };
  }
  const text = decodeText(buf);
  if (/^\s*</.test(text)) {   // an "xls" that is really an HTML table or Excel 2003 XML
    await loadScript("vendor/xlsx.full.min.js");
    // raw: keep "58.400,00" and "02.09.2026" as text; our own parsers know they're European
    return { rows: sheetRows(XLSX.read(text, { type: "string", raw: true })), kind: "Excel" };
  }
  return { rows: parseCSV(text), kind: "CSV" };
}

const MONEY_RE = /^[-+−(]?\s?(\d{1,3}([.,'\s ]\d{3})+|\d+)[.,]\d{2}\)?-?$/;
const CUR_SUFFIX = /\s*(MKD|ДЕН|DEN|EUR|USD|RSD|HRK|BAM|ALL|€|\$|ден)\.?$/i;
const isMoney = s => MONEY_RE.test(String(s).trim().replace(CUR_SUFFIX, ""));
const DATE_TOKEN = /^(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})\.?/;
let PDF_TEXT = "";
async function readPdf(buf, password) {
  await loadScript("vendor/pdf.min.js");
  const lib = window.pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = new URL("vendor/pdf.worker.min.js", document.baseURI).href;
  const doc = await lib.getDocument({ data: new Uint8Array(buf), password, isEvalSupported: false }).promise;
  const lines = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const tc = await (await doc.getPage(n)).getTextContent();
    const items = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ x: i.transform[4], y: i.transform[5], w: i.width, h: Math.abs(i.transform[3]) || 8, s: i.str }));
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    let cur = null;
    for (const it of items) { if (!cur || Math.abs(cur.y - it.y) > Math.max(2, it.h * 0.45)) { cur = { page: n, y: it.y, items: [] }; lines.push(cur); } cur.items.push(it); }
  }
  if (!lines.length) throw Object.assign(new Error("This PDF has no text in it (it's probably a scan), so it can't be read. Try the .xls export instead."), { friendly: true });
  // Merge each line's text pieces into cells, splitting where there's a visible gap.
  for (const l of lines) {
    l.items.sort((a, b) => a.x - b.x);
    const cells = [];
    for (const it of l.items) {
      const last = cells[cells.length - 1], gap = last ? it.x - last.x1 : 99;
      if (last && gap < Math.max(4, it.h * 0.8)) { last.text += (gap > it.h * 0.12 ? " " : "") + it.s; last.x1 = it.x + it.w; }
      else cells.push({ x0: it.x, x1: it.x + it.w, text: it.s });
    }
    for (const c of cells) c.text = c.text.replace(/\s+/g, " ").trim();
    // "15.09.2026 PLATA" in one piece → split the date off
    const m = cells[0] && cells[0].text.match(DATE_TOKEN);
    if (m && cells[0].text.length > m[0].length + 1) { const rest = cells[0].text.slice(m[0].length).trim(); cells[0].text = m[0]; cells.splice(1, 0, { x0: cells[0].x0 + 1, x1: cells[0].x1, text: rest }); }
    l.cells = cells.filter(c => c.text);
  }
  PDF_TEXT = lines.slice(0, 80).map(l => l.cells.map(c => c.text).join(" ")).join("\n");
  const isTx = l => l.cells.length >= 2 && DATE_TOKEN.test(l.cells[0].text) && l.cells.some(c => isMoney(c.text));
  const hdr = lines.find(l => l.cells.length >= 3 && l.cells.some(c => HDR.date.test(c.text)) && l.cells.some(c => HDR.desc.test(c.text) || HDR.amount.test(c.text) || HDR.debit.test(c.text) || HDR.credit.test(c.text)));
  const txLines = lines.filter(isTx);
  if (!txLines.length) throw Object.assign(new Error("Couldn't find any transactions in this PDF. If it's a statement, try the .xls export instead."), { friendly: true });
  let header, rows = [];
  if (hdr) {
    const cols = hdr.cells.map(c => ({ name: c.text, x0: c.x0, x1: c.x1, xc: (c.x0 + c.x1) / 2 }));
    const g = guessColumns(cols.map(c => c.name));
    const place = c => {
      // numbers are usually right-aligned under their heading, text left-aligned
      let best = 0, bestD = Infinity;
      cols.forEach((col, i) => {
        const d = isMoney(c.text) ? Math.min(Math.abs(c.x1 - col.x1), Math.abs((c.x0 + c.x1) / 2 - col.xc)) : Math.min(Math.abs(c.x0 - col.x0), Math.abs((c.x0 + c.x1) / 2 - col.xc));
        if (d < bestD) { bestD = d; best = i; }
      });
      return best;
    };
    header = cols.map(c => c.name);
    const descCol = g.desc >= 0 ? g.desc : 1;
    const sameAsHeader = l => l === hdr || (l.cells.length >= 3 && l.cells.map(c => c.text).join("|") === hdr.cells.map(c => c.text).join("|"));
    const TOTALS = /вкупно|total|saldo|салдо|состојба|стање|stanje|promet|промет|почетна|крајна|pocetn|krajn|opening|closing|страна|strana|page \d/i;
    const byTx = new Map();
    for (const l of txLines) { const row = header.map(() => ""); for (const c of l.cells) { const i = place(c); row[i] = row[i] ? row[i] + " " + c.text : c.text; } byTx.set(l, { row, extra: [] }); rows.push(row); }
    // Wrapped descriptions: a text-only line belongs to the closest transaction on its page
    // (banks put the date on the first line, the last line, or vertically centred).
    for (const l of lines) {
      if (byTx.has(l) || sameAsHeader(l) || l.cells.some(c => isMoney(c.text)) || l.cells.some(c => TOTALS.test(c.text))) continue;
      let best = null, bestD = Infinity;
      for (const t of txLines) if (t.page === l.page) { const d = Math.abs(t.y - l.y); if (d < bestD) { bestD = d; best = t; } }
      const lh = best ? Math.max(8, ...best.items.map(i => i.h)) : 10;
      if (best && bestD <= 2.4 * lh) byTx.get(best).extra.push(l);
    }
    for (const [t, { row, extra }] of byTx) {
      if (!extra.length) continue;
      const parts = [...extra, t].sort((a, b) => b.y - a.y).map(l => l === t ? row[descCol] : l.cells.map(c => c.text).join(" "));
      row[descCol] = parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    }
  } else {
    let maxN = 0;
    for (const l of txLines) {
      const nums = l.cells.slice(1).filter(c => isMoney(c.text)).map(c => c.text), text = l.cells.slice(1).filter(c => !isMoney(c.text)).map(c => c.text).join(" ");
      maxN = Math.max(maxN, nums.length); rows.push([l.cells[0].text, text, ...nums]);
    }
    header = ["Date", "Description", ...Array.from({ length: maxN }, (_, i) => i === 0 ? "Amount" : i === maxN - 1 && maxN > 1 ? "Balance" : "Amount " + (i + 1))];
  }
  return [header, ...rows];
}

let IMP = null;
function importDlg() {
  const form = openDlg(`<h3>Import transactions</h3>
    <p>Download your transactions or statement from your bank's website, then choose the file here.${SERVER ? "" : " Nothing leaves this browser."}</p>
    <label class="dropzone" id="dz"><b>Choose a CSV, Excel (.xls, .xlsx) or PDF file</b> or drop it here<input type="file" id="csvfile" accept=".csv,.txt,.tsv,.xls,.xlsx,.htm,.html,.pdf,text/csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>
    <div id="impbody"></div>
    <div class="dlg-foot"><span class="sp"></span><button type="button" class="btn" data-close>Cancel</button><button class="btn brand" id="impgo" disabled>Import</button></div>`, () => doImport(), "wide");
  const dz = $("#dz", form);
  const take = async (file, password) => {
    const body = $("#impbody");
    body.innerHTML = `<p class="muted">Reading ${esc(file.name)}…</p>`; $("#impgo").disabled = true;
    try {
      const { rows, kind, text } = await readFileRows(file, password);
      setupImport(rows, file.name, kind, text);
    } catch (e) {
      if (e && e.name === "PasswordException") {
        body.innerHTML = `<p>${password ? "That password didn't work. " : ""}This PDF is protected with a password. Banks often use something like your date of birth or ID number.</p>
          <div class="sfform"><input class="inp" type="password" id="pdfpw" placeholder="PDF password" autocomplete="off"><button type="button" class="btn" id="pdfgo">Open</button></div>`;
        const go = () => take(file, $("#pdfpw").value);
        $("#pdfgo").addEventListener("click", go); $("#pdfpw").addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); go(); } });
        $("#pdfpw").focus(); return;
      }
      body.innerHTML = `<p class="bad">${esc(e && e.friendly ? e.message : "Couldn't read that file: " + ((e && e.message) || e))}</p>`;
    }
  };
  $("#csvfile", form).addEventListener("change", e => e.target.files[0] && take(e.target.files[0]));
  dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("drag"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("drag"));
  dz.addEventListener("drop", e => { e.preventDefault(); dz.classList.remove("drag"); const f = e.dataTransfer.files[0]; if (f) take(f); });
}
function setupImport(rows, fname, kind = "CSV", extraText = "") {
  rows = rows.map(r => r.map(c => String(c ?? "").trim()));
  if (rows.length < 2) { $("#impbody").innerHTML = `<p class="bad">That file has no rows we can read. Check that it's a list of transactions.</p>`; return; }
  const hi = rows.slice(0, 40).findIndex(r => r.some(c => HDR.date.test(c)) && r.filter(Boolean).length >= 3);
  let header, data;
  if (hi >= 0) { header = rows[hi].map((h, i) => h || "Column " + (i + 1)); data = rows.slice(hi + 1); } else { header = rows[0].map((_, i) => "Column " + (i + 1)); data = rows; }
  data = data.filter(r => r.filter(Boolean).length >= 2);
  const width = Math.max(header.length, ...data.slice(0, 50).map(r => r.length));
  while (header.length < width) header.push("Column " + (header.length + 1));
  const g = guessColumns(header);
  const sample = data.slice(0, 30);
  const dateLike = i => sample.filter(r => parseDate(r[i], "dmy") || parseDate(r[i], "mdy")).length >= Math.max(1, sample.length * 0.6);
  if (g.date < 0 || !dateLike(g.date)) { const i = header.findIndex((_, i) => dateLike(i)); if (i >= 0) g.date = i; }
  if (g.amount < 0 && g.debit < 0 && g.credit < 0) g.amount = header.findIndex((h, i) => i !== g.date && !HDR.balance.test(h) && sample.filter(r => parseAmount(r[i]) != null).length >= sample.length * 0.8);
  if (g.desc < 0) g.desc = header.findIndex((_, i) => i !== g.date && i !== g.amount && sample.some(r => /\p{L}{3}/u.test(r[i] || "")));
  const order = detectDateOrder(data.slice(0, 40).map(r => r[g.date]));
  const amts = g.amount >= 0 ? data.map(r => parseAmount(r[g.amount])).filter(v => v != null) : [];
  const mostlyPos = amts.length > 3 && amts.filter(v => v > 0).length / amts.length > 0.85;
  const guessName = fname.replace(/\.(csv|txt|tsv|xlsx?|pdf|html?)$/i, "").replace(/[_-]+/g, " ").replace(/\d{4,}/g, "").trim().slice(0, 40) || "Imported account";
  const guessType = /card|visa|amex|mastercard|credit|kartic|картич/i.test(fname) || mostlyPos ? "credit" : "checking";
  const blob = rows.slice(0, 60).flat().join(" ") + " " + extraText;
  const mkd = S.settings.currency !== "MKD" && /\bMKD\b|\bден\b|денар|\bdenar/i.test(blob);
  IMP = { header, data };
  const opt = (sel, none) => (none ? `<option value="-1">— none —</option>` : "") + header.map((h, i) => `<option value="${i}" ${i === sel ? "selected" : ""}>${esc(h)}</option>`).join("");
  const real = S.settings.demo ? [] : S.accounts;
  $("#impbody").innerHTML = `
    <p class="small muted">Read as ${esc(kind)} · ${data.length.toLocaleString()} rows. Check the columns below, then the preview.</p>
    <div class="fields">
      <label class="field"><span>Into account</span><select class="inp" id="i-acct"><option value="__new">New account…</option>${real.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select></label>
      <label class="field" id="i-newwrap"><span>New account name</span><input class="inp" id="i-newname" value="${esc(titleCase(guessName.toLowerCase()))}"></label>
      <label class="field" id="i-typewrap"><span>Account type</span><select class="inp" id="i-type">${Object.entries(ACCT_TYPES).map(([k, v]) => `<option value="${k}" ${k === guessType ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label class="field"><span>Current balance (optional)</span><input class="inp num" id="i-bal" type="number" step="0.01" inputmode="decimal" placeholder="From your bank's site"></label>
      <label class="field"><span>Date column</span><select class="inp" id="i-date">${opt(g.date)}</select></label>
      <label class="field"><span>Date format</span><select class="inp" id="i-order"><option value="dmy" ${order === "dmy" ? "selected" : ""}>Day/Month/Year</option><option value="mdy" ${order === "mdy" ? "selected" : ""}>Month/Day/Year</option><option value="ymd" ${order === "ymd" ? "selected" : ""}>Year-Month-Day</option></select></label>
      <label class="field"><span>Description column</span><select class="inp" id="i-desc">${opt(g.desc)}</select></label>
      <label class="field"><span>Category column</span><select class="inp" id="i-cat">${opt(g.category, true)}</select></label>
      <label class="field"><span>Amount column</span><select class="inp" id="i-amt">${opt(g.amount, true)}</select></label>
      <label class="field"><span>Or: money out / money in</span><span class="pair"><select class="inp" id="i-deb" aria-label="Money out column">${opt(g.debit, true)}</select><select class="inp" id="i-cred" aria-label="Money in column">${opt(g.credit, true)}</select></span></label>
      ${S.properties.length && !S.settings.demo ? `<label class="field"><span>Property (optional)</span><select class="inp" id="i-prop">${propOptions("")}</select></label>` : ""}
      <label class="check full"><input type="checkbox" id="i-flip" ${mostlyPos ? "checked" : ""}> Purchases are positive numbers in this file (common for credit cards)</label>
      ${mkd ? `<label class="check full"><input type="checkbox" id="i-mkd" checked> Show amounts in Macedonian denars (MKD)</label>` : ""}
    </div>
    <div class="tbl-wrap preview"><table id="i-prev"></table></div>`;
  const body = $("#impbody");
  const sync = () => {
    const isNew = $("#i-acct").value === "__new";
    $("#i-newwrap").hidden = !isNew; $("#i-typewrap").hidden = !isNew;
    const rows = importRows(), ok = rows.filter(r => r.ok), bad = rows.filter(r => !r.ok && !r.skip), skipped = rows.length - ok.length - bad.length;
    const show = ok.slice(0, 6).concat(bad.slice(0, 2));
    $("#i-prev").innerHTML = `<thead><tr><th>Date</th><th>Merchant</th><th>Category</th><th>Amount</th></tr></thead><tbody>${show.map(r => r.ok
      ? `<tr><td>${esc(r.date)}</td><td>${esc(cleanMerchant(r.desc).slice(0, 34))}</td><td>${esc(r.category)}</td><td>${esc(signed(r.amount))}</td></tr>`
      : `<tr><td colspan="4" class="bad" style="text-align:left;white-space:normal">Can't read row: ${esc(r.raw.filter(Boolean).join(" · ").slice(0, 90))}</td></tr>`).join("")}</tbody>
      <caption>${ok.length.toLocaleString()} transactions ready${bad.length ? ` · ${bad.length} rows with a date but no readable amount` : ""}${skipped ? ` · ${skipped} other rows (headings, totals) left out` : ""}</caption>`;
    $("#impgo").disabled = !ok.length;
    $("#impgo").textContent = ok.length ? `Import ${ok.length.toLocaleString()} transactions` : "Import";
  };
  body.addEventListener("change", sync); body.addEventListener("input", e => { if (e.target.id !== "i-newname") sync(); });
  sync();
}
function importRows() {
  const v = id => +$(id).value, order = $("#i-order").value, flip = $("#i-flip").checked;
  const di = v("#i-date"), de = v("#i-desc"), ai = v("#i-amt"), bi = v("#i-deb"), ci = v("#i-cred"), ki = v("#i-cat");
  const catByLower = {}; for (const c of S.categories) catByLower[c.name.toLowerCase()] = c.name;
  const num = x => parseAmount(String(x || "").replace(CUR_SUFFIX, ""));
  return IMP.data.map(r => {
    const date = parseDate(r[di], order), desc = String(r[de] || "").replace(/\s+/g, " ").trim();
    if (!date) return { ok: false, skip: true, raw: r };
    let amount = null;
    if (ai >= 0) { amount = num(r[ai]); if (amount != null && flip) amount = -amount; }
    else if (bi >= 0 || ci >= 0) { const o = bi >= 0 ? num(r[bi]) : null, i = ci >= 0 ? num(r[ci]) : null; if (o != null || i != null) amount = Math.abs(i || 0) - Math.abs(o || 0); }
    if (amount == null || !desc) return { ok: false, raw: r };
    if (Math.abs(amount) < 0.005) return { ok: false, skip: true, raw: r };
    amount = round2(amount);
    const given = ki >= 0 ? catByLower[String(r[ki] || "").toLowerCase()] : null;
    return { ok: true, date, desc, amount, category: given || categorize(desc, amount) };
  });
}
function leaveDemo() { if (!S.settings.demo) return; const keep = S.settings; S = emptyState(); S.settings = { ...keep, demo: false, savingsGoal: 0 }; rebuild(); }
function doImport() {
  const rows = importRows().filter(r => r.ok);
  if (!rows.length) return false;
  const acctSel = $("#i-acct").value, balRaw = $("#i-bal").value, prop = $("#i-prop") ? $("#i-prop").value : "";
  const newName = $("#i-newname").value.trim() || "Imported account", newType = $("#i-type").value;
  const toMKD = $("#i-mkd") && $("#i-mkd").checked;
  leaveDemo();
  if (toMKD) { S.settings.currency = "MKD"; setFormatters(); }
  let acct = acctSel !== "__new" ? AM[acctSel] : null;
  if (!acct) { acct = { id: uid(), name: newName, type: newType, balance: 0, source: "csv" }; S.accounts.push(acct); }
  const seen = {}, keyOf = t => t.date + "|" + t.amount.toFixed(2) + "|" + merchantKey(t.desc);
  for (const t of S.transactions) if (t.account === acct.id) { const k = keyOf(t); seen[k] = (seen[k] || 0) + 1; }
  let added = 0, skipped = 0, flow = 0;
  for (const r of rows) {
    const k = keyOf(r);
    if (seen[k] > 0) { seen[k]--; skipped++; continue; }
    const t = newTx({ date: r.date, desc: r.desc, amount: r.amount, category: r.category, account: acct.id, needsReview: true });
    if (prop) t.property = prop;
    S.transactions.push(t); added++; flow += r.amount;
  }
  if (balRaw !== "") { const b = Math.abs(parseFloat(balRaw) || 0); acct.balance = round2(isLiability(acct) ? -b : b); }
  else acct.balance = round2((acct.balance || 0) + flow);
  delete acct.snapshots;
  const last = rows.map(r => r.date).sort().pop();
  if (last) { UI.month = last.slice(0, 7); if (last.slice(0, 7) < UI.range.from || last.slice(0, 7) > UI.range.to) setPreset("12m"); }
  commit();
  const unc = rows.filter(r => r.category === "Uncategorized").length;
  toast(`Imported ${added.toLocaleString()} transactions${skipped ? `, skipped ${skipped} duplicates` : ""}.${unc ? ` ${unc} need a category.` : ""}`, "Review", () => { UI.tx.tab = "review"; location.hash = "#transactions"; });
}

/* ---------- SimpleFIN sync (through server.mjs) ---------- */
function guessAcctType(a) {
  const n = (a.name + " " + (a.org && a.org.name || "")).toLowerCase(), b = parseFloat(a.balance);
  if (/401|403b|ira\b|roth|retire|pension|tsp/.test(n)) return "retirement";
  if (/mortgage|loan|heloc|auto fin|student/.test(n)) return "loan";
  if (/credit|card|visa|mastercard|amex|sapphire|freedom|discover/.test(n)) return "credit";
  if (/brokerage|invest|individual|stock|crypto|hsa/.test(n) || (a.holdings && a.holdings.length)) return "investment";
  if (/saving|money market|\bcd\b/.test(n)) return "savings";
  if (b < 0) return "credit";
  return "checking";
}
async function syncBanks() {
  const btns = $$('[data-act="sync"]'); btns.forEach(b => { b.disabled = true; b.textContent = "Syncing…"; });
  const before = JSON.stringify(S);
  try {
    const since = S.sync.lastSync && !S.sync.sample ? Math.floor(new Date(S.sync.lastSync).getTime() / 1000) - 14 * 86400 : Math.floor(Date.now() / 1000) - 90 * 86400;
    const res = await api("POST", "api/simplefin/sync", { start: since });
    leaveDemo();
    const known = new Set(S.transactions.map(t => t.externalId).filter(Boolean));
    let newAccts = 0, added = 0, updated = 0;
    for (const sa of res.accounts || []) {
      let a = S.accounts.find(x => x.externalId === sa.id);
      if (!a) { a = { id: uid(), externalId: sa.id, name: sa.name, org: sa.org && sa.org.name || "", type: guessAcctType(sa), source: "simplefin", balance: 0 }; S.accounts.push(a); AM[a.id] = a; newAccts++; }
      a.balance = round2(parseFloat(sa.balance) || 0);
      if (isLiability(a) && a.balance > 0 && a.type === "loan") a.balance = -a.balance;
      a.balanceDate = sa["balance-date"];
      if (MANUAL_TYPES.includes(a.type) && !(sa.transactions || []).length) { a.snapshots = (a.snapshots || []).filter(s => s.date !== TODAY); a.snapshots.push({ date: TODAY, balance: a.balance }); }
      for (const st of sa.transactions || []) {
        const date = ymd(new Date(((st.transacted_at || st.posted) || Date.now() / 1000) * 1000));
        if (known.has(st.id)) {
          const t = S.transactions.find(x => x.externalId === st.id);
          if (t && t.pending && !st.pending) { t.pending = false; t.amount = round2(parseFloat(st.amount)); t.date = date; updated++; }
          continue;
        }
        const desc = (st.description || st.payee || "Unknown").trim();
        const t = newTx({ externalId: st.id, date, desc, amount: round2(parseFloat(st.amount) || 0), account: a.id, needsReview: true });
        if (st.payee) t.merchant = cleanMerchant(st.payee);
        if (st.pending) t.pending = true;
        if (st.memo) t.notes = st.memo;
        S.transactions.push(t); known.add(st.id); added++;
      }
    }
    S.sync.lastSync = new Date().toISOString(); delete S.sync.sample;
    const errs = (res.errors || []).concat(res.errlist || []).map(e => typeof e === "string" ? e : e.msg || JSON.stringify(e));
    S.sync.lastError = errs.length ? errs.join(" · ").slice(0, 300) : undefined;
    commit();
    toast(`Synced ${(res.accounts || []).length} accounts · ${added} new transactions${newAccts ? ` · ${newAccts} new accounts` : ""}${updated ? ` · ${updated} settled` : ""}${errs.length ? ". Your bank reported: " + errs[0] : ""}`, added ? "Review" : null, () => { UI.tx.tab = "review"; location.hash = "#transactions"; });
  } catch (e) {
    S = JSON.parse(before); rebuild();   // leave everything as it was
    S.sync.lastError = e.message; save(); render();
    toast("Sync failed: " + e.message);
    btns.forEach(b => { b.disabled = false; b.textContent = "Sync banks"; });
  }
}

/* ---------- export, backup, summary ---------- */
function download(name, text, type) {
  try {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) { showText(name, text); }
}
function showText(title, text) {
  const form = openDlg(`<h3>${esc(title)}</h3><p>Select all and copy.</p><textarea class="note-ta mono" id="txtout" readonly>${esc(text)}</textarea><div class="dlg-foot"><span class="sp"></span><button class="btn brand">Done</button></div>`);
  const ta = $("#txtout", form); ta.focus(); ta.select();
}
function copyText(text, label) {
  const fallback = () => showText(label, text);
  try { navigator.clipboard.writeText(text).then(() => toast(label + " copied"), fallback); } catch (e) { fallback(); }
}
const csvEscape = v => { v = String(v ?? ""); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
function exportCSV() {
  const rows = [["Date", "Merchant", "Statement description", "Amount", "Category", "Account", "Property", "Tags", "Notes"]];
  for (const t of [...S.transactions].sort((a, b) => a.date < b.date ? 1 : -1)) for (const l of linesOf(t))
    rows.push([t.date, t.merchant, t.desc, l.amount.toFixed(2), l.category, acctName(t.account), t.property && PM[t.property] ? PM[t.property].name : "", (t.tags || []).join(" "), t.notes || ""]);
  download(`kakeibo-transactions-${TODAY}.csv`, rows.map(r => r.map(csvEscape).join(",")).join("\n"), "text/csv");
}
function restoreBackup(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const st = JSON.parse(r.result);
      if (!st || !Array.isArray(st.transactions) || !Array.isArray(st.accounts)) throw new Error("shape");
      askConfirm("Restore this backup?", `It has ${st.accounts.length} accounts and ${st.transactions.length.toLocaleString()} transactions, and replaces everything here.`, "Restore").then(ok => {
        if (!ok) return; S = st.version === 2 ? normalize(st) : migrateV1(st); setFormatters(); commit(); toast("Backup restored");
      });
    } catch (e) { toast("That file isn't a Kakeibo backup."); }
  };
  r.readAsText(file);
}
function summaryText() {
  const L = [], ym = UI.month, months = [addMonths(ym, -2), addMonths(ym, -1), ym];
  L.push(`# Household finance summary (as of ${TODAY}, currency ${S.settings.currency})`, "", `Net worth: ${money(netWorth())}`);
  for (const g of TYPE_GROUPS) { const as = S.accounts.filter(a => g.types.includes(a.type)); if (as.length) L.push(`- ${g.name}: ${money(sum(as.map(a => a.balance)))} (${as.map(a => a.name).join(", ")})`); }
  L.push("", "## Cash flow (properties count only as their net)", "| Month | Income | Spending | Saved |", "|---|---|---|---|");
  for (const m of months) { const x = summarize(m, m); L.push(`| ${monthName(m)}${m === CUR_MONTH ? " (in progress)" : ""} | ${money(x.income)} | ${money(x.expense)} | ${money(x.income - x.expense)} |`); }
  L.push("", "## Spending by category", `| Category | ${months.map(monthShort).join(" | ")} | Budget |`, "|---|" + months.map(() => "---|").join("") + "---|");
  const Rs = months.map(m => summarize(m, m)), keys = new Set(Rs.flatMap(R => Object.keys(R.cat)));
  for (const k of [...keys].sort((a, b) => sum(Rs.map(R => R.cat[b] || 0)) - sum(Rs.map(R => R.cat[a] || 0)))) {
    const i = keyInfo(k, "cat"); L.push(`| ${i.name}${i.sub ? " (" + i.sub + ")" : ""} | ${Rs.map(R => money(R.cat[k] || 0)).join(" | ")} | ${S.budgets[k] ? money(S.budgets[k]) : "—"} |`);
  }
  for (const p of S.properties) { const x = summarize(months[0], ym, p.id); L.push("", `## ${p.name} (last 3 months)`, `Income ${money(x.income)}, expenses ${money(x.expense)}, net ${money(x.income - x.expense)}`); }
  const loans = S.accounts.filter(a => a.type === "loan");
  if (loans.length) { L.push("", "## Loans"); for (const a of loans) L.push(`- ${a.name}: ${money(-a.balance)} owed${a.loan && a.loan.rate ? ` at ${a.loan.rate}%` : ""}${a.loan && a.loan.payment ? `, ${money(a.loan.payment)}/mo` : ""}`); }
  const rec = RECUR.filter(r => r.amount < 0);
  if (rec.length) { L.push("", "## Recurring charges"); for (const r of rec) L.push(`- ${r.name}: ${money(-r.amount, true)} ${r.freq.label.toLowerCase()} (${r.category})`); }
  if (S.settings.savingsGoal) L.push("", `Monthly savings goal: ${money(S.settings.savingsGoal)}`);
  if (S.notes[ym]) L.push("", `My notes for ${monthName(ym)}: ${S.notes[ym]}`);
  L.push("", "Questions I'd like help with: where can I cut back, am I on track with my savings goal, and does anything look unusual?");
  return L.join("\n");
}

/* ===================================================================
   Events
   =================================================================== */
function commit() { invalidate(); save(); render(); }
function togglePick(list, key, max = 4) { const i = list.indexOf(key); if (i >= 0) list.splice(i, 1); else { list.push(key); if (list.length > max) list.shift(); } }
function bulk(fn, msg) { const ids = UI.tx.sel; let n = 0; for (const t of S.transactions) if (ids.has(t.id)) { fn(t); n++; } ids.clear(); commit(); toast(msg(n)); }
const ACT = {
  month: b => { const n = addMonths(UI.month, +b.dataset.d); if (n <= CUR_MONTH) { UI.month = n; render(); } },
  "range-shift": b => { shiftRange(+b.dataset.d); UI.tx.sel.clear(); render(); },
  import: () => importDlg(),
  "clear-demo": () => askConfirm("Start with an empty ledger?", "The sample household goes away. Categories stay.", "Start empty", true).then(ok => {
    if (!ok) return; S = emptyState(); setFormatters(); commit(); toast("Sample data cleared. Connect banks, import a CSV or add an account to begin.");
  }),
  more: () => moreSheet(),
  "edit-tx": (b, e) => { if (e.target.closest(".cb, select, a")) return; editTx(b.dataset.id); },
  "new-tx": () => editTx(null),
  "more-tx": () => { UI.tx.limit += 200; renderTxList(); },
  "tx-tab": b => { UI.tx.tab = b.dataset.v; UI.tx.sel.clear(); if (route().id === "uncategorized" && b.dataset.v !== "uncategorized") { location.hash = "#transactions"; return; } if (route().id === "transactions") { $$('[data-act="tx-tab"]').forEach(x => x.setAttribute("aria-pressed", x.dataset.v === UI.tx.tab)); renderTxList(); } else { location.hash = "#transactions"; } },
  "bulk-review": () => bulk(t => { t.needsReview = false; }, n => `Marked ${n} as reviewed`),
  "bulk-hide": () => { const unhide = UI.tx.tab === "hidden"; bulk(t => { t.hidden = !unhide; }, n => `${unhide ? "Unhid" : "Hid"} ${n} transactions`); },
  "bulk-del": () => askConfirm(`Delete ${UI.tx.sel.size} transactions?`, "This can't be undone.", "Delete", true).then(ok => { if (!ok) return; const ids = UI.tx.sel; for (const t of S.transactions) if (ids.has(t.id)) adjustBalance(t.account, -t.amount); S.transactions = S.transactions.filter(t => !ids.has(t.id)); const n = ids.size; ids.clear(); commit(); toast(`Deleted ${n}`); }),
  "bulk-clear": () => { UI.tx.sel.clear(); renderTxList(); },
  "edit-acct": (b, e) => { e.stopPropagation(); editAcct(b.dataset.id); },
  "new-acct": b => editAcct(null, b.dataset.type),
  "edit-loan": b => editLoan(b.dataset.id),
  "new-prop": () => editProp(null),
  "edit-prop": b => editProp(b.dataset.id),
  "prop-tx": b => { Object.assign(UI.tx, { tab: "all", property: b.dataset.id, category: "", account: "", q: "", tag: "", type: "" }); location.hash = "#transactions"; },
  "new-cat": () => newCat(),
  "new-group": () => newGroup(),
  "del-group": b => { S.groups = S.groups.filter(g => g.id !== b.dataset.id); commit(); },
  "del-cat": b => {
    const name = b.dataset.name, n = S.transactions.filter(t => linesOf(t).some(l => l.category === name)).length;
    askConfirm(`Delete ${name}?`, n ? `${n.toLocaleString()} transactions move to Uncategorized.` : "It isn't used by any transactions.", "Delete category", true).then(ok => {
      if (!ok) return;
      S.categories = S.categories.filter(c => c.name !== name);
      for (const t of S.transactions) { if (t.category === name) t.category = "Uncategorized"; for (const s of t.splits || []) if (s.category === name) s.category = "Uncategorized"; }
      delete S.budgets[name]; S.rules = S.rules.filter(r => r.category !== name); commit();
    });
  },
  "del-rule": b => { S.rules.splice(+b.dataset.i, 1); commit(); },
  "fill-budget": () => {
    let n = 0;
    for (const c of budgetCats()) { const a = avgCat(c.name, UI.month); if (a && a > 5) { S.budgets[c.name] = Math.ceil(a / 10) * 10; n++; } }
    commit(); toast(n ? `Set ${n} budgets from your 3-month averages` : "Not enough history yet to average");
  },
  "toggle-all-budget": () => { UI.showAllBudget = !UI.showAllBudget; render(); },
  "hide-recur": b => { S.hiddenRecurring[b.dataset.key] = true; commit(); },
  "unhide-recur": () => { S.hiddenRecurring = {}; commit(); },
  "cf-mode": b => { UI.cf.mode = b.dataset.v; UI.cf.view = "sankey"; saveUI(); render(); },
  "cf-view": b => { UI.cf.view = b.dataset.v; saveUI(); render(); },
  "cf-inc": b => { UI.cf.inc = b.dataset.v; saveUI(); render(); },
  "cf-exp": b => { UI.cf.exp = b.dataset.v; saveUI(); render(); },
  "pl-toggle": b => { const k = b.dataset.key, cur = UI.cf.open[k] ?? (k === "__inc" || k === "__exp"); UI.cf.open[k] = !cur; $("#flow").innerHTML = plTable(summarize(UI.range.from, UI.range.to)); },
  "sp-mode": b => { UI.sp.mode = b.dataset.v; UI.sp.picked = []; saveUI(); render(); },
  "sp-pick": b => { togglePick(UI.sp.picked, b.dataset.key); render(); },
  "sp-clear": () => { UI.sp.picked = []; render(); },
  "nw-view": b => { UI.nw.view = b.dataset.v; UI.nw.picked = []; UI.nw.account = ""; render(); },
  "nw-open": b => { UI.nw.open[b.dataset.v] = !UI.nw.open[b.dataset.v]; render(); },
  "nw-pick": (b, e) => { if (e.target.closest('[data-act="edit-acct"]')) return; togglePick(UI.nw.picked, b.dataset.id); UI.nw.account = ""; render(); },
  sync: () => syncBanks(),
  "sf-disconnect": () => askConfirm("Disconnect SimpleFIN?", "Your synced accounts and transactions stay. The server forgets its access key.", "Disconnect", true).then(async ok => {
    if (!ok) return; try { await api("POST", "api/simplefin/disconnect"); SERVER.simplefin = false; render(); toast("Disconnected"); } catch (e) { toast(e.message); }
  }),
  "export-json": () => download(`kakeibo-backup-${TODAY}.json`, JSON.stringify(S), "application/json"),
  "copy-json": () => copyText(JSON.stringify(S), "Backup"),
  "export-csv": () => exportCSV(),
  summary: () => copyText(summaryText(), "Summary"),
  reset: () => askConfirm("Delete all data?", "Every account, transaction, budget and note will be deleted. Download a backup first if you might want it.", "Delete everything", true).then(ok => {
    if (!ok) return; S = emptyState(); S.settings.demo = false; setFormatters(); commit(); toast("All data deleted");
  })
};
document.addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (b && ACT[b.dataset.act]) { if (b.tagName === "A" && b.getAttribute("href") === "#") e.preventDefault(); ACT[b.dataset.act](b, e); }
});
document.addEventListener("keydown", e => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-form]"); if (!f) return;
  e.preventDefault();
  if (f.dataset.form === "sf-connect") {
    const token = new FormData(f).get("token").trim(), btn = f.querySelector("button");
    btn.disabled = true; btn.textContent = "Connecting…";
    try { await api("POST", "api/simplefin/connect", { token }); SERVER.simplefin = true; render(); toast("Connected. Pulling your accounts…"); syncBanks(); }
    catch (err) { toast("Couldn't connect: " + err.message); btn.disabled = false; btn.textContent = "Connect"; }
  }
});
let noteT;
document.addEventListener("input", e => {
  const el = e.target;
  if (el.dataset.change === "note") { clearTimeout(noteT); noteT = setTimeout(() => { const v = el.value.trim(); if (v) S.notes[el.dataset.ym] = v; else delete S.notes[el.dataset.ym]; save(); }, 400); }
});
document.addEventListener("change", e => {
  const el = e.target, k = el.dataset.change; if (!k) return;
  if (k === "budget") { const v = Math.max(0, parseFloat(el.value) || 0); if (v) S.budgets[el.dataset.cat] = v; else delete S.budgets[el.dataset.cat]; commit(); }
  else if (k === "goal") { S.settings.savingsGoal = Math.max(0, parseFloat(el.value) || 0); commit(); }
  else if (k === "currency") { S.settings.currency = el.value; setFormatters(); commit(); }
  else if (k === "preset") { if (el.value !== "custom") setPreset(el.value); UI.tx.sel.clear(); render(); }
  else if (k === "nw-acct") { UI.nw.account = el.value; UI.nw.picked = []; render(); }
  else if (k === "tx-sel") { if (el.checked) UI.tx.sel.add(el.dataset.id); else UI.tx.sel.delete(el.dataset.id); el.closest(".txr").classList.toggle("sel", el.checked); renderBulk(); const sa = $("#selall"); if (sa) sa.indeterminate = UI.tx.sel.size > 0; }
  else if (k === "bulk-cat") { if (!el.value) return; const cat = el.value; bulk(t => { if (!isSplit(t)) t.category = cat; t.needsReview = false; }, n => `Moved ${n} to ${cat}`); }
  else if (k === "bulk-prop") { if (!el.value) return; const p = el.value; bulk(t => { if (p === "__none") delete t.property; else t.property = p; }, n => p === "__none" ? `Removed ${n} from their property` : `Assigned ${n} to ${PM[p].name}`); }
  else if (k === "tx-cat") {
    const t = S.transactions.find(x => x.id === el.dataset.id); if (!t) return;
    t.category = el.value; t.needsReview = false; invalidate(); save(); rebuild(); renderNav();
    el.classList.toggle("unc", t.category === "Uncategorized");
    const key = merchantKey(t.desc), cat = t.category;
    const others = S.transactions.filter(x => x !== t && merchantKey(x.desc) === key && x.category !== cat && !isSplit(x));
    const rule = () => { S.rules = S.rules.filter(r => r.key !== key); S.rules.push({ key, category: cat, property: t.property }); };
    if (others.length) toast(`Moved to ${cat}. ${others.length} more from ${t.merchant}.`, "Apply to all", () => { for (const x of others) { x.category = cat; x.needsReview = false; } rule(); commit(); toast(`Updated ${others.length} and saved a rule`); });
    else { rule(); save(); toast(`Moved to ${cat}`); }
  }
});
let LAST_ROUTE = null;
addEventListener("hashchange", () => {
  const r = route();
  if (r.id === "transactions" && LAST_ROUTE === "uncategorized" && UI.tx.tab === "uncategorized") UI.tx.tab = "all";
  if (dlg().open) dlg().close();
  render(); scrollTo(0, 0);
});
let rT; addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(() => { if ($("#view").clientWidth !== VIEW_W) render(); }, 160); });

/* ---------- boot ---------- */
(async function boot() {
  S = readLocal();
  if (!S) { S = sampleState(); saveLocal(); }
  setFormatters(); loadUI(); render();
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 2500);
    const res = await fetch("api/health", { cache: "no-store", signal: ctl.signal });
    const h = res.ok && (res.headers.get("content-type") || "").includes("json") ? await res.json() : null;
    if (h && h.ok && h.app === "kakeibo") {
      SERVER = h;
      const st = await api("GET", "api/state");
      if (st && Array.isArray(st.transactions)) { S = st.version === 2 ? normalize(st) : migrateV1(st); saveLocal(); }
      else await api("PUT", "api/state", S);
      setFormatters(); render();
    }
  } catch (e) { /* browser-only mode */ }
})();
