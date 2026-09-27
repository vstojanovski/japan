"use strict";
/* ===================================================================
   Charts — hand-built SVG. One scale per chart, recessive grid,
   2px lines, 4px rounded column ends, tooltip on hover/tap.
   =================================================================== */
function niceNum(x) { const e = Math.pow(10, Math.floor(Math.log10(x))), f = x / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; }
function niceTicks(lo, hi, n = 4) {
  if (!(hi - lo > 1e-9)) { hi = lo + (Math.abs(lo) || 1) * 0.1; lo = lo - (Math.abs(lo) || 1) * 0.1; }
  const step = niceNum((hi - lo) / n), start = Math.floor(lo / step) * step, end = Math.ceil(hi / step) * step, out = [];
  for (let v = start; v <= end + step / 2; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}
// Axis labels: compact, but with enough precision that neighbouring ticks never read the same.
function axisFmt(ticks) {
  for (const d of [0, 1, 2]) {
    const f = new Intl.NumberFormat(undefined, { style: "currency", currency: S.settings.currency || "USD", notation: "compact", maximumFractionDigits: d });
    const out = ticks.map(t => f.format(t));
    if (new Set(out).size === out.length) return v => f.format(v);
  }
  return v => money(v);
}
const TIP = () => $("#tip");
function showTip(html, ev) {
  const tip = TIP(); tip.innerHTML = html; tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let x = ev.clientX + 14, y = ev.clientY - h - 12;
  if (x + w > innerWidth - 8) x = ev.clientX - w - 14;
  if (y < 8) y = ev.clientY + 16;
  tip.style.left = Math.max(8, x) + "px"; tip.style.top = y + "px";
}
function hideTip() { const t = TIP(); if (t) t.hidden = true; }
const tipHead = s => `<div class="h">${esc(s)}</div>`;
const tipRow = (color, value, label) => `<div class="r"><i style="background:${color}"></i><b>${esc(value)}</b><span>${esc(label)}</span></div>`;
const svgW = el => Math.max(260, Math.floor(el.clientWidth));
function svgX(svg, ev, W) { const r = svg.getBoundingClientRect(); return (ev.clientX - r.left) * W / r.width; }

/* Lines over months. series: [{name, color, values[]}]. One series gets an area wash. */
function lineChart(el, labels, series, opt = {}) {
  if (!el || !labels.length) return;
  const W = svgW(el), H = opt.h || 220, m = { t: 14, r: 16, b: 26, l: 60 };
  const all = series.flatMap(s => s.values);
  let lo = Math.min(...all), hi = Math.max(...all);
  if (opt.zero) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
  const ticks = niceTicks(lo, hi, 4), y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const iw = W - m.l - m.r, ih = H - m.t - m.b, n = labels.length;
  const X = i => m.l + (n === 1 ? iw / 2 : i * iw / (n - 1));
  const Y = v => m.t + ih * (1 - (v - y0) / (y1 - y0 || 1));
  const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 56))));
  const AX = axisFmt(ticks);
  let g = "";
  for (const t of ticks) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="${t === 0 && y0 < 0 ? "var(--axis)" : "var(--grid)"}" stroke-width="1"/><text x="${m.l - 8}" y="${Y(t) + 4}" text-anchor="end">${esc(AX(t))}</text>`;
  labels.forEach((l, i) => { if ((n - 1 - i) % step === 0) g += `<text x="${X(i)}" y="${H - 6}" text-anchor="middle">${esc(l.label)}</text>`; });
  const single = series.length === 1;
  for (const s of series) {
    const d = s.values.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1)).join("");
    if (single) g += `<path d="${d}L${X(n - 1).toFixed(1)},${Y(Math.max(y0, 0))}L${X(0).toFixed(1)},${Y(Math.max(y0, 0))}Z" fill="${s.color}" fill-opacity=".10"/>`;
    g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    g += `<circle cx="${X(n - 1)}" cy="${Y(s.values[n - 1])}" r="4" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`;
  }
  g += `<g class="hov" style="display:none"><line y1="${m.t}" y2="${m.t + ih}" stroke="var(--axis)" stroke-width="1"/>${series.map(s => `<circle r="4" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`).join("")}</g>`;
  g += `<rect x="${m.l - 10}" y="0" width="${iw + 20}" height="${H}" fill="transparent" class="hit"/>`;
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(opt.label || "Chart")}">${g}</svg>`;
  const svg = el.firstChild, hov = svg.querySelector(".hov"), hit = svg.querySelector(".hit");
  const move = ev => {
    const i = Math.max(0, Math.min(n - 1, Math.round(n === 1 ? 0 : (svgX(svg, ev, W) - m.l) / iw * (n - 1))));
    hov.style.display = ""; const [ln, ...dots] = hov.children;
    ln.setAttribute("x1", X(i)); ln.setAttribute("x2", X(i));
    dots.forEach((c, k) => { c.setAttribute("cx", X(i)); c.setAttribute("cy", Y(series[k].values[i])); });
    const rows = series.map(s => ({ s, v: s.values[i] })).sort((a, b) => b.v - a.v);
    showTip(tipHead(labels[i].title || labels[i].label) + rows.map(r => tipRow(r.s.color, money(r.v), r.s.name)).join(""), ev);
  };
  hit.addEventListener("pointermove", move); hit.addEventListener("pointerdown", move);
  hit.addEventListener("pointerleave", () => { hov.style.display = "none"; hideTip(); });
  if (opt.onPick) { hit.style.cursor = "pointer"; hit.addEventListener("click", ev => { const i = Math.max(0, Math.min(n - 1, Math.round((svgX(svg, ev, W) - m.l) / iw * (n - 1)))); hideTip(); opt.onPick(i); }); }
}

