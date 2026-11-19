/* Organize Life Co. — core: utilities, dates, storage, images, UI kit, router */
(function(){
'use strict';
const LOS = window.LOS = {pages:{}, actions:{}, widgets:{}, quick:[], notifProviders:[], searchProviders:[], order:[], onDelete:{}};

/* ---------- utils ---------- */
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const sum = (arr, f = x => x) => round2(arr.reduce((a, x) => a + num(f(x)), 0));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pct = (a, b) => b > 0 ? clamp(Math.round(a / b * 100), 0, 100) : 0;
const by = (f, dir = 1) => (a, b) => { const x = f(a), y = f(b); return (x > y ? 1 : x < y ? -1 : 0) * dir; };
const groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const plural = (n, w, p) => `${n} ${n === 1 ? w : (p || w + 's')}`;
const mins = m => { m = Math.round(num(m)); if (!m) return '0m'; const h = Math.floor(m / 60), r = m % 60; return (h ? h + 'h' : '') + (r ? (h ? ' ' : '') + r + 'm' : ''); };
const hrs = m => round2(num(m) / 60).toFixed(1).replace(/\.0$/, '') + 'h';
Object.assign(LOS, {$, $$, esc, uid, num, round2, sum, clamp, pct, by, groupBy, debounce, plural, mins, hrs});

/* ---------- dates (all local, keyed YYYY-MM-DD) ---------- */
const pad = n => String(n).padStart(2, '0');
const D = {
  key(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; },
  parse(k) { if (!k) return null; const [y, m, d] = String(k).slice(0, 10).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1, 12); },
  today() { return D.key(); },
  add(k, n) { const d = D.parse(k); d.setDate(d.getDate() + n); return D.key(d); },
  addMonths(k, n, anchorDay) { const d = D.parse(k); const day = anchorDay || d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return D.key(d); },
  diff(a, b) { return Math.round((D.parse(b) - D.parse(a)) / 864e5); },
  weekStart(k = D.today()) { const d = D.parse(k); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return D.key(d); },
  month(k = D.today()) { return String(k).slice(0, 7); },
  monthStart(m) { return m + '-01'; },
  monthEnd(m) { const [y, mo] = m.split('-').map(Number); return D.key(new Date(y, mo, 0, 12)); },
  monthAdd(m, n) { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + n, 1, 12); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; },
  days(from, to) { const out = []; let k = from; let guard = 0; while (k <= to && guard++ < 3700) { out.push(k); k = D.add(k, 1); } return out; },
  fmt(k, o = {month: 'short', day: 'numeric'}) { const d = D.parse(k); return d ? d.toLocaleDateString(undefined, o) : ''; },
  long(k) { return D.fmt(k, {weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'}); },
  mname(m, o = {month: 'long', year: 'numeric'}) { return D.parse(m + '-01').toLocaleDateString(undefined, o); },
  dow(k, o = 'short') { return D.parse(k).toLocaleDateString(undefined, {weekday: o}); },
  rel(k) { if (!k) return ''; const n = D.diff(D.today(), k); if (n === 0) return 'Today'; if (n === 1) return 'Tomorrow'; if (n === -1) return 'Yesterday'; if (n > 1 && n < 7) return 'In ' + n + ' days'; if (n < 0 && n > -7) return -n + ' days ago'; return D.fmt(k, {month: 'short', day: 'numeric', year: D.parse(k).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined}); },
  time(t) { if (!t) return ''; const [h, m] = t.split(':').map(Number); const d = new Date(); d.setHours(h, m || 0); return d.toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'}); },
  range(name, custom) {
    const t = D.today();
    if (name === 'today') return [t, t];
    if (name === 'week') return [D.weekStart(t), D.add(D.weekStart(t), 6)];
    if (name === 'month') return [D.monthStart(D.month(t)), D.monthEnd(D.month(t))];
    if (name === 'quarter') { const d = D.parse(t); const q = Math.floor(d.getMonth() / 3); const s = `${d.getFullYear()}-${pad(q * 3 + 1)}`; return [s + '-01', D.monthEnd(D.monthAdd(s, 2))]; }
    if (name === 'year') { const y = t.slice(0, 4); return [y + '-01-01', y + '-12-31']; }
    if (name === 'custom' && custom) return [custom[0] || t, custom[1] || t];
    return [D.add(t, -29), t];
  },
  inR(k, r) { return !!k && k.slice(0, 10) >= r[0] && k.slice(0, 10) <= r[1]; }
};
LOS.D = D;

/* ---------- money ---------- */
LOS.money = (v, opts = {}) => {
  const cur = (LOS.Store && LOS.Store.settings().currency) || 'USD';
  try { return new Intl.NumberFormat(undefined, {style: 'currency', currency: cur, maximumFractionDigits: opts.whole ? 0 : 2, minimumFractionDigits: opts.whole ? 0 : 2}).format(num(v)); }
  catch (e) { return cur + ' ' + num(v).toFixed(2); }
};

/* ---------- icons ---------- */
const P = {
  home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  wallet: '<path d="M4 7a2 2 0 0 1 2-2h11v4"/><rect x="3" y="8" width="18" height="12" rx="3"/><circle cx="16" cy="14" r="1.3"/>',
  brief: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>',
  cup: '<path d="M5 8h11v6a5 5 0 0 1-10 0z"/><path d="M16 9h2a2 2 0 0 1 0 4h-2M8 3v2M11 3v2"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  flower: '<circle cx="12" cy="12" r="2.5"/><path d="M12 9.5C10 6 12 3 12 3s2 3 0 6.5M14.5 12c3.5-2 6.5 0 6.5 0s-3 2-6.5 0M12 14.5c2 3.5 0 6.5 0 6.5s-2-3 0-6.5M9.5 12C6 14 3 12 3 12s3-2 6.5 0"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  brush: '<path d="M14 4l6 6-8 8H6v-6z"/><path d="M11 7l6 6"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  left: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  play: '<path d="M7 5l12 7-12 7z"/>', pause: '<path d="M8 5v14M16 5v14"/>',
  reset: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4h4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  link: '<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1"/><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>',
  move: '<path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.8M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 4.4-1"/>',
  resize: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  flame: '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-3 5-3 8a6 6 0 0 0 6 6z"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  dumbbell: '<path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="3"/><path d="M11 18h2"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
  cart: '<path d="M3 4h2l2.4 11h10.2L20 8H6.3"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 4 6"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  kanban: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  timeline: '<path d="M4 6h9M8 12h12M4 18h7"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  split: '<path d="M6 3v6a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v6M6 21v-6M18 3v3"/>'
};
LOS.icon = (n, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true">${P[n] || P.sparkle}</svg>`;
const I = LOS.icon;

/* ---------- storage ---------- */
const SETTINGS_DEFAULT = {
  profile: {name: '', tagline: 'Plan your life, beautifully.', photo: null},
  currency: 'USD', animations: true, hidden: {}, widgets: null, covers: {}, tiles: {},
  waterGoal: 2000, serving: 250, screenLimit: 240, socialLimit: 60, workoutGoal: 4, studyGoal: 10,
  notif: {tasks: true, bills: true, loans: true, career: true, learning: true, goals: true, habits: true, planning: true, selfcare: true},
  dismissed: {}, groceryBudget: 0, billSoonDays: 3, sidebarCollapsed: false, expenseCats: null
};
const Store = LOS.Store = {
  mem: {}, mode: 'loading', note: '', col: null, idb: null, assets: null, downloads: null,
  dirty: {}, pending: {}, busy: {}, subs: new Set(),
  docId: (kind, id) => kind + '--' + id,
  all(kind) { return Array.from((this.mem[kind] || new Map()).values()); },
  get(kind, id) { return (this.mem[kind] || new Map()).get(id) || null; },
  _set(o) { (this.mem[o.kind] = this.mem[o.kind] || new Map()).set(o.id, o); },
  put(kind, obj, opts = {}) {
    const o = JSON.parse(JSON.stringify(obj));
    o.kind = kind; o.id = o.id || uid(); o.createdAt = o.createdAt || Date.now(); o.updatedAt = Date.now();
    this._set(o); this.persist(this.docId(kind, o.id), o);
    if (!opts.silent) this.emit();
    return o;
  },
  del(kind, id) {
    const m = this.mem[kind]; if (!m || !m.has(id)) return;
    m.delete(id); this.persist(this.docId(kind, id), null); this.emit();
  },
  settings() {
    const s = this.get('settings', 'main') || {};
    const out = Object.assign({}, SETTINGS_DEFAULT, s);
    out.profile = Object.assign({}, SETTINGS_DEFAULT.profile, s.profile || {});
    out.notif = Object.assign({}, SETTINGS_DEFAULT.notif, s.notif || {});
    return out;
  },
  setSettings(patch, opts) {
    const cur = this.get('settings', 'main') || {id: 'main'};
    return this.put('settings', Object.assign({}, cur, patch, {id: 'main'}), opts);
  },
  persist(docId, data) {
    if (this.mode === 'cloud') {
      this.dirty[docId] = true; this.pending[docId] = {data};
      if (!this.busy[docId]) this.flush(docId);
    } else if (this.mode === 'local') { idbPut(docId, data); }
  },
  async flush(docId) {
    this.busy[docId] = true;
    while (this.pending[docId]) {
      const {data} = this.pending[docId]; delete this.pending[docId];
      let tries = 0;
      for (;;) {
        try { data ? await this.col.doc(docId).set(data) : await this.col.doc(docId).delete(); break; }
        catch (e) {
          const code = e && e.code;
          if (code === 'unavailable' && tries++ < 2) { await new Promise(r => setTimeout(r, 600 + Math.random() * 900)); continue; }
          if (code === 'quota_exceeded') LOS.toast('Storage is full — delete some old records or images to keep saving.');
          else if (code === 'revoked') { this.setStatus('off', 'Saving paused — access changed'); }
          else LOS.toast('Couldn’t save a change (' + (code || 'error') + '). It will retry on your next edit.');
          console.warn('save failed', docId, e); break;
        }
      }
    }
    this.busy[docId] = false; delete this.dirty[docId];
  },
  onChange(fn) { this.subs.add(fn); },
  emit: null,
  setStatus(kind, text) { this.status = {kind, text}; renderSync(); }
};
Store.emit = debounce(() => Store.subs.forEach(f => f()), 16);

/* IndexedDB fallback */
function idbOpen() {
  return new Promise((res, rej) => {
    try { const r = indexedDB.open('my-life-os', 1); r.onupgradeneeded = () => r.result.createObjectStore('docs'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }
    catch (e) { rej(e); }
  });
}
function idbPut(id, data) {
  if (!Store.idb) return;
  try { const tx = Store.idb.transaction('docs', 'readwrite'); const st = tx.objectStore('docs'); data ? st.put(data, id) : st.delete(id); }
  catch (e) { console.warn(e); }
}
function idbAll() {
  return new Promise(res => {
    try { const out = []; const tx = Store.idb.transaction('docs'); const c = tx.objectStore('docs').openCursor(); c.onsuccess = () => { const cur = c.result; if (cur) { out.push(cur.value); cur.continue(); } else res(out); }; c.onerror = () => res(out); }
    catch (e) { res([]); }
  });
}
const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);

Store.init = async function () {
  let db = null, user = null, id = null;
  if (window.claude && typeof window.claude.use === 'function') {
    try {
      [db, user] = await withTimeout(Promise.all([window.claude.use('db'), window.claude.use('user')]), 11000) || [];
      if (user) id = await user.id();
    } catch (e) { console.warn('db unavailable', e); }
  }
  if (db && id) {
    try {
      this.col = db.collection('data/users/' + id);
      this.mode = 'cloud';
      window.claude.use('assets').then(a => { this.assets = a; }).catch(() => {});
      window.claude.use('downloads').then(d => { this.downloads = d; }).catch(() => {});
      await new Promise(resolve => {
        let first = true;
        const timer = setTimeout(() => { if (first) { first = false; this.setStatus('off', 'Can’t reach your saved data yet'); resolve(); } }, 10000);
        this.col.onSnapshot(snap => {
          for (const ch of snap.docChanges()) {
            const docId = ch.doc.id; if (this.dirty[docId]) continue;
            const kind = docId.split('--')[0], rid = docId.slice(kind.length + 2);
            if (ch.type === 'removed') { this.mem[kind] && this.mem[kind].delete(rid); }
            else { const d = ch.doc.data(); if (d) this._set(Object.assign({}, d, {kind, id: rid})); }
          }
          if (!snap.metadata.fromCache) { clearTimeout(timer); this.setStatus('cloud', 'Saved to your private space'); }
          if (first) { first = false; resolve(); } else this.emit();
        }, err => { clearTimeout(timer); this.setStatus('off', 'Sync stopped (' + (err && err.code) + ')'); if (first) { first = false; resolve(); } });
      });
      return;
    } catch (e) { console.warn('cloud init failed', e); }
  }
  this.mode = 'local';
  try { this.idb = await idbOpen(); const docs = await idbAll(); docs.forEach(d => d && d.kind && this._set(d)); LOS.standalone = !window.claude; this.setStatus('local', LOS.standalone ? 'Saved on this device' : 'Saved in this browser only'); try { if (navigator.storage && navigator.storage.persist) this.persisted = await navigator.storage.persist(); } catch (e) {} }
  catch (e) { this.setStatus('off', 'Storage unavailable — changes won’t persist'); }
};
function renderSync() {
  const el = $('#sync-status'); if (!el) return;
  const s = Store.status || {kind: 'off', text: 'Loading…'};
  el.innerHTML = `<div class="sync"><span class="pip ${s.kind === 'cloud' ? '' : s.kind}"></span><span class="txt">${esc(s.text)}</span></div>${LOS.installPrompt ? `<button class="btn sm" style="margin-top:10px;width:100%" data-action="install-app">${I('download')} <span class="txt">Install app</span></button>` : ''}`;
}

/* ---------- images ---------- */
const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
LOS.validImage = f => f && (IMG_TYPES.includes(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name || ''));
async function compress(file, max) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    let blob = await new Promise(r => c.toBlob(r, 'image/webp', .84));
    if (!blob || blob.type !== 'image/webp') blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .85));
    return {blob, canvas: c, w: c.width, h: c.height};
  } finally { URL.revokeObjectURL(url); }
}
LOS.saveImage = async function (file, max = 1600, alpha = false) {
  if (!LOS.validImage(file)) throw new Error('Please choose a JPG, PNG or WEBP image.');
  if (file.size > 30 * 1024 * 1024) throw new Error('That image is over 30 MB.');
  if (Store.mode === 'cloud' && Store.assets) {
    const {blob, w, h} = await compress(file, max);
    const r = await Store.assets.upload(blob);
    return {asset: r.id, url: r.url, w, h};
  }
  const {canvas, w, h} = await compress(file, Math.min(max, 1100));
  return {data: alpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', .8), w, h};
};
LOS.imgSrc = ref => !ref ? '' : ref.data || ref.url || (ref.asset ? '/_blob/' + ref.asset : '');
LOS.dropImage = async ref => { try { if (ref && ref.asset && Store.assets) await Store.assets.delete(ref.asset); } catch (e) { console.warn(e); } };
LOS.pickImages = (multiple = true) => new Promise(res => {
  const inp = $('#file-picker'); inp.multiple = multiple; inp.value = '';
  inp.onchange = () => res(Array.from(inp.files || []));
  inp.oncancel = () => res([]);
  inp.click();
});

/* ---------- UI kit ---------- */
LOS.toast = (msg, opts = {}) => {
  const t = document.createElement('div'); t.className = 'toast';
  t.innerHTML = `<span>${esc(msg)}</span>${opts.undo ? `<button>${esc(opts.undoLabel || 'Undo')}</button>` : ''}`;
  if (opts.undo) t.querySelector('button').onclick = () => { opts.undo(); t.remove(); };
  $('#toast-root').appendChild(t); setTimeout(() => t.remove(), opts.ms || 3600);
};
LOS.animOn = () => Store.settings().animations !== false && !matchMedia('(prefers-reduced-motion: reduce)').matches;
LOS.confetti = (n = 60) => {
  if (!LOS.animOn()) return;
  const w = document.createElement('div'); w.className = 'confetti';
  const cols = ['#9C6B4E', '#D9C7B8', '#B5A291', '#E9DED3', '#8A9A7E', '#C9A98F', '#37352F', '#E4D3C2'];
  for (let i = 0; i < n; i++) { const p = document.createElement('i'); p.style.left = Math.random() * 100 + 'vw'; p.style.background = cols[i % cols.length]; p.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px'); p.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg'); p.style.animationDelay = Math.random() * .35 + 's'; w.appendChild(p); }
  document.body.appendChild(w); setTimeout(() => w.remove(), 2400);
};
const CHEERS = ['Nicely done ✿', 'One less thing — lovely.', 'Look at you go!', 'Done and dusted.', 'Small wins count.', 'That’s progress ♡'];
LOS.cheer = (big) => { LOS.toast(CHEERS[Math.floor(Math.random() * CHEERS.length)]); if (big) LOS.confetti(90); else LOS.confetti(26); };

LOS.SWATCHES = ['#9C6B4E', '#C98770', '#B5A291', '#8A9A7E', '#5E7F55', '#3F8F3F', '#159C8C', '#4A8FA8', '#3577C4', '#5468B8', '#7B62C9', '#9B6BB0', '#C46A9E', '#D9638F', '#E07A7A', '#D0643F', '#E08A3C', '#E0A21A', '#C9B037', '#8E7A5A', '#6B6259', '#37352F', '#A3A39B', '#D4B8A8'];
const ILL = `<svg class="ill" viewBox="0 0 120 90"><ellipse cx="60" cy="80" rx="40" ry="6" fill="#F1EBE4"/><path d="M40 78c-6-22 4-46 20-56 16 10 26 34 20 56z" fill="#E6D8CB"/><path d="M60 22v56" stroke="#9C6B4E" stroke-width="2"/><path d="M60 46c-8-4-12-10-12-16M60 58c8-4 12-10 12-16" stroke="#9C6B4E" stroke-width="2" fill="none"/><circle cx="92" cy="22" r="6" fill="#E9DED3"/><circle cx="26" cy="34" r="4" fill="#D6D3C6"/></svg>`;
LOS.empty = (title, text = '', action = '') => `<div class="empty">${ILL}<b>${esc(title)}</b>${text ? `<div class="small">${esc(text)}</div>` : ''}${action}</div>`;

let modalStack = [];
LOS.modal = ({title, body, foot = '', size = '', onMount, onClose}) => {
  const wrap = document.createElement('div'); wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-h"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">${I('x')}</button></div><div class="modal-b">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}</div>`;
  const prevFocus = document.activeElement;
  const m = {el: wrap, close() { wrap.remove(); modalStack = modalStack.filter(x => x !== m); onClose && onClose(); prevFocus && prevFocus.focus && prevFocus.focus(); if (LOS._deferRender) LOS.render(); }};
  wrap.addEventListener('mousedown', e => { if (e.target === wrap && !wrap.querySelector('form,textarea,input:not([type=checkbox])')) m.close(); });
  wrap.querySelector('[data-close]').onclick = () => m.close();
  $('#modal-root').appendChild(wrap); modalStack.push(m);
  setTimeout(() => { const f = wrap.querySelector('input:not([type=hidden]):not([type=checkbox]),select,textarea,button.primary'); f && f.focus(); }, 30);
  onMount && onMount(wrap, m);
  requestAnimationFrame(() => $$('.progress>i[data-w]', wrap).forEach(i => i.style.width = i.dataset.w + '%'));
  LOS.animateRings && LOS.animateRings(wrap);
  return m;
};
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalStack.length) modalStack[modalStack.length - 1].close();
  if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !modalStack.length) { e.preventDefault(); LOS.actions['quick-add'](); }
});
LOS.confirm = (msg, {ok = 'Delete', danger = true, title = 'Are you sure?'} = {}) => new Promise(res => {
  let done = false;
  const m = LOS.modal({title, size: 'narrow', body: `<p style="margin:0;color:var(--ink-2)">${esc(msg)}</p>`,
    foot: `<button class="btn" data-no>Cancel</button><button class="btn ${danger ? 'terra' : 'primary'}" data-yes>${esc(ok)}</button>`,
    onClose: () => { if (!done) res(false); },
    onMount: el => { el.querySelector('[data-no]').onclick = () => m.close(); el.querySelector('[data-yes]').onclick = () => { done = true; res(true); m.close(); }; }});
});

/* form builder */
const optList = o => (o || []).map(x => typeof x === 'object' ? x : {v: x, l: x});
function fieldHtml(f, v) {
  const id = 'f_' + f.k, req = f.required ? ' <span style="color:var(--terra)">*</span>' : '';
  const full = f.full || ['textarea', 'list', 'image', 'links', 'ingredients'].includes(f.type) ? ' full' : '';
  let inner = '';
  const val = v ?? f.def ?? '';
  switch (f.type) {
    case 'textarea': inner = `<textarea id="${id}" name="${f.k}" rows="${f.rows || 3}" placeholder="${esc(f.ph || '')}">${esc(val)}</textarea>`; break;
    case 'select': inner = `<select id="${id}" name="${f.k}">${f.blank ? `<option value="">${esc(f.blank)}</option>` : ''}${optList(typeof f.options === 'function' ? f.options() : f.options).map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(val) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`; break;
    case 'check': inner = `<label class="check"><input type="checkbox" class="cb" id="${id}" name="${f.k}" ${val ? 'checked' : ''}> <span class="small">${esc(f.text || '')}</span></label>`; break;
    case 'list': case 'links': {
      const items = Array.isArray(val) ? val : [];
      const row = it => f.type === 'links'
        ? `<div class="row" data-li="${esc(it.id || uid())}"><input class="input" placeholder="Label" value="${esc(it.name || '')}" data-ln><input class="input" placeholder="https://…" value="${esc(it.url || '')}" data-lu><button type="button" class="icon-btn sm" data-del-li aria-label="Remove">${I('x')}</button></div>`
        : `<div class="row" data-li="${esc(it.id || uid())}" data-done="${it.done ? 1 : 0}" data-at="${esc(it.doneAt || '')}"><input class="input" value="${esc(it.t || '')}" placeholder="${esc(f.ph || 'Add item')}" data-lt><button type="button" class="icon-btn sm" data-del-li aria-label="Remove">${I('x')}</button></div>`;
      inner = `<div class="list-editor" id="${id}" data-type="${f.type}">${items.map(row).join('')}<template>${row({})}</template><button type="button" class="btn sm" data-add-li>${I('plus')} ${esc(f.addLabel || 'Add')}</button></div>`; break;
    }
    case 'ingredients': {
      const items = Array.isArray(val) ? val : [];
      const cats = LOS.GROCERY_CATS || [];
      const row = it => `<div class="row" data-li="${esc(it.id || uid())}"><input class="input" placeholder="Ingredient" value="${esc(it.item || '')}" data-ii><input class="input" style="max-width:110px" placeholder="Qty" value="${esc(it.qty || '')}" data-iq><select class="input" style="max-width:150px" data-ic>${cats.map(c => `<option ${c === it.cat ? 'selected' : ''}>${c}</option>`).join('')}</select><button type="button" class="icon-btn sm" data-del-li aria-label="Remove">${I('x')}</button></div>`;
      inner = `<div class="list-editor" id="${id}" data-type="ingredients">${items.map(row).join('')}<template>${row({})}</template><button type="button" class="btn sm" data-add-li>${I('plus')} Add ingredient</button></div>`; break;
    }
    case 'color': {
      const sw = LOS.SWATCHES;
      inner = `<div class="swatches" id="${id}" data-color-field>${sw.map(c => `<button type="button" class="sw ${String(val).toLowerCase() === c.toLowerCase() ? 'on' : ''}" style="background:${c}" data-c="${c}" aria-label="Colour ${c}"></button>`).join('')}<label class="sw custom" data-tip="Pick any colour" style="background:${sw.includes(val) || !val ? 'conic-gradient(#e57373,#ffb74d,#fff176,#81c784,#64b5f6,#ba68c8,#e57373)' : esc(val)}"><input type="color" value="${esc(val || '#9C6B4E')}" aria-label="Custom colour"></label><input type="hidden" name="${f.k}" value="${esc(val)}"></div>`; break;
    }
    case 'image': {
      const src = LOS.imgSrc(val);
      inner = `<div class="row" data-imgfield="${f.k}"><div class="thumb" style="width:72px;height:72px;border-radius:14px;overflow:hidden;display:grid;place-items:center">${src ? `<img src="${esc(src)}" alt="" style="width:100%;height:100%;object-fit:cover">` : I('image')}</div><button type="button" class="btn sm" data-pick-img>${I('upload')} ${src ? 'Replace' : 'Upload'} image</button>${src && !f.noClear ? `<button type="button" class="btn sm ghost" data-clear-img>Remove</button>` : ''}<span class="tiny muted" data-img-name></span></div>`; break;
    }
    default: {
      const type = f.type === 'money' ? 'number' : (f.type || 'text');
      const extra = f.type === 'money' ? ' step="0.01" min="0" inputmode="decimal"' : f.type === 'number' ? ` step="${f.step || 'any'}" ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.max !== undefined ? `max="${f.max}"` : ''}` : '';
      const vv = f.type === 'tags' ? (Array.isArray(val) ? val.join(', ') : val) : val;
      inner = `<input id="${id}" name="${f.k}" type="${type === 'tags' ? 'text' : type}" value="${esc(vv)}" placeholder="${esc(f.ph || '')}"${extra} ${f.list ? `list="dl_${f.k}"` : ''}>${f.list ? `<datalist id="dl_${f.k}">${(typeof f.list === 'function' ? f.list() : f.list).map(x => `<option value="${esc(x)}">`).join('')}</datalist>` : ''}`;
    }
  }
  return `<div class="field${full}" data-field="${f.k}"><label for="${id}">${esc(f.label)}${req}</label>${inner}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}<div class="err"></div></div>`;
}
LOS.formHtml = (fields, values = {}) => `<form class="form-grid" novalidate>${fields.map(f => f.section ? `<div class="full eyebrow" style="margin-top:6px">${esc(f.section)}</div>` : fieldHtml(f, values[f.k])).join('')}</form>`;
function bindForm(el, fields, values, imgState) {
  el.addEventListener('click', async e => {
    const add = e.target.closest('[data-add-li]');
    if (add) { const le = add.parentElement; const tpl = le.querySelector('template'); const node = tpl.content.firstElementChild.cloneNode(true); node.dataset.li = uid(); le.insertBefore(node, add); const inp = node.querySelector('input'); inp && inp.focus(); return; }
    const del = e.target.closest('[data-del-li]'); if (del) { del.parentElement.remove(); return; }
    const pick = e.target.closest('[data-pick-img]');
    if (pick) { const wrap = pick.closest('[data-imgfield]'); const k = wrap.dataset.imgfield; const [file] = await LOS.pickImages(false); if (!file) return; if (!LOS.validImage(file)) { LOS.toast('Please choose a JPG, PNG or WEBP image.'); return; } imgState[k] = {file}; const u = URL.createObjectURL(file); wrap.querySelector('.thumb').innerHTML = `<img src="${u}" alt="" style="width:100%;height:100%;object-fit:cover">`; wrap.querySelector('[data-img-name]').textContent = file.name; return; }
    const clr = e.target.closest('[data-clear-img]'); if (clr) { const wrap = clr.closest('[data-imgfield]'); imgState[wrap.dataset.imgfield] = {clear: true}; wrap.querySelector('.thumb').innerHTML = I('image'); clr.remove(); }
  });
  el.addEventListener('click', e => { const b = e.target.closest('[data-color-field] .sw[data-c]'); if (!b) return; const w = b.parentElement; w.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === b)); w.querySelector('input[type=hidden]').value = b.dataset.c; });
  el.addEventListener('input', e => { if (e.target.matches('[data-color-field] input[type=color]')) { const w = e.target.closest('[data-color-field]'); w.querySelectorAll('.sw').forEach(x => x.classList.remove('on')); const lab = e.target.parentElement; lab.classList.add('on'); lab.style.background = e.target.value; w.querySelector('input[type=hidden]').value = e.target.value; } });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.list-editor input')) { e.preventDefault(); e.target.closest('.list-editor').querySelector('[data-add-li]').click(); } });
}
LOS.readForm = (el, fields, values = {}) => {
  const out = {}, errs = {};
  for (const f of fields) {
    if (f.section) continue;
    const wrap = el.querySelector(`[data-field="${f.k}"]`); if (!wrap) continue;
    let v;
    if (f.type === 'check') v = wrap.querySelector('input').checked;
    else if (f.type === 'list') { const old = Object.fromEntries((values[f.k] || []).map(x => [x.id, x])); v = $$('[data-li]', wrap).filter(r => !r.closest('template')).map(r => ({...(old[r.dataset.li] || {}), id: r.dataset.li, t: r.querySelector('[data-lt]').value.trim()})).filter(x => x.t); }
    else if (f.type === 'links') v = $$('[data-li]', wrap).filter(r => !r.closest('template')).map(r => ({id: r.dataset.li, name: r.querySelector('[data-ln]').value.trim(), url: r.querySelector('[data-lu]').value.trim()})).filter(x => x.url || x.name);
    else if (f.type === 'ingredients') v = $$('[data-li]', wrap).filter(r => !r.closest('template')).map(r => ({id: r.dataset.li, item: r.querySelector('[data-ii]').value.trim(), qty: r.querySelector('[data-iq]').value.trim(), cat: r.querySelector('[data-ic]').value})).filter(x => x.item);
    else if (f.type === 'image') continue;
    else if (f.type === 'color') v = wrap.querySelector('input[type=hidden]').value;
    else { const inp = wrap.querySelector('input,select,textarea'); v = inp.value.trim(); }
    let err = '';
    if (f.required && (v === '' || v == null || (Array.isArray(v) && !v.length))) err = 'This is required';
    if (!err && (f.type === 'money' || f.type === 'number') && v !== '') {
      const n = Number(v);
      if (!isFinite(n)) err = 'Enter a number';
      else if (f.type === 'money' && n < 0) err = 'Can’t be negative';
      else if (f.min !== undefined && n < f.min) err = 'Must be at least ' + f.min;
      else if (f.max !== undefined && n > f.max) err = 'Must be at most ' + f.max;
      else v = f.type === 'money' ? round2(n) : n;
    }
    if (!err && (f.type === 'money' || f.type === 'number') && v === '') v = f.required ? v : null;
    if (!err && f.type === 'url' && v && !/^https?:\/\/\S+\.\S+/i.test(v)) err = 'Enter a full link starting with https://';
    if (!err && f.type === 'links') { const bad = v.find(x => x.url && !/^https?:\/\//i.test(x.url)); if (bad) err = 'Links must start with https://'; }
    if (!err && f.type === 'tags') v = v ? v.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (!err && f.validate) err = f.validate(v, out) || '';
    wrap.classList.toggle('invalid', !!err); wrap.querySelector('.err').textContent = err;
    if (err) errs[f.k] = err; else out[f.k] = v;
  }
  for (const f of fields) if (f.after && !errs[f.k] && out[f.k] && out[f.after] && out[f.k] < out[f.after]) { errs[f.k] = 'Can’t be before ' + (fields.find(x => x.k === f.after) || {}).label; const w = el.querySelector(`[data-field="${f.k}"]`); w.classList.add('invalid'); w.querySelector('.err').textContent = errs[f.k]; }
  return {ok: !Object.keys(errs).length, data: out, errs};
};
LOS.openForm = ({title, fields, values = {}, onSave, onDelete, size = '', saveLabel = 'Save', extraFoot = ''}) => {
  const imgState = {};
  const m = LOS.modal({title, size, body: LOS.formHtml(fields, values),
    foot: `${onDelete ? `<button class="btn danger left" data-del>${I('trash')} Delete</button>` : ''}${extraFoot}<button class="btn" data-cancel>Cancel</button><button class="btn primary" data-save>${esc(saveLabel)}</button>`,
    onMount: (el) => {
      bindForm(el, fields, values, imgState);
      const save = async () => {
        const r = LOS.readForm(el, fields, values);
        if (!r.ok) { const f = el.querySelector('.invalid input,.invalid select,.invalid textarea'); f && f.focus(); return; }
        const btn = el.querySelector('[data-save]'); btn.disabled = true;
        try {
          for (const f of fields.filter(f => f.type === 'image')) {
            const st = imgState[f.k];
            if (st && st.file) { btn.textContent = 'Uploading…'; r.data[f.k] = await LOS.saveImage(st.file); if (values[f.k]) LOS.dropImage(values[f.k]); }
            else if (st && st.clear) { r.data[f.k] = null; if (values[f.k]) LOS.dropImage(values[f.k]); }
            else r.data[f.k] = values[f.k] || null;
          }
          const keep = await onSave(r.data);
          if (keep !== false) m.close();
        } catch (e) { LOS.toast(e.message || 'Something went wrong'); console.error(e); }
        btn.disabled = false; btn.textContent = saveLabel;
      };
      el.querySelector('[data-save]').onclick = save;
      el.querySelector('form').onsubmit = e => { e.preventDefault(); save(); };
      el.querySelector('[data-cancel]').onclick = () => m.close();
      if (onDelete) el.querySelector('[data-del]').onclick = async () => { if (await LOS.confirm('This will permanently delete it.')) { await onDelete(); m.close(); } };
    }});
  return m;
};
LOS.delWithConfirm = async (kind, id, label = 'this item', after) => {
  if (!(await LOS.confirm(`Delete ${label}? This can’t be undone.`))) return false;
  const o = Store.get(kind, id);
  if (o) ['image', 'photo', 'img'].forEach(k => o[k] && LOS.dropImage(o[k]));
  if (o && Array.isArray(o.photos)) o.photos.forEach(LOS.dropImage);
  Store.del(kind, id); (LOS.onDelete[kind] || []).forEach(f => { try { f(id, o); } catch (e) {} }); after && after(); LOS.toast('Deleted'); return true;
};

/* tooltip */
const tip = () => $('#tooltip');
document.addEventListener('mouseover', e => {
  const t = e.target.closest('[data-tip]'); if (!t) { tip().hidden = true; return; }
  tip().innerHTML = t.getAttribute('data-tip'); tip().hidden = false;
});
document.addEventListener('mousemove', e => { const t = tip(); if (t.hidden) return; const w = t.offsetWidth; t.style.left = Math.min(innerWidth - w - 8, e.clientX + 14) + 'px'; t.style.top = (e.clientY + 16) + 'px'; });
document.addEventListener('focusin', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) { const r = t.getBoundingClientRect(); tip().innerHTML = t.getAttribute('data-tip'); tip().hidden = false; tip().style.left = r.left + 'px'; tip().style.top = (r.bottom + 6) + 'px'; } });

/* ---------- router & rendering ---------- */
LOS.state = {page: 'home', tabs: {}, filters: {}};
LOS.register = (name, def) => { LOS.pages[name] = Object.assign({name}, def); LOS.order.push(name); };
LOS.tab = (page, def) => LOS.state.tabs[page] || def;
LOS.go = (page, opts = {}) => {
  if (!LOS.pages[page]) page = 'home';
  if (opts.tab) LOS.state.tabs[page] = opts.tab;
  LOS.state.page = page;
  if (location.hash.slice(1) !== page) { try { history.replaceState(null, '', '#' + page); } catch (e) { location.hash = page; } }
  document.body.classList.remove('side-open');
  LOS.render(true);
  window.scrollTo({top: 0});
};
LOS.render = (fresh) => {
  const view = $('#view');
  const ae = document.activeElement;
  if (!fresh && (modalStack.length || (ae && view.contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName) && ae.type !== 'checkbox'))) { LOS._deferRender = true; renderChrome(); return; }
  LOS._deferRender = false;
  const p = LOS.pages[LOS.state.page];
  const y = window.scrollY;
  let html;
  try { html = p.render(); } catch (e) { console.error(e); html = `<div class="notice peach">${I('info')}<div>Something went wrong showing this page: ${esc(e.message)}</div></div>`; }
  view.innerHTML = html;
  if (fresh && LOS.animOn()) { view.classList.remove('view-enter'); void view.offsetWidth; view.classList.add('view-enter'); }
  try { p.mount && p.mount(view); } catch (e) { console.error(e); }
  requestAnimationFrame(() => $$('.progress>i[data-w]', view).forEach(i => i.style.width = i.dataset.w + '%'));
  LOS.animateRings && LOS.animateRings(view);
  if (!fresh) window.scrollTo(0, y);
  renderChrome();
};
document.addEventListener('focusout', () => setTimeout(() => { if (LOS._deferRender && !modalStack.length) { const ae = document.activeElement; if (!(ae && $('#view').contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName))) LOS.render(); } }, 60));
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== LOS.state.page && LOS.pages[h]) LOS.go(h); });
window.addEventListener('scroll', () => $('#topbar').classList.toggle('scrolled', scrollY > 4), {passive: true});

const NAV_GROUPS = [['', ['home', 'today']], ['Plan', ['planner', 'goals']], ['Life admin', ['finance', 'career', 'learning']], ['Everyday', ['kitchen', 'wellness', 'selfcare', 'hobbies']], ['Reflect', ['vision', 'reports']], ['', ['notifications', 'settings']]];
function renderChrome() {
  const s = Store.settings(); const cur = LOS.state.page;
  const notifs = LOS.notifications ? LOS.notifications().filter(n => !n.read) : [];
  $('#nav').innerHTML = NAV_GROUPS.map(([g, items]) => {
    const vis = items.filter(n => LOS.pages[n] && !(s.hidden[n] && LOS.pages[n].hideable !== false));
    if (!vis.length) return '';
    return (g ? `<div class="nav-group eyebrow">${g}</div>` : '<div style="height:6px"></div>') + vis.map(n => {
      const p = LOS.pages[n];
      const badge = n === 'notifications' && notifs.length ? `<span class="count">${notifs.length}</span>` : '';
      return `<button class="nav-item ${n === cur ? 'active' : ''}" data-route="${n}" title="${esc(p.title)}">${I(p.icon)}<span>${esc(p.title)}</span>${badge}</button>`;
    }).join('');
  }).join('');
  const bc = $('#bell-count'); bc.hidden = !notifs.length; bc.textContent = notifs.length > 9 ? '9+' : notifs.length;
  document.body.classList.toggle('no-anim', s.animations === false);
  renderSync();
}
LOS.renderChrome = renderChrome;

/* page hero with uploadable cover */
const HERO_ART = {
  peach: ['#D9C7B8', '#EADFD5', '#F3ECE5', '#CDB9A7', '#E4D8CD'], sage: ['#CFCBBD', '#E6E3D9', '#F3F0EA', '#C4BFAE', '#DEDACE'],
  lav: ['#D3C8C2', '#E8E0DB', '#F4EFEB', '#C7BAB2', '#E0D6D0'], pink: ['#DCC6BF', '#ECDDD8', '#F5EDEA', '#CFB6AD', '#E6D5CF'], butter: ['#DACBB3', '#EBE2D2', '#F5F0E6', '#CDBC9F', '#E3D8C4']
};
const cap = t => t ? t.charAt(0).toUpperCase() + t.slice(1) + '.' : '';
LOS.hero = (page, {title, sub = '', tone = 'peach', actions = '', script = ''}) => {
  const cov = Store.settings().covers[page];
  const art = HERO_ART[tone] || HERO_ART.peach;
  const shapes = [`<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><circle cx="70" cy="35" r="30" fill="rgba(255,255,255,.25)"/><rect x="18" y="62" width="40" height="38" rx="3" fill="rgba(55,53,47,.06)"/></svg>`, `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><path d="M0 75 Q50 40 100 70 V100 H0z" fill="rgba(255,255,255,.35)"/><path d="M48 70 C46 50 52 35 50 18" stroke="rgba(55,53,47,.18)" stroke-width="1" fill="none"/></svg>`, '', `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><rect x="25" y="20" width="50" height="80" rx="25" fill="rgba(255,255,255,.3)"/></svg>`, `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><circle cx="30" cy="72" r="34" fill="rgba(255,255,255,.28)"/></svg>`];
  const cover = cov ? `<div class="cover" style="background-image:url('${esc(LOS.imgSrc(cov))}')"></div>` : `<div class="cover art">${art.map((c, i) => `<div style="background:${c}">${i === 2 ? `<div class="hq">${esc(cap(script) || title)}</div>` : shapes[i]}</div>`).join('')}</div>`;
  return `<section class="page-hero"><div class="banner">${cover}<button class="btn sm cover-btn" data-action="set-cover" data-page="${page}">${I('image')} ${cov ? 'Change cover' : 'Add cover photo'}</button></div>
    <div class="hero-in"><div class="grow"><h1>${esc(title)}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${actions ? `<div class="row wrap">${actions}</div>` : ''}</div></section>`;
};
LOS.actions['set-cover'] = async el => {
  const page = el.dataset.page; const cur = Store.settings().covers[page];
  const m = LOS.modal({title: 'Cover photo', size: 'narrow', body: `<p class="small muted" style="margin-top:0">Upload a wide photo for the top of this page. It’s compressed and saved with your data.</p>`,
    foot: `${cur ? '<button class="btn danger left" data-rm>Remove cover</button>' : ''}<button class="btn primary" data-up>${I('upload')} Choose photo</button>`,
    onMount: (w) => {
      w.querySelector('[data-up]').onclick = async () => { const [f] = await LOS.pickImages(false); if (!f) return; try { LOS.toast('Uploading…'); const ref = await LOS.saveImage(f, 2000); if (cur) LOS.dropImage(cur); Store.setSettings({covers: {...Store.settings().covers, [page]: ref}}); m.close(); } catch (e) { LOS.toast(e.message); } };
      const rm = w.querySelector('[data-rm]'); if (rm) rm.onclick = () => { LOS.dropImage(cur); const c = {...Store.settings().covers}; delete c[page]; Store.setSettings({covers: c}); m.close(); };
    }});
};

LOS.tabsHtml = (page, tabs, cur) => `<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${k === cur}" class="${k === cur ? 'on' : ''}" data-action="tab" data-page="${page}" data-tab="${k}">${l}</button>`).join('')}</div>`;
LOS.actions.tab = el => { LOS.state.tabs[el.dataset.page] = el.dataset.tab; LOS.render(true); };
LOS.seg = (key, opts, cur, action = 'seg') => `<div class="seg" role="group">${opts.map(([k, l]) => `<button class="${k === cur ? 'on' : ''}" data-action="${action}" data-key="${key}" data-val="${k}">${l}</button>`).join('')}</div>`;
LOS.actions.seg = el => { LOS.state.filters[el.dataset.key] = el.dataset.val; LOS.render(); };
LOS.filter = (k, def) => LOS.state.filters[k] ?? def;
LOS.delBtn = (kind, id, label = 'this item', cls = 'sm') => `<button class="icon-btn ${cls} del" data-action="del-rec" data-kind="${kind}" data-id="${esc(id)}" data-label="${esc(label)}" data-tip="Delete" aria-label="Delete ${esc(label)}">${I('trash')}</button>`;
LOS.actions['del-rec'] = (el, e) => { if (e) e.stopPropagation(); LOS.delWithConfirm(el.dataset.kind, el.dataset.id, el.dataset.label); };
/* period pickers: year list spans your data, so past years stay reachable */
LOS.years = () => {
  const now = +D.today().slice(0, 4); let min = now;
  Object.values(Store.mem).forEach(m => m.forEach(o => { for (const k of ['date', 'due', 'completedAt', 'appDate', 'start', 'id']) { const v = o[k]; if (typeof v === 'string' && /^\d{4}-\d{2}/.test(v)) { const y = +v.slice(0, 4); if (y >= 2000 && y < min) min = y; } } if (o.createdAt) { const y = new Date(o.createdAt).getFullYear(); if (y >= 2000 && y < min) min = y; } }));
  min = Math.min(min, now - 3); (Store.settings().extraYears || []).forEach(y => { if (+y < min) min = +y; });
  let max = now + 5; (Store.settings().extraYears || []).forEach(y => { if (+y > max) max = +y; });
  const out = []; for (let y = max; y >= min; y--) out.push(String(y)); return out;
};
LOS.yearSelect = (key, year) => { const ys = LOS.years(); if (!ys.includes(String(year))) ys.push(String(year)); return `<select class="input" style="width:auto" data-change="period-year" data-key="${key}" aria-label="Year">${ys.sort().reverse().map(y => `<option ${y === String(year) ? 'selected' : ''}>${y}</option>`).join('')}<option value="__other">Other year…</option></select>`; };
LOS.askYear = (cb, cancel) => LOS.openForm({title: 'Go to year', size: 'narrow', saveLabel: 'Go', fields: [{k: 'y', label: 'Year', type: 'number', min: 1950, max: 2150, step: 1, required: true}], values: {y: +D.today().slice(0, 4) + 6},
  onSave: d => { const y = String(Math.round(d.y)); const ex = Store.settings().extraYears || []; if (!ex.includes(y)) Store.setSettings({extraYears: [...ex, y]}, {silent: true}); cb(y); }});
