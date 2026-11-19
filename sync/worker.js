/**
 * Organize Life Co. — sync service (Cloudflare Worker + D1)
 *
 * Stores ENCRYPTED records only. Your devices encrypt everything with your
 * passphrase before sending it, so this Worker (and Cloudflare) never sees
 * your tasks, money, journal or photos in readable form.
 *
 * Bindings needed: a D1 database bound as `DB`.
 * Security: the first device to connect "claims" this sync space with a
 * token derived from your passphrase; after that only that token works.
 * To reset, delete the row in the `meta` table (or the database) in the dashboard.
 */
const ALLOWED_ORIGINS = [
  'https://shruthianjan.github.io',
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/
];
const MAX_ITEM = 1_900_000; // D1 rows must stay under 2 MB

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)',
  'CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, updated INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, data TEXT, seq INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS items_seq ON items(seq)',
  'CREATE TABLE IF NOT EXISTS blobs (id TEXT PRIMARY KEY, data TEXT NOT NULL, created INTEGER NOT NULL)'
];
let ready = false;

function corsHeaders(req) {
  const o = req.headers.get('Origin') || '';
  const ok = ALLOWED_ORIGINS.some(a => typeof a === 'string' ? a === o : a.test(o));
  return ok ? {'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS', 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin'} : {'Vary': 'Origin'};
}
const json = (req, body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json', ...corsHeaders(req)}});
async function sha256hex(s) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); }
function safeEqual(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: corsHeaders(req)});
    if (!env.DB) return json(req, {error: 'D1 database is not bound. Add a D1 binding named DB in the Worker settings.'}, 500);
    const url = new URL(req.url);
    if (url.pathname === '/' || url.pathname === '/health') return json(req, {ok: true, app: 'organize-life-sync', version: 1});
    if (!ready) { await env.DB.batch(SCHEMA.map(s => env.DB.prepare(s))); ready = true; }

    // --- auth: bearer token (derived from passphrase on the device) ---
    const auth = req.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token.length < 32) return json(req, {error: 'unauthorized'}, 401);
    const h = await sha256hex(token);
    const row = await env.DB.prepare("SELECT v FROM meta WHERE k = 'token'").first();
    if (!row) await env.DB.prepare("INSERT OR IGNORE INTO meta (k, v) VALUES ('token', ?)").bind(h).run();
    else if (!safeEqual(row.v, h)) return json(req, {error: 'wrong passphrase'}, 403);

    try {
      // --- pull changes since a sequence number ---
      if (req.method === 'GET' && url.pathname === '/pull') {
        const since = Math.max(0, parseInt(url.searchParams.get('since') || '0', 10) || 0);
        const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '300', 10) || 300));
        const {results} = await env.DB.prepare('SELECT id, updated, deleted, data, seq FROM items WHERE seq > ? ORDER BY seq LIMIT ?').bind(since, limit).all();
        const max = await env.DB.prepare('SELECT COALESCE(MAX(seq), 0) AS m FROM items').first();
        return json(req, {items: results, seq: results.length ? results[results.length - 1].seq : since, head: max.m, more: results.length === limit});
      }
      // --- push local changes (newest edit wins) ---
      if (req.method === 'POST' && url.pathname === '/push') {
        const body = await req.json();
        const items = Array.isArray(body.items) ? body.items.slice(0, 200) : [];
        const stmts = [];
        for (const it of items) {
          if (typeof it.id !== 'string' || it.id.length > 300 || !Number.isFinite(it.updated)) continue;
          if (it.data && it.data.length > MAX_ITEM) continue;
          stmts.push(env.DB.prepare(
            `INSERT INTO items (id, updated, deleted, data, seq) VALUES (?1, ?2, ?3, ?4, (SELECT COALESCE(MAX(seq), 0) + 1 FROM items))
             ON CONFLICT(id) DO UPDATE SET updated = excluded.updated, deleted = excluded.deleted, data = excluded.data, seq = excluded.seq
             WHERE excluded.updated >= items.updated`).bind(it.id, Math.round(it.updated), it.deleted ? 1 : 0, it.deleted ? null : (it.data || null)));
        }
        if (stmts.length) await env.DB.batch(stmts);
        return json(req, {ok: true, accepted: stmts.length});
      }
      // --- encrypted photos (content-addressed) ---
      const m = url.pathname.match(/^\/blob\/([a-f0-9]{64})$/);
      if (m && req.method === 'PUT') {
        const data = await req.text();
        if (data.length > MAX_ITEM) return json(req, {error: 'photo too large'}, 413);
        await env.DB.prepare('INSERT OR IGNORE INTO blobs (id, data, created) VALUES (?, ?, ?)').bind(m[1], data, Date.now()).run();
        return json(req, {ok: true});
      }
      if (m && req.method === 'GET') {
        const r = await env.DB.prepare('SELECT data FROM blobs WHERE id = ?').bind(m[1]).first();
        return r ? new Response(r.data, {headers: {'Content-Type': 'text/plain', 'Cache-Control': 'private, max-age=31536000, immutable', ...corsHeaders(req)}}) : json(req, {error: 'not found'}, 404);
      }
      if (req.method === 'POST' && url.pathname === '/blobs/have') {
        const {ids} = await req.json(); const list = (Array.isArray(ids) ? ids : []).filter(x => /^[a-f0-9]{64}$/.test(x)).slice(0, 100);
        if (!list.length) return json(req, {have: []});
        const {results} = await env.DB.prepare(`SELECT id FROM blobs WHERE id IN (${list.map(() => '?').join(',')})`).bind(...list).all();
        return json(req, {have: results.map(r => r.id)});
      }
      if (req.method === 'GET' && url.pathname === '/stats') {
        const a = await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(MAX(seq),0) AS head FROM items WHERE deleted = 0').first();
        const b = await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(data)),0) AS bytes FROM blobs').first();
        return json(req, {records: a.n, head: a.head, photos: b.n, photoBytes: b.bytes});
      }
      return json(req, {error: 'not found'}, 404);
    } catch (e) {
      return json(req, {error: 'server error', detail: String(e && e.message || e)}, 500);
    }
  }
};