function colPath(x, y, w, h, r, down) {
  if (h <= 0.5) return "";
  r = Math.min(r, h, w / 2);
  if (down) return `M${x},${y}L${x},${y + h - r}Q${x},${y + h} ${x + r},${y + h}L${x + w - r},${y + h}Q${x + w},${y + h} ${x + w},${y + h - r}L${x + w},${y}Z`;
  return `M${x},${y + h}L${x},${y + r}Q${x},${y} ${x + r},${y}L${x + w - r},${y}Q${x + w},${y} ${x + w},${y + r}L${x + w},${y + h}Z`;
}

/* Grouped columns per month: income vs spending. rows: [{ym, income, expense}] */
function cashChart(el, rows, opt = {}) {
  if (!el || !rows.length) return;
  const W = svgW(el), H = opt.h || 230, m = { t: 12, r: 8, b: 26, l: 56 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b, n = rows.length, band = iw / n;
  const ticks = niceTicks(0, Math.max(1, ...rows.map(r => Math.max(r.income, r.expense))), 4), y1 = ticks[ticks.length - 1];
  const Y = v => m.t + ih * (1 - Math.max(0, v) / y1);
  const bw = Math.max(3, Math.min(24, (band * 0.72 - 2) / 2)), lstep = Math.max(1, Math.ceil(44 / band));
  const AX = axisFmt(ticks);
  let g = "";
  for (const t of ticks) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="${t === 0 ? "var(--axis)" : "var(--grid)"}" stroke-width="1"/><text x="${m.l - 8}" y="${Y(t) + 4}" text-anchor="end">${esc(AX(t))}</text>`;
  rows.forEach((r, i) => {
    const cx = m.l + band * i + band / 2;
    if (r.ym === opt.selected) g += `<rect x="${m.l + band * i + 1}" y="${m.t}" width="${band - 2}" height="${ih}" rx="6" fill="var(--brand-wash)"/>`;
    g += `<path d="${colPath(cx - bw - 1, Y(r.income), bw, Y(0) - Y(r.income), 4)}" fill="var(--c1)"/>`;
    g += `<path d="${colPath(cx + 1, Y(r.expense), bw, Y(0) - Y(r.expense), 4)}" fill="var(--c2)"/>`;
    if ((n - 1 - i) % lstep === 0) g += `<text x="${cx}" y="${H - 6}" text-anchor="middle" ${r.ym === opt.selected ? 'style="fill:var(--ink);font-weight:700"' : ""}>${esc(n > 12 ? monthName(r.ym, { month: "short", year: "2-digit" }) : monthShort(r.ym))}</text>`;
    g += `<rect class="hit" data-i="${i}" x="${m.l + band * i}" y="0" width="${band}" height="${H}" fill="transparent" ${opt.onPick ? 'style="cursor:pointer"' : ""}/>`;
  });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Income and spending by month">${g}</svg>`;
  $$(".hit", el).forEach(h => {
    const r = rows[+h.dataset.i];
    h.addEventListener("pointermove", ev => {
      const net = r.income - r.expense;
      showTip(tipHead(monthName(r.ym)) + tipRow("var(--c1)", money(r.income), "Income") + tipRow("var(--c2)", money(r.expense), "Spending") +
        `<div class="r sep"><i></i><b>${esc(signed(net, false))}</b><span>${net >= 0 ? "Saved" : "Overspent"}${r.income > 0 ? " · " + pct(net / r.income) : ""}</span></div>`, ev);
    });
    h.addEventListener("pointerleave", hideTip);
    if (opt.onPick) h.addEventListener("click", () => { hideTip(); opt.onPick(r.ym); });
  });
}

/* Single-series columns; with opt.diverging, negatives go down in the second hue. rows: [{label, title, v}] */
function barChart(el, rows, opt = {}) {
  if (!el || !rows.length) return;
  const W = svgW(el), H = opt.h || 220, m = { t: 12, r: 8, b: 26, l: 56 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b, n = rows.length, band = iw / n;
  const ticks = niceTicks(Math.min(0, ...rows.map(r => r.v)), Math.max(0, ...rows.map(r => r.v), 1), 4), y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const Y = v => m.t + ih * (1 - (v - y0) / (y1 - y0));
  const bw = Math.max(3, Math.min(24, band * 0.62)), lstep = Math.max(1, Math.ceil(44 / band));
  const pos = opt.color || "var(--c1)", neg = opt.negColor || "var(--c8)";
  const AX = axisFmt(ticks);
  let g = "";
  for (const t of ticks) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="${t === 0 ? "var(--axis)" : "var(--grid)"}" stroke-width="1"/><text x="${m.l - 8}" y="${Y(t) + 4}" text-anchor="end">${esc(AX(t))}</text>`;
  rows.forEach((r, i) => {
    const cx = m.l + band * i + band / 2, up = r.v >= 0;
    g += `<path d="${up ? colPath(cx - bw / 2, Y(r.v), bw, Y(0) - Y(r.v), 4) : colPath(cx - bw / 2, Y(0), bw, Y(r.v) - Y(0), 4, true)}" fill="${up ? pos : neg}"/>`;
    if ((n - 1 - i) % lstep === 0) g += `<text x="${cx}" y="${H - 6}" text-anchor="middle">${esc(r.label)}</text>`;
    g += `<rect class="hit" data-i="${i}" x="${m.l + band * i}" y="0" width="${band}" height="${H}" fill="transparent" ${opt.onPick ? 'style="cursor:pointer"' : ""}/>`;
  });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(opt.label || "Chart")}">${g}</svg>`;
  $$(".hit", el).forEach(h => {
    const r = rows[+h.dataset.i];
    h.addEventListener("pointermove", ev => showTip(tipHead(r.title || r.label) + (r.tip || tipRow(r.v >= 0 ? pos : neg, opt.signed ? signed(r.v, false) : money(r.v), opt.series || "")), ev));
    h.addEventListener("pointerleave", hideTip);
    if (opt.onPick) h.addEventListener("click", () => { hideTip(); opt.onPick(r, +h.dataset.i); });
  });
}

/* Donut with a 2px surface gap between segments and the total in the middle. */
function donut(el, items, total, opt = {}) {
  if (!el) return;
  const S2 = opt.size || 220, R = S2 / 2 - 4, r0 = R - (opt.thick || 30), cx = S2 / 2, cy = S2 / 2;
  const tot = sum(items.map(i => Math.max(0, i.v))) || 1;
  let a = -Math.PI / 2, g = "";
  const gap = items.length > 1 ? 0.012 : 0;
  items.forEach((it, k) => {
    const frac = Math.max(0, it.v) / tot, a0 = a + gap / 2, a1 = a + frac * Math.PI * 2 - gap / 2;
    a += frac * Math.PI * 2;
    if (a1 <= a0) return;
    const large = a1 - a0 > Math.PI ? 1 : 0, p = (rr, ang) => `${(cx + rr * Math.cos(ang)).toFixed(2)},${(cy + rr * Math.sin(ang)).toFixed(2)}`;
    const d = frac >= 0.9999 ? `M${cx},${cy - R}A${R},${R} 0 1 1 ${cx - 0.01},${cy - R}L${cx - 0.01},${cy - r0}A${r0},${r0} 0 1 0 ${cx},${cy - r0}Z`
      : `M${p(R, a0)}A${R},${R} 0 ${large} 1 ${p(R, a1)}L${p(r0, a1)}A${r0},${r0} 0 ${large} 0 ${p(r0, a0)}Z`;
    g += `<path d="${d}" fill="${it.color}" data-k="${k}" class="seg"/>`;
  });
  el.innerHTML = `<svg viewBox="0 0 ${S2} ${S2}" width="${S2}" height="${S2}" role="img" aria-label="${esc(opt.label || "Breakdown")}" style="max-width:100%">${g}
    <text x="${cx}" y="${cy - 8}" text-anchor="middle" class="dn-l">${esc(opt.center || "Total")}</text><text x="${cx}" y="${cy + 18}" text-anchor="middle" class="dn-v">${esc(money(total))}</text></svg>`;
  $$(".seg", el).forEach(s => {
    const it = items[+s.dataset.k];
    s.addEventListener("pointermove", ev => { s.style.opacity = .82; showTip(tipHead(it.name) + tipRow(it.color, money(it.v, true), pct(it.v / tot, 1) + " of total"), ev); });
    s.addEventListener("pointerleave", () => { s.style.opacity = ""; hideTip(); });
  });
}

/* Sankey. cols: array of columns, each an array of nodes {id, name, v, color, sub}.
   links: [{from, to, v}]. Node heights are to scale; labels get at least 30px. */
function sankey(el, cols, links, opt = {}) {
  if (!el) return;
  const W = Math.max(opt.minW || 680, Math.floor(el.clientWidth));
  const labelL = 170, labelR = 190, nodeW = 10, gap = 8, minSlot = 32;
  const nC = cols.length, x0 = labelL, x1 = W - labelR - nodeW;
  const X = c => x0 + (x1 - x0) * c / (nC - 1);
  const total = Math.max(...cols.map(col => sum(col.map(n => n.v)))) || 1;
  // Scale to a fixed flow height, then size the drawing to the tallest column,
  // since each node gets at least a label's worth of room.
  const k = (opt.flowH || 340) / total;
  const layout = cols.map(col => {
    const hs = col.map(n => Math.max(2, n.v * k));
    const slot = col.map((n, i) => Math.max(hs[i], col.length > 1 ? minSlot : 0));
    return { hs, slot, colH: sum(slot) + gap * (col.length - 1) };
  });
  const H = Math.max(opt.minH || 380, ...layout.map(l => l.colH + 44));
  const nodes = {};
  cols.forEach((col, c) => {
    const { hs, slot, colH } = layout[c];
    let y = Math.max(30, (H - colH) / 2);
    col.forEach((n, i) => { nodes[n.id] = { ...n, c, x: X(c), y: y + (slot[i] - hs[i]) / 2, h: hs[i], outY: 0, inY: 0 }; y += slot[i] + gap; });
  });
  let g = "";
  links.forEach((l, i) => {
    const a = nodes[l.from], b = nodes[l.to]; if (!a || !b || l.v <= 0) return;
    const h1 = l.v * a.h / a.v, h2 = l.v * b.h / b.v;
    const ya = a.y + a.outY, yb = b.y + b.inY; a.outY += h1; b.inY += h2;
    const xa = a.x + nodeW, xb = b.x, xm = (xa + xb) / 2;
    const color = l.color || (b.c === nC - 1 || opt.colorBy === "target" ? b.color : a.color);
    g += `<path class="lnk" data-i="${i}" d="M${xa},${ya}C${xm},${ya} ${xm},${yb} ${xb},${yb}L${xb},${yb + h2}C${xm},${yb + h2} ${xm},${ya + h1} ${xa},${ya + h1}Z" fill="${color}" fill-opacity=".28"/>`;
  });
  for (const n of Object.values(nodes)) {
    g += `<rect x="${n.x}" y="${n.y}" width="${nodeW}" height="${n.h}" rx="2" fill="${n.color}"/>`;
    const left = n.c === 0, mid = n.c > 0 && n.c < nC - 1 && !opt.midLabelsRight;
    const pctTxt = opt.base ? ` (${pct(n.v / opt.base, 1)})` : "";
    if (mid && cols[n.c].length === 1) {
      g += `<text x="${n.x + nodeW / 2}" y="${n.y - 22}" text-anchor="middle" class="sk-n">${esc(n.name)}</text><text x="${n.x + nodeW / 2}" y="${n.y - 8}" text-anchor="middle" class="sk-v">${esc(money(n.lv ?? n.v, true))}</text>`;
    } else {
      const tx = left ? n.x - 8 : n.x + nodeW + 8, anc = left ? "end" : "start", cy = n.y + n.h / 2;
      g += `<text x="${tx}" y="${cy - 2}" text-anchor="${anc}" class="sk-n">${esc(n.name)}</text><text x="${tx}" y="${cy + 12}" text-anchor="${anc}" class="sk-v">${esc(money(n.lv ?? n.v, true) + pctTxt)}</text>`;
    }
  }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(opt.label || "Flow of money")}">${g}</svg>`;
  $$(".lnk", el).forEach(p => {
    const l = links[+p.dataset.i], a = nodes[l.from], b = nodes[l.to];
    p.addEventListener("pointermove", ev => { p.setAttribute("fill-opacity", ".5"); showTip(tipHead(`${a.name} → ${b.name}`) + tipRow(b.color, money(l.v, true), opt.base ? pct(l.v / opt.base, 1) + " of income" : ""), ev); });
    p.addEventListener("pointerleave", () => { p.setAttribute("fill-opacity", ".28"); hideTip(); });
  });
}

/* Horizontal ranked list with a bar under each row. */
function rankList(rows, total, opt = {}) {
  if (!rows.length) return `<div class="empty small">Nothing in this period.</div>`;
  const max = Math.max(...rows.map(r => r.v), 1);
  return `<div class="rank">` + rows.map(r => {
    const color = r.color == null ? "var(--c1)" : colorVar(r.color);
    const name = `${r.emoji ? `<span aria-hidden="true">${esc(r.emoji)}</span> ` : ""}${r.href ? `<a href="${r.href}">${esc(r.name)}</a>` : esc(r.name)}${r.sub && opt.showSub ? `<span class="muted"> · ${esc(r.sub)}</span>` : ""}`;
    const picked = opt.picked && opt.picked.includes(r.key);
    return `<div class="rk ${opt.pick && !r.other ? "pickable" : ""} ${picked ? "picked" : ""}" ${opt.pick && !r.other ? `data-act="${opt.pick}" data-key="${esc(r.key)}" role="button" tabindex="0" aria-pressed="${picked}"` : ""}>
      <div class="rk-top"><span class="dot" style="background:${color}"></span><span class="rk-n">${name}</span><b class="num">${esc(money(r.v, true))}</b>${total ? `<span class="rk-p num">${pct(r.v / total, 1)}</span>` : ""}</div>
      <div class="rk-bar"><b style="width:${Math.max(0.5, r.v / max * 100)}%;background:${color}"></b></div></div>`;
  }).join("") + `</div>`;
}
