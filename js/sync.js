/* Organize Life Co. — end-to-end encrypted sync between your devices (via your own Cloudflare Worker).
   Everything is encrypted on the device with a key made from your passphrase before it is sent.
   Works only in the installed app / website (not inside claude.ai, which blocks outside connections). */
(function(){
'use strict';
const {esc, D, Store, icon: I} = LOS;
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = buf => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const META = '__sync';

const Sync = LOS.Sync = {
  cfg: null, key: null, state: 'off', msg: '', lastAt: 0, running: false, again: false, timer: null,
  available: () => !!(window.crypto && crypto.subtle) && Store.mode === 'local' && !window.claude,

  async deriveKeys(url, pass) {
    const host = new URL(url).host.toLowerCase();
    const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('organize-life-sync:v1:' + host), iterations: 310000}, base, 512);
    const all = new Uint8Array(bits);
    return {rawKey: b64(all.slice(0, 32)), token: hex(all.slice(32))};
  },
  async loadKey() { this.key = await crypto.subtle.importKey('raw', unb64(this.cfg.rawKey), 'AES-GCM', false, ['encrypt', 'decrypt']); },
  async encrypt(str) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, this.key, enc.encode(str)); const out = new Uint8Array(12 + ct.byteLength); out.set(iv); out.set(new Uint8Array(ct), 12); return b64(out); },
  async decrypt(s) { const u = unb64(s); const pt = await crypto.subtle.decrypt({name: 'AES-GCM', iv: u.slice(0, 12)}, this.key, u.slice(12)); return dec.decode(pt); },

  save() { if (this.cfg) Store.metaSet(META, this.cfg); },
  async api(path, opts = {}) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), opts.timeout || 30000);
    try {
      const res = await fetch(this.cfg.url.replace(/\/+$/, '') + path, {...opts, signal: ctl.signal, headers: {'Authorization': 'Bearer ' + this.cfg.token, ...(opts.body && typeof opts.body === 'string' && opts.body[0] === '{' ? {'Content-Type': 'application/json'} : {}), ...(opts.headers || {})}});
      if (res.status === 403) throw Object.assign(new Error('This passphrase doesn’t match the one used to set up this sync space.'), {fatal: true});
      if (!res.ok) { let m = res.status; try { m = (await res.json()).error || m; } catch (e) {} throw new Error('Sync service: ' + m); }
      return res;
    } finally { clearTimeout(t); }
  },
  setState(state, msg) { this.state = state; this.msg = msg || ''; LOS.renderSyncBadge && LOS.renderSyncBadge(); if (LOS.state.page === 'settings' && !document.querySelector('.modal-wrap') && !(document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName))) LOS.render(); },

  async init() {
    if (!this.available()) return;
    this.cfg = await Store.metaGet(META);
    if (!this.cfg || !this.cfg.url) return;
    try { await this.loadKey(); } catch (e) { this.setState('error', 'Couldn’t load your sync key — reconnect in Settings.'); return; }
    this.cfg.dirty = this.cfg.dirty || []; this.cfg.blobs = this.cfg.blobs || [];
    this.setState('idle'); this.listening = true;
    this.run();
    setInterval(() => this.run(), 60000);
    addEventListener('online', () => this.run());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.run(); });
  },
  async connect(url, pass) {
    url = url.trim().replace(/\/+$/, '');
    if (!/^https:\/\/[^\s/]+/.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url)) throw new Error('Enter your Worker address, starting with https://');
    if (pass.length < 10) throw new Error('Use a passphrase of at least 10 characters.');
    const r = await fetch(url + '/health').then(r => r.json()).catch(() => null);
    if (!r || r.app !== 'organize-life-sync') throw new Error('Couldn’t reach the sync service at that address. Check the URL and that the Worker is deployed.');
    const {rawKey, token} = await this.deriveKeys(url, pass);
    this.cfg = {url, rawKey, token, lastSeq: 0, dirty: [], blobs: [], connectedAt: Date.now(), device: navigator.userAgent.includes('iPhone') ? 'iPhone' : navigator.userAgent.includes('Android') ? 'Android phone' : 'Computer'};
    await this.loadKey();
    await this.api('/stats'); // validates the passphrase (or claims an empty space)
    Object.values(Store.mem).forEach(m => m.forEach(o => this.cfg.dirty.push(o.kind + '--' + o.id)));
    this.save(); this.setState('idle');
    if (!this.listening) { this.listening = true; setInterval(() => this.run(), 60000); addEventListener('online', () => this.run()); document.addEventListener('visibilitychange', () => { if (!document.hidden) this.run(); }); }
    await this.run(true);
  },
  disconnect() { Store.metaSet(META, null); this.cfg = null; this.key = null; this.setState('off'); },
  markDirty(docId) {
    if (!this.cfg) return;
    if (!this.cfg.dirty.includes(docId)) this.cfg.dirty.push(docId);
    this.save(); clearTimeout(this.timer); this.timer = setTimeout(() => this.run(), 2500);
  },

  /* photos travel as separate encrypted blobs, addressed by a keyed hash */
  async stripPhotos(obj) {
    const walk = async o => {
      if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) o[i] = await one(o[i]); return o; }
      for (const k of Object.keys(o)) o[k] = await one(o[k]); return o;
    };
    const one = async v => {
      if (v && typeof v === 'object' && typeof v.data === 'string' && v.data.startsWith('data:image/')) {
        const id = await sha(this.cfg.token + '|' + v.data);
        if (!this.cfg.blobs.includes(id)) {
          const have = await (await this.api('/blobs/have', {method: 'POST', body: JSON.stringify({ids: [id]})})).json();
          if (!have.have.includes(id)) await this.api('/blob/' + id, {method: 'PUT', body: await this.encrypt(v.data), headers: {'Content-Type': 'text/plain'}, timeout: 120000});
          this.cfg.blobs.push(id);
        }
        LOS.blobCache.set(id, v.data);
        return {blob: id, w: v.w, h: v.h};
      }
      return v && typeof v === 'object' ? walk(v) : v;
    };
    return walk(obj);
  },
  async fillPhotos(obj) {
    const one = async v => {
      if (v && typeof v === 'object' && typeof v.blob === 'string' && /^[a-f0-9]{64}$/.test(v.blob)) {
        let data = LOS.blobCache.get(v.blob);
        if (!data) { try { data = await this.decrypt(await (await this.api('/blob/' + v.blob, {timeout: 120000})).text()); LOS.blobCache.set(v.blob, data); } catch (e) { console.warn('photo not synced yet', e); return null; } }
        return {data, w: v.w, h: v.h};
      }
      if (v && typeof v === 'object') { for (const k of Object.keys(v)) v[k] = await one(v[k]); }
      return v;
    };
    return one(obj);
  },

  async run(loud) {
    if (!this.cfg || !this.key) return;
    if (this.running) { this.again = true; return; }
    if (!navigator.onLine) { this.setState('offline', 'Offline — changes will sync when you’re back online'); return; }
    this.running = true; this.setState('syncing');
    try {
      do {
        this.again = false;
        // 1) push local changes
        while (this.cfg.dirty.length) {
          const batch = this.cfg.dirty.slice(0, 40); const items = [];
          for (const docId of batch) {
            const kind = docId.split('--')[0], rid = docId.slice(kind.length + 2);
            const rec = Store.get(kind, rid);
            if (!rec) { items.push({id: docId, updated: Date.now(), deleted: true}); continue; }
            const clean = await this.stripPhotos(JSON.parse(JSON.stringify(rec)));
            items.push({id: docId, updated: rec.updatedAt || Date.now(), data: await this.encrypt(JSON.stringify(clean))});
          }
          await this.api('/push', {method: 'POST', body: JSON.stringify({items})});
          this.cfg.dirty = this.cfg.dirty.filter(d => !batch.includes(d)); this.save();
        }
        // 2) pull other devices' changes
        let more = true, changed = 0;
        while (more) {
          const r = await (await this.api('/pull?since=' + (this.cfg.lastSeq || 0) + '&limit=200')).json();
          for (const it of r.items) {
            const kind = it.id.split('--')[0], rid = it.id.slice(kind.length + 2);
            const local = Store.get(kind, rid);
            if (this.cfg.dirty.includes(it.id) && local && (local.updatedAt || 0) > it.updated) continue; // our newer edit wins; it will be pushed
            if (it.deleted) { if (local && (local.updatedAt || 0) <= it.updated) { Store.applyRemote(it.id, null); changed++; } continue; }
            if (local && (local.updatedAt || 0) >= it.updated) continue; // already have it (or newer)
            let rec; try { rec = JSON.parse(await this.decrypt(it.data)); } catch (e) { throw Object.assign(new Error('Couldn’t unlock synced data — the passphrase on this device doesn’t match.'), {fatal: true}); }
            rec = await this.fillPhotos(rec);
            Store.applyRemote(it.id, rec); changed++;
          }
          this.cfg.lastSeq = r.seq; more = r.more; this.save();
        }
        if (changed) Store.emit();
      } while (this.again || this.cfg.dirty.length);
      this.lastAt = Date.now(); this.cfg.lastSyncAt = this.lastAt; this.save();
      this.setState('ok'); if (loud) LOS.toast('Synced ✿');
    } catch (e) {
      console.warn('sync failed', e);
      this.setState(e.fatal ? 'error' : 'retry', e.name === 'AbortError' ? 'The sync service took too long — will retry.' : (e.message || 'Sync failed — will retry.'));
      if (loud) LOS.toast(e.message || 'Sync failed');
    } finally { this.running = false; }
  }
};
LOS.blobCache = new Map();
LOS.onPersist = docId => Sync.markDirty(docId);