LOS.monthPicker = (key, month, opts = {}) => {
  const [y, mo] = month.split('-');
  const months = Array.from({length: 12}, (_, i) => D.mname(`2026-${String(i + 1).padStart(2, '0')}`, {month: opts.short ? 'short' : 'long'}));
  return `<div class="row" style="gap:6px;flex-wrap:wrap"><button class="icon-btn" data-action="period-step" data-key="${key}" data-d="-1" aria-label="Previous month">${I('left')}</button><select class="input" style="width:auto" data-change="period-month" data-key="${key}" data-y="${y}" aria-label="Month">${months.map((n, i) => `<option value="${String(i + 1).padStart(2, '0')}" ${+mo === i + 1 ? 'selected' : ''}>${n}</option>`).join('')}</select><select class="input" style="width:auto" data-change="period-myear" data-key="${key}" data-m="${mo}" aria-label="Year">${(() => { const ys = LOS.years(); if (!ys.includes(y)) ys.push(y); return ys.sort().reverse().map(x => `<option ${x === y ? 'selected' : ''}>${x}</option>`).join('') + '<option value="__other">Other year…</option>'; })()}</select><button class="icon-btn" data-action="period-step" data-key="${key}" data-d="1" aria-label="Next month">${I('right')}</button>${month !== D.month() ? `<button class="btn sm" data-action="period-today" data-key="${key}">This month</button>` : ''}</div>`;
};
LOS.actions['period-year'] = el => { const v = el.value || el.getAttribute('value'); if (v === '__other') { LOS.render(); return LOS.askYear(y => { LOS.state.filters[el.dataset.key] = y; LOS.render(); }); } LOS.state.filters[el.dataset.key] = v; LOS.render(); };
LOS.actions['period-month'] = el => { LOS.state.filters[el.dataset.key] = el.dataset.y + '-' + el.value; LOS.render(); };
LOS.actions['period-myear'] = el => { if (el.value === '__other') { LOS.render(); return LOS.askYear(y => { LOS.state.filters[el.dataset.key] = y + '-' + el.dataset.m; LOS.render(); }); } LOS.state.filters[el.dataset.key] = el.value + '-' + el.dataset.m; LOS.render(); };
LOS.actions['period-step'] = el => { LOS.state.filters[el.dataset.key] = D.monthAdd(LOS.state.filters[el.dataset.key] || D.month(), +el.dataset.d); LOS.render(); };
LOS.actions['period-today'] = el => { LOS.state.filters[el.dataset.key] = D.month(); LOS.render(); };
LOS.actions['period-date'] = el => { if (el.value) { LOS.state.filters[el.dataset.key] = el.dataset.week ? D.weekStart(el.value) : el.value; LOS.render(); } };
LOS.bar = (p, cls = '', tipText) => `<div class="progress ${cls}" ${tipText ? `data-tip="${esc(tipText)}"` : ''}><i data-w="${clamp(p, 0, 100)}"></i></div>`;

