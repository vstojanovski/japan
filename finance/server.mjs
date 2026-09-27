#!/usr/bin/env node
// Kakeibo companion server — no dependencies, Node 18+.
//
//   node server.mjs                      → http://localhost:8787
//   PORT=8080 HOST=0.0.0.0 KAKEIBO_PASSWORD=secret node server.mjs
//
// It serves the app, saves your data to ./data/state.json (with a daily backup in
// ./data/backups), and talks to SimpleFIN Bridge so your bank access key never
// reaches the browser. Everything stays on the machine that runs it.

import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(process.env.KAKEIBO_DATA || path.join(ROOT, "data"));
const PORT = +process.env.PORT || 8787;
const HOST = process.env.HOST || "127.0.0.1";
const PASSWORD = process.env.KAKEIBO_PASSWORD || "";
const STATE = path.join(DATA, "state.json");
const SECRETS = path.join(DATA, "secrets.json");
const MAX_BODY = 60 * 1024 * 1024;
const STATIC = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

const log = (...a) => console.log(new Date().toISOString(), ...a);
async function readJSON(file, fallback) { try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return fallback; } }
async function writeJSON(file, value, mode) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + "." + process.pid + ".tmp";
  await fs.writeFile(tmp, typeof value === "string" ? value : JSON.stringify(value), { mode });
  await fs.rename(tmp, file);
}
function send(res, code, body, type = "application/json") {
  const data = type === "application/json" ? JSON.stringify(body) : body;
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(data);
}
async function body(req) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > MAX_BODY) throw Object.assign(new Error("Body too large"), { code: 413 }); chunks.push(c); }
  const s = Buffer.concat(chunks).toString("utf8");
  return s ? JSON.parse(s) : {};
}
function authorized(req) {
  if (!PASSWORD) return true;
  const h = req.headers.authorization || "";
  if (!h.startsWith("Basic ")) return false;
  const pass = Buffer.from(h.slice(6), "base64").toString().split(":").slice(1).join(":");
  const a = Buffer.from(pass), b = Buffer.from(PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- SimpleFIN (https://www.simplefin.org/protocol.html) ---------- */
function parseAccessUrl(accessUrl) {
  const u = new URL(accessUrl);
  const auth = "Basic " + Buffer.from(decodeURIComponent(u.username) + ":" + decodeURIComponent(u.password)).toString("base64");
  u.username = ""; u.password = "";
  return { base: u.toString().replace(/\/$/, ""), auth };
}
async function claim(token) {
  let claimUrl;
  try { claimUrl = Buffer.from(token.trim(), "base64").toString("utf8"); new URL(claimUrl); }
  catch { throw Object.assign(new Error("That doesn't look like a SimpleFIN setup token."), { code: 400 }); }
  if (!/^https:\/\//.test(claimUrl) && !process.env.SIMPLEFIN_ALLOW_HTTP) throw Object.assign(new Error("Setup tokens must point to an https address."), { code: 400 });
  const r = await fetch(claimUrl, { method: "POST", headers: { "Content-Length": "0" } });
  const text = (await r.text()).trim();
  if (!r.ok) throw Object.assign(new Error(r.status === 403 ? "This setup token was already used or has expired. Create a new one in SimpleFIN Bridge." : `SimpleFIN answered ${r.status}.`), { code: 502 });
  parseAccessUrl(text); // validates
  return text;
}
// SimpleFIN limits how far back one request can reach, so fetch in 60-day windows and merge.
async function fetchAccounts(accessUrl, start) {
  const { base, auth } = parseAccessUrl(accessUrl);
  const now = Math.floor(Date.now() / 1000), WINDOW = 60 * 86400;
  const accounts = new Map(), errors = [];
  for (let from = Math.max(start, now - 2 * 365 * 86400); from < now; from += WINDOW) {
    const to = Math.min(now, from + WINDOW);
    const r = await fetch(`${base}/accounts?start-date=${from}&end-date=${to}&pending=1`, { headers: { Authorization: auth } });
    if (r.status === 403) throw Object.assign(new Error("SimpleFIN refused the access key. Reconnect with a new setup token."), { code: 502 });
    if (!r.ok) throw Object.assign(new Error(`SimpleFIN answered ${r.status}.`), { code: 502 });
    const data = await r.json();
    for (const e of data.errors || []) if (!errors.includes(e)) errors.push(e);
    for (const e of data.errlist || []) { const m = e.msg || JSON.stringify(e); if (!errors.includes(m)) errors.push(m); }
    const orgs = Object.fromEntries((data.connections || []).map(c => [c.conn_id, { name: c.name, domain: c.org_url }]));
    for (const a of data.accounts || []) {
      const cur = accounts.get(a.id) || { ...a, org: a.org || orgs[a.conn_id] || {}, transactions: [] };
      Object.assign(cur, { balance: a.balance, "available-balance": a["available-balance"], "balance-date": a["balance-date"], holdings: a.holdings });
      const seen = new Set(cur.transactions.map(t => t.id));
      for (const t of a.transactions || []) if (!seen.has(t.id)) cur.transactions.push(t);
      accounts.set(a.id, cur);
    }
  }
  return { accounts: [...accounts.values()], errors };
}

/* ---------- routes ---------- */
async function handle(req, res) {
  const url = new URL(req.url, "http://x");
  const p = decodeURIComponent(url.pathname);
  if (!authorized(req)) { res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Kakeibo", charset="UTF-8"' }); return res.end("Password required"); }

  if (p === "/api/health") {
    const s = await readJSON(SECRETS, {});
    return send(res, 200, { ok: true, app: "kakeibo", simplefin: !!s.simplefinAccessUrl });
  }
  if (p === "/api/state" && req.method === "GET") {
    let data;
    try { data = await fs.readFile(STATE); } catch { return send(res, 200, null); }
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(data);
  }
  if (p === "/api/state" && req.method === "PUT") {
    const st = await body(req);
    if (!st || !Array.isArray(st.transactions) || !Array.isArray(st.accounts)) return send(res, 400, { error: "Not a Kakeibo state." });
    const day = new Date().toISOString().slice(0, 10), backup = path.join(DATA, "backups", `state-${day}.json`);
    try { await fs.access(backup); } catch { try { await fs.mkdir(path.dirname(backup), { recursive: true }); await fs.copyFile(STATE, backup); } catch {} }
    await writeJSON(STATE, st);
    return send(res, 200, { ok: true });
  }
  if (p === "/api/simplefin/connect" && req.method === "POST") {
    const { token } = await body(req);
    if (!token) return send(res, 400, { error: "Paste a setup token." });
    const accessUrl = await claim(token);
    const s = await readJSON(SECRETS, {}); s.simplefinAccessUrl = accessUrl;
    await writeJSON(SECRETS, s, 0o600);
    log("SimpleFIN connected");
    return send(res, 200, { ok: true });
  }
  if (p === "/api/simplefin/disconnect" && req.method === "POST") {
    const s = await readJSON(SECRETS, {}); delete s.simplefinAccessUrl; await writeJSON(SECRETS, s, 0o600);
    return send(res, 200, { ok: true });
  }
  if (p === "/api/simplefin/sync" && req.method === "POST") {
    const s = await readJSON(SECRETS, {});
    if (!s.simplefinAccessUrl) return send(res, 400, { error: "SimpleFIN isn't connected yet." });
    const { start } = await body(req);
    const out = await fetchAccounts(s.simplefinAccessUrl, Math.floor(+start || Date.now() / 1000 - 90 * 86400));
    log(`SimpleFIN sync: ${out.accounts.length} accounts, ${out.accounts.reduce((n, a) => n + a.transactions.length, 0)} transactions`);
    return send(res, 200, out);
  }
  if (p.startsWith("/api/")) return send(res, 404, { error: "Not found" });

  // static files: only the app itself, never ./data
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "Method not allowed" });
  const rel = p === "/" ? "index.html" : p.replace(/^\/+/, "");
  const file = path.resolve(ROOT, rel), ext = path.extname(file);
  if (!file.startsWith(ROOT + path.sep) || file.startsWith(DATA + path.sep) || file === DATA || !STATIC[ext] || rel.split("/").some(s => s.startsWith("."))) return send(res, 404, "Not found", "text/plain");
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { "Content-Type": STATIC[ext], "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch { send(res, 404, "Not found", "text/plain"); }
}

http.createServer((req, res) => {
  handle(req, res).catch(e => { log("error", req.method, req.url, e.message); if (!res.headersSent) send(res, e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.message }); });
}).listen(PORT, HOST, () => {
  log(`Kakeibo is running at http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  log(`Data folder: ${DATA}${PASSWORD ? " · password required" : ""}`);
  if (HOST !== "127.0.0.1" && HOST !== "localhost" && !PASSWORD) log("Warning: reachable from your network without a password. Set KAKEIBO_PASSWORD.");
});