/* sidebar badge */
LOS.renderSyncBadge = () => {
  const el = document.getElementById('sync-badge'); if (!el) return;
  if (!Sync.cfg) { el.innerHTML = ''; return; }
  const t = {ok: `Synced ${Sync.lastAt ? new Date(Sync.lastAt).toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'}) : ''}`, syncing: 'Syncing…', idle: 'Sync ready', offline: 'Offline — will sync later', retry: 'Sync will retry', error: 'Sync needs attention'}[Sync.state] || '';
  el.innerHTML = `<button class="sync-badge ${Sync.state}" data-route="settings" title="${esc(Sync.msg || t)}">${I('refresh')}<span class="txt">${esc(t)}</span></button>`;
};

/* settings card */
LOS.syncCard = () => {
  if (window.claude) return `<div class="card"><div class="card-h">${I('refresh')}<h3>Sync between devices</h3></div><p class="small" style="margin:0">Sync runs in the installed app (shruthianjan.github.io/organize-life). This claude.ai version keeps its own separate copy — use backup/restore to move data from here into the app.</p></div>`;
  if (!Sync.available()) return '';
  if (!Sync.cfg) return `<div class="card tint-sage"><div class="card-h">${I('refresh')}<h3>Sync between devices</h3></div>
    <p class="small" style="margin-top:0">Keep your laptop and iPhone in step through your own Cloudflare Worker. Everything is encrypted on this device with your passphrase before it leaves — Cloudflare can’t read it.</p>
    <div class="form-grid" id="sync-form"><div class="field full"><label for="sy-url">Worker address</label><input id="sy-url" placeholder="https://organize-life-sync.yourname.workers.dev" autocomplete="off"></div>
    <div class="field"><label for="sy-pass">Sync passphrase</label><input id="sy-pass" type="password" autocomplete="new-password" placeholder="At least 10 characters"></div>
    <div class="field"><label for="sy-pass2">Type it again</label><input id="sy-pass2" type="password" autocomplete="new-password"></div></div>
    <p class="tiny muted">Use the exact same address and passphrase on every device. Write the passphrase down somewhere safe — it can’t be recovered or reset from here.</p>
    <button class="btn primary sm" data-action="sync-connect">${I('refresh')} Connect & sync</button></div>`;
  const st = {ok: ['sage', 'Up to date'], syncing: ['lav', 'Syncing…'], idle: ['ghost', 'Ready'], offline: ['butter', 'Offline'], retry: ['butter', 'Will retry'], error: ['peach', 'Needs attention']}[Sync.state] || ['ghost', ''];
  return `<div class="card tint-sage"><div class="card-h">${I('refresh')}<h3>Sync between devices</h3><span class="chip ${st[0]}">${st[1]}</span></div>
    <p class="small" style="margin-top:0">Connected to <b>${esc(new URL(Sync.cfg.url).host)}</b>. Changes sync a few seconds after you make them, whenever this device is online.${Sync.cfg.lastSyncAt ? ` Last synced ${esc(new Date(Sync.cfg.lastSyncAt).toLocaleString(undefined, {weekday: 'short', hour: 'numeric', minute: '2-digit'}))}.` : ''}</p>
    ${Sync.msg && Sync.state !== 'ok' ? `<div class="notice ${Sync.state === 'error' ? 'peach' : 'butter'}" style="margin-bottom:10px">${I('info')}<div>${esc(Sync.msg)}</div></div>` : ''}
    <div class="row wrap"><button class="btn primary sm" data-action="sync-now">${I('refresh')} Sync now</button><button class="btn sm ghost" data-action="sync-disconnect">Disconnect this device</button></div>
    <p class="tiny muted" style="margin-bottom:0">Disconnecting keeps everything on this device; it just stops syncing.</p></div>`;
};
LOS.actions['sync-connect'] = async el => {
  const url = document.getElementById('sy-url').value, p1 = document.getElementById('sy-pass').value, p2 = document.getElementById('sy-pass2').value;
  if (p1 !== p2) { LOS.toast('The two passphrases don’t match'); return; }
  el.disabled = true; el.textContent = 'Connecting…';
  try { await Sync.connect(url, p1); LOS.render(); }
  catch (e) { Sync.cfg = null; LOS.toast(e.message || 'Couldn’t connect'); el.disabled = false; el.textContent = 'Connect & sync'; }
};
LOS.actions['sync-now'] = () => Sync.run(true);
LOS.actions['sync-disconnect'] = async () => { if (await LOS.confirm('Stop syncing this device? Your data stays here; you can reconnect any time with the same address and passphrase.', {ok: 'Disconnect', danger: false, title: 'Disconnect sync'})) { Sync.disconnect(); LOS.render(); } };
})();