/* global delegation */
document.addEventListener('click', e => {
  if (e.target.closest('a[href]')) return;
  const r = e.target.closest('[data-route]');
  const a = e.target.closest('[data-action]');
  if (r && !(a && r.contains(a) && a !== r) && !e.target.closest('.modal')) { e.preventDefault(); LOS.go(r.dataset.route, {tab: r.dataset.tab}); return; }
  if (a && LOS.actions[a.dataset.action]) { if (a.tagName !== 'INPUT') e.preventDefault(); LOS.actions[a.dataset.action](a, e); }
});
document.addEventListener('change', e => { const a = e.target.closest('[data-change]'); if (a && LOS.actions[a.dataset.change]) LOS.actions[a.dataset.change](a, e); });
document.addEventListener('input', e => { const a = e.target.closest('[data-input]'); if (a && LOS.actions[a.dataset.input]) LOS.actions[a.dataset.input](a, e); });

LOS.actions['toggle-sidebar'] = () => { const c = !document.body.classList.contains('side-collapsed'); document.body.classList.toggle('side-collapsed', c); Store.setSettings({sidebarCollapsed: c}, {silent: true}); };
LOS.actions['open-sidebar'] = () => document.body.classList.add('side-open');
LOS.actions['close-sidebar'] = () => document.body.classList.remove('side-open');

