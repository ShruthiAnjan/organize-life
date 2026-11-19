/* Organize Life Co. — boot */
(async function(){
'use strict';
const {Store, D} = LOS;
document.getElementById('view').innerHTML = `<div style="display:grid;place-items:center;min-height:60vh;text-align:center"><div><img src="icons/logo-full.png" alt="Organize Life Co." style="width:260px;max-width:70vw;height:auto"><div class="small muted">Opening your space…</div></div></div>`;
LOS.renderChrome();
await Store.init();
document.body.classList.toggle('side-collapsed', !!Store.settings().sidebarCollapsed && innerWidth > 900);
Store.onChange(() => LOS.render());
const h = location.hash.slice(1);
LOS.go(LOS.pages[h] ? h : 'home');
let day = D.today();
setInterval(() => {
  if (D.today() !== day) { day = D.today(); LOS.render(); } else LOS.renderChrome();
  LOS.pushBrowserNotifs && LOS.pushBrowserNotifs();
}, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && D.today() !== day) { day = D.today(); LOS.render(); } });
window.addEventListener('error', e => console.error('Organize Life error:', e.message));

/* ---------- offline app (when the app runs from its own website, not inside claude.ai) ---------- */
if (!window.claude && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = w => { if (!w) return; LOS.toast('A new version of Organize Life Co. is ready.', {undo: () => { w.postMessage('skipWaiting'); }, undoLabel: 'Update now', ms: 15000}); };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); }); });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch(e => console.warn('Offline mode unavailable', e));
  let reloading = false; const hadController = !!navigator.serviceWorker.controller; // first install must not reload the page
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloading) { reloading = true; location.reload(); } });
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); LOS.installPrompt = e; LOS.renderChrome(); if (LOS.state.page === 'settings') LOS.render(); });
window.addEventListener('appinstalled', () => { LOS.installPrompt = null; LOS.toast('Organize Life Co. is installed ✿ find it on your desktop or Start menu'); LOS.renderChrome(); });
LOS.actions['install-app'] = async () => { const p = LOS.installPrompt; if (!p) { LOS.toast('Use your browser menu → “Install Organize Life Co.” (or “Add to Home Screen” on a phone).'); return; } p.prompt(); try { await p.userChoice; } catch (e) {} LOS.installPrompt = null; LOS.renderChrome(); };
})();