/* quick add */
LOS.actions['quick-add'] = () => {
  const items = LOS.quick;
  const m = LOS.modal({title: 'Quick add', size: 'narrow', body: `<p class="small muted" style="margin:-4px 0 14px">Capture it now, sort it later. Tip: press <b>N</b> anywhere.</p>
    <form id="qa-task" class="stack"><div class="field"><label for="qa-t">New task</label><input id="qa-t" placeholder="What’s on your mind?" autocomplete="off"></div>
    <div class="row wrap"><select class="input" id="qa-d" style="width:auto"><option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="">No date</option></select>
    <select class="input" id="qa-p" style="width:auto"><option>Medium</option><option>Critical</option><option>High</option><option>Low</option></select><span class="grow"></span><button class="btn primary">Add task</button></div></form>
    <div class="divider"></div><div class="eyebrow" style="margin-bottom:10px">Or add…</div>
    <div class="grid g2" style="gap:8px">${items.map((q, i) => `<button class="btn" data-qi="${i}" style="justify-content:flex-start">${I(q.icon)} ${esc(q.label)}</button>`).join('')}</div>`,
    onMount: el => {
      el.querySelector('#qa-task').onsubmit = e => {
        e.preventDefault(); const t = el.querySelector('#qa-t').value.trim(); if (!t) { el.querySelector('#qa-t').focus(); return; }
        const dsel = el.querySelector('#qa-d').value; const due = dsel === 'today' ? D.today() : dsel === 'tomorrow' ? D.add(D.today(), 1) : '';
        LOS.Tasks.create({title: t, due, priority: el.querySelector('#qa-p').value, status: 'To Do'});
        LOS.toast('Task added'); m.close();
      };
      el.querySelectorAll('[data-qi]').forEach(b => b.onclick = () => { m.close(); items[+b.dataset.qi].open(); });
    }});
};

/* global search */
const searchInput = () => $('#global-search');
const doSearch = debounce(() => {
  const q = searchInput().value.trim().toLowerCase(); const box = $('#search-results');
  if (q.length < 2) { box.hidden = true; return; }
  const res = [];
  LOS.searchProviders.forEach(p => { try { res.push(...p(q)); } catch (e) {} });
  box.innerHTML = res.length ? res.slice(0, 30).map((r, i) => `<button data-sr="${i}">${I(r.icon)}<span class="grow"><b style="font-weight:500">${esc(r.title)}</b><br><span class="tiny muted">${esc(r.sub || '')}</span></span></button>`).join('') : `<div class="small muted" style="padding:12px">No matches for “${esc(q)}”.</div>`;
  box.hidden = false;
  box.querySelectorAll('[data-sr]').forEach(b => b.onclick = () => { box.hidden = true; searchInput().value = ''; res[+b.dataset.sr].open(); });
}, 120);
document.addEventListener('input', e => { if (e.target.id === 'global-search') doSearch(); });
document.addEventListener('click', e => { if (!e.target.closest('.search-wrap')) $('#search-results').hidden = true; });
LOS.match = (q, ...fields) => fields.some(f => String(f || '').toLowerCase().includes(q));

/* ---------- export / backup ---------- */
LOS.exportFile = async (filename, text, mime = 'application/json') => {
  if (Store.downloads) {
    try { await Store.downloads.save({filename, data: text}); LOS.toast('Saved ' + filename); return; }
    catch (e) { if (e && (e.code === 'declined' || e.code === 'rate_limited')) return; console.warn(e); }
  }
  try {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type: mime})); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    if (!window.claude) { LOS.toast('Downloaded ' + filename); return; }
  } catch (e) {}
  if (text.length > 1500000) { LOS.modal({title: 'Download blocked', size: 'narrow', body: `<p class="small" style="margin-top:0">Your browser blocked the download from inside this page. Open the app in its own tab (or the installed app) and try again.</p>`}); return; }
  LOS.modal({title: 'Your export', size: 'wide', body: `<p class="small muted" style="margin-top:0">If a download didn’t start, copy this and save it as <b>${esc(filename)}</b>.</p><textarea class="input" style="height:300px;font:12px ui-monospace,monospace" readonly>${esc(text)}</textarea>`, foot: `<button class="btn primary" data-cp>${I('copy')} Copy</button>`, onMount: el => el.querySelector('[data-cp]').onclick = async () => { try { await navigator.clipboard.writeText(text); LOS.toast('Copied'); } catch (e) { el.querySelector('textarea').select(); LOS.toast('Press Ctrl/Cmd+C to copy'); } }});
};
LOS.toCSV = (rows, cols) => [cols.map(c => c[0]).join(','), ...rows.map(r => cols.map(c => { let v = typeof c[1] === 'function' ? c[1](r) : r[c[1]]; if (Array.isArray(v)) v = v.join('; '); v = String(v ?? ''); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','))].join('\n');
/* Photos: walk every image reference inside a record (image, photo, photos[], covers, tiles, profile…) */
const isRef = o => o && typeof o === 'object' && !Array.isArray(o) && (('asset' in o) || (typeof o.data === 'string' && o.data.startsWith('data:image/')));
async function mapRefs(o, fn) {
  if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) o[i] = isRef(o[i]) ? await fn(o[i]) : (o[i] && typeof o[i] === 'object' ? await mapRefs(o[i], fn) : o[i]); return o; }
  for (const k of Object.keys(o)) { const v = o[k]; if (isRef(v)) o[k] = await fn(v); else if (v && typeof v === 'object') await mapRefs(v, fn); }
  return o;
}
const blobToData = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
const dataToBlob = d => { const [h, b64] = d.split(','); const mime = (h.match(/data:([^;]+)/) || [])[1] || 'image/jpeg'; const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], {type: mime}); };
/* Backup that carries the photos inside the file, so it can move between the claude.ai version and the installed app */
LOS.dumpAllWithPhotos = async (progress) => {
  const out = JSON.parse(JSON.stringify(LOS.dumpAll())); out.photos = 'embedded'; let n = 0, failed = 0;
  for (const rec of out.records) await mapRefs(rec, async ref => {
    if (ref.data) return ref;
    try { const r = await fetch(LOS.imgSrc(ref)); if (!r.ok) throw new Error(r.status); const data = await blobToData(await r.blob()); n++; progress && progress(n); return {data, w: ref.w, h: ref.h}; }
    catch (e) { failed++; return ref; }
  });
  out.photoCount = n; out.photosMissing = failed; return out;
};
/* On restore: in claude.ai, embedded photos are uploaded as files (records have a size limit); on the installed app they stay inside the record */
LOS.prepareRestoredRecord = async rec => mapRefs(rec, async ref => {
  if (ref.data && Store.mode === 'cloud' && Store.assets) { try { const up = await Store.assets.upload(dataToBlob(ref.data)); return {asset: up.id, url: up.url, w: ref.w, h: ref.h}; } catch (e) { console.warn(e); return null; } }
  if (!ref.data && Store.mode !== 'cloud') return null; // a claude.ai photo link that can't be opened here
  return ref;
});
LOS.dumpAll = () => { const out = {app: 'Organize Life Co.', version: 1, exportedAt: new Date().toISOString(), records: []}; Object.values(Store.mem).forEach(m => m.forEach(o => out.records.push(o))); return out; };

})();
