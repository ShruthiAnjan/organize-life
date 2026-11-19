/* Organize Life Co. — Reports & Analytics, Notification centre, Settings */
(function(){
'use strict';
const {esc, num, pct, by, sum, plural, mins, hrs, D, Store, icon: I, chart: C, money: $m} = LOS;
const F = () => LOS.state.filters;

/* =================== REPORTS =================== */
function curRange() {
  const r = F().rr || 'month';
  if (r === 'custom') return D.range('custom', [F().rfrom || D.add(D.today(), -29), F().rto || D.today()]);
  if (r === 'month') { const m = F().rmonth || D.month(); return [D.monthStart(m), D.monthEnd(m)]; }
  if (r === 'year') { const y = F().ryear || D.today().slice(0, 4); return [y + '-01-01', y + '-12-31']; }
  if (r === 'quarter') { const y = F().ryear || D.today().slice(0, 4); const q = +(F().rq || (Math.floor((+D.today().slice(5, 7) - 1) / 3) + 1)); const s = `${y}-${String((q - 1) * 3 + 1).padStart(2, '0')}`; return [s + '-01', D.monthEnd(D.monthAdd(s, 2))]; }
  return D.range(r);
}
function buckets(r) {
  const n = D.diff(r[0], r[1]) + 1;
  if (n <= 31) return D.days(r[0], r[1]).map(k => ({label: n <= 7 ? D.dow(k) : D.fmt(k, {day: 'numeric', month: 'short'}), from: k, to: k}));
  if (n <= 120) { const out = []; let w = D.weekStart(r[0]); while (w <= r[1]) { out.push({label: D.fmt(w), from: w < r[0] ? r[0] : w, to: D.add(w, 6) > r[1] ? r[1] : D.add(w, 6)}); w = D.add(w, 7); } return out; }
  const out = []; let m = D.month(r[0]); while (m <= D.month(r[1])) { out.push({label: D.mname(m, {month: 'short', year: '2-digit'}), from: D.monthStart(m) < r[0] ? r[0] : D.monthStart(m), to: D.monthEnd(m) > r[1] ? r[1] : D.monthEnd(m)}); m = D.monthAdd(m, 1); } return out;
}
LOS.register('reports', {title: 'Reports & Analytics', icon: 'chart',
  render() {
    const rk = F().rr || 'month'; const r = curRange(); const bs = buckets(r); const t = D.today();
    const tasks = LOS.Tasks.all();
    const inR = tasks.filter(x => x.status !== 'Cancelled' && (D.inR(x.due, r) || D.inR(x.completedAt, r)));
    const doneR = tasks.filter(x => D.inR(x.completedAt, r));
    const exp = Store.all('expense').filter(e => D.inR(e.date, r));
    const ms = (() => { const out = []; let m = D.monthAdd(D.month(r[1]), -5); if (D.month(r[0]) < m) m = D.month(r[0]); while (m <= D.month(r[1])) { out.push(m); m = D.monthAdd(m, 1); } return out.slice(-12); })();
    const fc = LOS.financeCharts(ms);
    const cs = LOS.careerStats(r);
    const s = Store.settings();
    const moods = Store.all('mood').filter(m => D.inR(m.id, r));
    const goals = Store.all('goal');
    const st = LOS.todayStats();
    const fmtM = (v, ax) => $m(v, {whole: ax});
    const rangeLabel = r[0] === r[1] ? D.long(r[0]) : `${D.fmt(r[0], {month: 'short', day: 'numeric', year: 'numeric'})} – ${D.fmt(r[1], {month: 'short', day: 'numeric', year: 'numeric'})}`;
    const kpis = [['Tasks completed', doneR.length], ['Completion rate', pct(inR.filter(x => x.status === 'Completed').length, inR.length) + '%'], ['Spent', $m(sum(exp, e => e.amount))], ['Applications', cs.total], ['Study time', hrs(LOS.Learn.minutesIn(r))], ['Workouts', LOS.Well.workouts(r).length], ['Habit check-ins', sum(Store.all('habit'), h => (h.dates || []).filter(k => D.inR(k, r)).length)], ['Moods logged', moods.length]];
    LOS._reportKpis = {range: r, kpis};
    const card = (title, body, cls = '') => `<div class="card ${cls}"><div class="card-h"><h3>${title}</h3></div>${body}</div>`;
    return LOS.hero('reports', {title: 'Reports & Analytics', script: 'see how far you’ve come', tone: 'butter', sub: rangeLabel}) +
    `<div class="toolbar">${LOS.seg('rr', [['today', 'Today'], ['week', 'This week'], ['month', 'Month'], ['quarter', 'Quarter'], ['year', 'Year'], ['custom', 'Custom range']], rk)}${rk === 'custom' ? `<input type="date" class="input" value="${r[0]}" data-change="rset" data-k="rfrom" aria-label="From"><span class="small">to</span><input type="date" class="input" value="${r[1]}" data-change="rset" data-k="rto" aria-label="To">` : ''}${rk === 'month' ? LOS.monthPicker('rmonth', F().rmonth || D.month(), {short: true}) : ''}${rk === 'year' || rk === 'quarter' ? LOS.yearSelect('ryear', F().ryear || D.today().slice(0, 4)) : ''}${rk === 'quarter' ? `<select class="input" data-change="rset" data-k="rq" aria-label="Quarter">${[1, 2, 3, 4].map(q => `<option value="${q}" ${String(q) === String(F().rq || (Math.floor((+D.today().slice(5, 7) - 1) / 3) + 1)) ? 'selected' : ''}>Q${q}</option>`).join('')}</select>` : ''}<span class="spacer"></span><button class="btn sm" data-action="export-report">${I('download')} Export summary</button></div>
    <div class="stats four" style="margin-bottom:18px">${kpis.map(([l, v]) => `<div class="stat"><span class="l">${l}</span><span class="v">${v}</span></div>`).join('')}</div>
    <div class="grid g3">
      ${card('Daily task completion', `<div style="display:grid;place-items:center;gap:8px">${C.ring(st.p, {size: 150, sub: `${st.done}/${st.total} today`})}</div>`)}
      ${card('Productivity', C.bar({labels: bs.map(b => b.label), series: [{name: 'Tasks completed', values: bs.map(b => tasks.filter(x => D.inR(x.completedAt, [b.from, b.to])).length), color: '#3F8F3F'}], emptyMsg: 'Complete tasks to see your productivity.'}), 'span2')}
      ${card('Task status', C.donut({items: LOS.Tasks.STATUSES.map((s2, i) => ({label: s2, value: inR.filter(x => x.status === s2).length, color: ['#9A8C80', '#E0A21A', '#7B62C9', '#D9638F', '#3F8F3F', '#B8483F'][i]})), center: {v: inR.length, l: 'tasks'}, emptyMsg: 'No tasks due in this period.'}))}
      ${card('Productivity trend (last 12 weeks)', (() => { const ws = Array.from({length: 12}, (_, i) => D.add(D.weekStart(), (i - 11) * 7)); return C.line({labels: ws.map(w => D.fmt(w)), series: [{name: 'Completed', values: ws.map(w => tasks.filter(x => D.inR(x.completedAt, [w, D.add(w, 6)])).length), color: '#7B62C9'}]}); })(), 'span2')}
      ${card('Expense distribution', C.donut({items: Object.entries(LOS.groupBy(exp, e => e.category || 'Other')).map(([k, v]) => ({label: k, value: sum(v, e => e.amount)})).sort(by(x => x.value, -1)), fmt: v => $m(v), center: {v: $m(sum(exp, e => e.amount), {whole: true}), l: 'spent'}, emptyMsg: 'No expenses in this period.'}), 'span2')}
      ${card('Loan repayment', C.hbar({items: Store.all('loan').map(l => { const x = LOS.Fin.loan(l); return {label: l.name, value: x.repaid, max: x.original, text: x.pctRepaid + '% repaid', color: '#D0643F'}; }), emptyMsg: 'No loans tracked.'}))}
      ${card('Income vs expenses', C.bar({labels: fc.labels, series: [{name: 'Income', values: fc.inc, color: '#159C8C'}, {name: 'Expenses', values: fc.exp, color: '#D0643F'}], fmt: fmtM}), 'span2')}
      ${card('Job application pipeline', LOS.careerFunnel(cs))}
      ${card('Learning progress', LOS.learnCharts().subjects)}
      ${card('Study hours (weekly)', LOS.learnCharts().weekly, 'span2')}
      ${card('Habit consistency', `<p class="tiny muted" style="margin:-8px 0 12px">Each square is one day. The darker it is, the more of your daily habits you completed that day — hover for the exact %.</p>` + LOS.habitHeat(r[0] > D.add(t, -180) ? r[0] : D.add(t, -180), r[1] > t ? t : r[1]), 'spanall')}
      ${card('Water intake', C.bar({labels: bs.map(b => b.label), series: [{name: 'Avg ml / day', values: bs.map(b => { const ds = D.days(b.from, b.to > t ? t : b.to); return ds.length ? Math.round(sum(ds, LOS.Well.water) / ds.length) : 0; }), color: '#3577C4'}], fmt: v => Math.round(v) + ' ml', target: s.waterGoal}), 'span2')}
      ${card('Mood distribution', C.donut({items: LOS.MOODS.map(([n, e], i) => ({label: e + ' ' + n, value: moods.filter(m => m.mood === n).length, color: C.CAT[i % 8]})), size: 150, emptyMsg: 'No moods logged in this period.'}))}
      ${card('Screen time trend', C.line({labels: bs.map(b => b.label), series: [{name: 'Avg hours / day', values: bs.map(b => { const ds = D.days(b.from, b.to).map(LOS.Well.screen).filter(Boolean); return ds.length ? sum(ds, x => x.total) / ds.length / 60 : null; }), color: '#3577C4'}], fmt: v => (+v).toFixed(1).replace(/\.0$/, '') + 'h', target: s.screenLimit / 60, emptyMsg: 'Enter screen time to see the trend.'}), 'span2')}
      ${card('Goal completion', goals.length ? `<div class="row wrap" style="gap:16px">${goals.slice(0, 8).map(g => `<div style="text-align:center;width:110px">${C.ring(LOS.goalProgress(g), {size: 90, color: g.status === 'Completed' ? '#3F8F3F' : '#C98770'})}<div class="tiny" style="margin-top:4px">${esc(g.title)}</div></div>`).join('')}</div>` : C.empty('Add goals to track completion.'))}
    </div>`;
  }
});
LOS.actions.rset = el => { F()[el.dataset.k] = el.value; LOS.render(); };
LOS.actions['export-report'] = () => { const k = LOS._reportKpis; if (!k) return; LOS.exportFile(`organize-life-report-${k.range[0]}_${k.range[1]}.csv`, LOS.toCSV(k.kpis.map(([l, v]) => ({l, v})), [['Metric', 'l'], [`Value (${k.range[0]} to ${k.range[1]})`, 'v']]), 'text/csv'); };

/* =================== NOTIFICATIONS =================== */
const NCATS = [['tasks', 'Tasks, reminders & events'], ['planning', 'Weekly planning & monthly reviews'], ['bills', 'Bills & budgets'], ['loans', 'Loan due dates'], ['career', 'Interviews & follow-ups'], ['learning', 'Study sessions & revision'], ['goals', 'Goal milestones & targets'], ['habits', 'Habit nudges (evenings)'], ['selfcare', 'Product expiry']];
LOS.notifications = () => {
  const s = Store.settings(); const out = [];
  LOS.notifProviders.forEach(p => { try { out.push(...p()); } catch (e) { console.warn(e); } });
  return out.filter(n => s.notif[n.cat] !== false).map(n => ({...n, read: !!s.dismissed[n.key]}));
};
LOS.actions['notif-open'] = el => { const n = LOS.notifications().find(x => x.key === el.dataset.key); if (!n) return; markRead([n.key]); if (n.open) n.open(); else if (n.route) LOS.go(n.route, {tab: n.tab}); };
function markRead(keys) { const s = Store.settings(); const d = {...s.dismissed}; const cutoff = Date.now() - 60 * 864e5; Object.keys(d).forEach(k => { if (d[k] < cutoff) delete d[k]; }); keys.forEach(k => d[k] = Date.now()); Store.setSettings({dismissed: d}); }
LOS.actions['notif-read'] = el => markRead([el.dataset.key]);
LOS.actions['notif-all'] = () => markRead(LOS.notifications().filter(n => !n.read).map(n => n.key));
LOS.actions['notif-pref'] = el => Store.setSettings({notif: {...Store.settings().notif, [el.dataset.k]: el.checked}});
LOS.actions['browser-notif'] = async () => {
  if (!('Notification' in window)) { LOS.toast('This browser doesn’t support notifications here.'); return; }
  try { const r = await Notification.requestPermission(); LOS.toast(r === 'granted' ? 'Browser alerts on — they show while this page is open.' : 'Permission wasn’t granted (the page frame may block it).'); }
  catch (e) { LOS.toast('Your browser blocked the permission request from inside this page.'); }
  LOS.render();
};
const shown = new Set();
LOS.pushBrowserNotifs = () => {
  try { if (!('Notification' in window) || Notification.permission !== 'granted' || !Store.settings().browserNotif) return; LOS.notifications().filter(n => !n.read && !shown.has(n.key)).slice(0, 3).forEach(n => { shown.add(n.key); new Notification(n.title, {body: n.body || ''}); }); } catch (e) {}
};
LOS.register('notifications', {title: 'Notifications', icon: 'bell', hideable: false,
  render() {
    const ns = LOS.notifications(); const unread = ns.filter(n => !n.read); const s = Store.settings();
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    const tone = {peach: '#FBEAE1', butter: '#FBF4DA', sage: '#EDF4EA', lav: '#F1ECF9', pink: '#F7EBEE'};
    return LOS.hero('notifications', {title: 'Notification centre', script: 'gentle nudges', tone: 'peach', sub: unread.length ? `${plural(unread.length, 'thing')} that might need you.` : 'All caught up ✿', actions: unread.length ? `<button class="btn" data-action="notif-all">${I('check')} Mark all read</button>` : ''}) +
    `<div class="grid g3"><div class="span2">${ns.length ? ns.sort((a, b) => a.read - b.read).map(n => `<div class="notif ${n.read ? 'read' : ''}"><span class="ic" style="background:${tone[n.tone] || 'var(--cream)'}">${I(n.icon)}</span><div class="grow clickable" data-action="notif-open" data-key="${esc(n.key)}"><b style="font-weight:600">${esc(n.title)}</b>${n.body ? `<div class="small muted">${esc(n.body)}</div>` : ''}</div>${n.read ? '' : `<button class="icon-btn sm" data-action="notif-read" data-key="${esc(n.key)}" data-tip="Mark read">${I('check')}</button>`}</div>`).join('') : `<div class="card">${LOS.empty('Nothing needs you right now', 'Reminders appear here as bills, deadlines, interviews and study sessions come up.')}</div>`}</div>
    <div class="stack" style="gap:18px"><div class="card"><div class="card-h"><h3>What to notify me about</h3></div>${NCATS.map(([k, l]) => `<label class="item check"><input type="checkbox" class="cb" ${s.notif[k] !== false ? 'checked' : ''} data-change="notif-pref" data-k="${k}"><span class="small">${l}</span></label>`).join('')}<div class="field" style="margin-top:12px"><label for="bsd">“Due soon” window for bills (days)</label><input id="bsd" type="number" min="1" max="30" value="${s.billSoonDays}" data-change="bill-soon"></div></div>
    <div class="card tint-lav"><div class="card-h"><h3>How reminders work</h3></div><p class="small" style="margin-top:0">Reminders are calculated from your data every time you open the app and refresh every minute while it’s open. The bell and this page show them.</p><p class="small">Web pages <b>can’t</b> alert you when they’re closed — for that, use your phone’s calendar or alarm for anything critical.</p>
    <p class="small">Browser pop-ups (while open): <b>${perm === 'granted' ? 'allowed' : perm === 'denied' ? 'blocked by your browser' : perm === 'unsupported' ? 'not supported here' : 'not enabled'}</b>.</p>${perm === 'default' ? `<button class="btn sm" data-action="browser-notif">${I('bell')} Ask for permission</button>` : ''}${perm === 'granted' ? `<label class="check small"><input type="checkbox" class="cb" ${s.browserNotif ? 'checked' : ''} data-change="toggle-bn"> Show pop-ups for new reminders</label>` : ''}<p class="tiny muted">This page runs inside claude.ai, which may not allow pop-up permissions — the in-app centre always works.</p></div></div></div>`;
  }
});
LOS.actions['bill-soon'] = el => Store.setSettings({billSoonDays: Math.max(1, Math.min(30, num(el.value) || 3))});
LOS.actions['toggle-bn'] = el => Store.setSettings({browserNotif: el.checked});

/* =================== SETTINGS =================== */
const SECTIONS = [['planner', 'My Planner'], ['goals', 'Goals & Habits'], ['finance', 'Finance Hub'], ['career', 'Career Hub'], ['learning', 'Learning Hub'], ['kitchen', 'Kitchen & Grocery'], ['wellness', 'Health & Wellness'], ['selfcare', 'Self-care & Beauty'], ['hobbies', 'Hobbies & Creativity'], ['vision', 'Vision & Inspiration'], ['reports', 'Reports']];
const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'AED', 'JPY'];
LOS.register('settings', {title: 'Settings', icon: 'gear', hideable: false,
  render() {
    const s = Store.settings(); const counts = Object.entries(Store.mem).map(([k, m]) => [k, m.size]).filter(([k]) => k !== 'settings');
    const total = sum(counts, c => c[1]);
    return LOS.hero('settings', {title: 'Settings', script: 'make it yours', tone: 'sage'}) +
    `<div class="grid g2"><div class="card"><div class="card-h"><h3>Profile & preferences</h3><button class="btn sm" data-action="edit-profile">${I('edit')} Profile</button></div>
      <div class="form-grid"><div class="field"><label for="cur">Currency</label><select id="cur" data-change="set-cur">${CURRENCIES.map(c => `<option ${c === s.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div class="field"><label>Animations</label><label class="check"><input type="checkbox" class="cb" ${s.animations !== false ? 'checked' : ''} data-change="set-anim"> <span class="small">Celebrations, transitions & moving charts</span></label></div></div>
      <div class="divider"></div><div class="row wrap"><button class="btn sm" data-action="water-custom">${I('drop')} Water goal</button><button class="btn sm" data-action="screen-limits">${I('phone')} Screen limits</button><button class="btn sm" data-action="workout-goal">${I('dumbbell')} Workout goal</button><button class="btn sm" data-action="study-goal">${I('book')} Study goal</button><button class="btn sm" data-action="add-cat">${I('wallet')} Expense categories</button><button class="btn sm" data-action="reset-widgets">${I('grid')} Reset dashboard layout</button></div></div>
    <div class="card"><div class="card-h"><h3>Show or hide sections</h3></div><p class="small muted" style="margin-top:-6px">Hide what isn’t relevant right now — your data stays safe and comes back when you switch it on.</p><div class="grid g2" style="gap:4px 16px">${SECTIONS.map(([k, l]) => `<label class="item check" style="border:0;padding:5px 0"><input type="checkbox" class="cb" ${s.hidden[k] ? '' : 'checked'} data-change="set-hidden" data-k="${k}"><span class="small">${l}</span></label>`).join('')}</div></div>
    <div class="card tint-sage"><div class="card-h"><h3>Install as an app</h3></div>${LOS.standalone ? `<p class="small" style="margin-top:0">${matchMedia('(display-mode: standalone)').matches ? 'You’re using the installed Organize Life Co. app ✿ It opens from your desktop/Start menu and works offline.' : 'Install Organize Life Co. to get its own icon and window, and use it offline.'}</p>${LOS.installPrompt ? `<button class="btn primary sm" data-action="install-app">${I('download')} Install Organize Life Co.</button>` : matchMedia('(display-mode: standalone)').matches ? '' : '<p class="tiny muted">If no install button appears: open your browser menu (⋮) → “Install Organize Life Co.” / “Apps → Install this site as an app”. On iPhone: Share → “Add to Home Screen”.</p>'}` : `<p class="small" style="margin-top:0">You’re using Organize Life Co. inside claude.ai. You can also install it as an offline app from <a href="https://shruthianjan.github.io/organize-life/" target="_blank" rel="noopener">shruthianjan.github.io/organize-life</a>.</p><p class="tiny muted">To bring everything across: <b>Export full backup</b> here (photos are packed inside the file), then open the app → Settings → <b>Restore from backup</b>.</p>`}</div>
    <div class="card"><div class="card-h"><h3>Your data</h3></div>
      <div class="notice ${Store.mode === 'cloud' ? 'sage' : 'butter'}" style="margin-bottom:12px">${I('info')}<div>${Store.mode === 'cloud' ? 'Your records are saved in your <b>private space</b> for this app — only you can read them, even if you share the page. Photos are stored as files attached to this app; anyone you share the app with could open a photo if they had its link, so keep the app unshared if photos are personal.' : (LOS.standalone ? 'Saved <b>on this device</b>, inside the installed app. It works offline and app updates never touch it. Uninstalling the app or clearing this site’s data in your browser would erase it, so export a backup now and then.' + (Store.persisted ? ' Your browser has marked this storage as permanent.' : '') : 'Saved in <b>this browser only</b> (IndexedDB). Clearing site data removes it — export a backup regularly.')}</div></div>
      <div class="small muted" style="margin-bottom:10px">${plural(total, 'record')} saved${counts.length ? ': ' + counts.sort(by(c => c[1], -1)).slice(0, 8).map(([k, n]) => `${n} ${k}`).join(', ') : ''}. <span id="asset-usage"></span></div>
      <div class="row wrap"><button class="btn primary sm" data-action="backup">${I('download')} Export full backup (with photos)</button><button class="btn sm" data-action="restore">${I('upload')} Restore from backup</button></div>
      <div class="row wrap" style="margin-top:8px"><button class="btn sm ghost" data-action="export-tasks">Tasks CSV</button><button class="btn sm ghost" data-action="export-expenses">Expenses CSV</button><button class="btn sm ghost" data-action="export-jobs">Applications CSV</button></div></div>
    <div class="card"><div class="card-h"><h3>Keyboard & tips</h3></div><ul class="small" style="margin:0;padding-left:18px;line-height:1.9"><li><b>N</b> — quick add from anywhere</li><li><b>Esc</b> — close dialogs or exit focus mode</li><li>★ on a task pins it to today’s three priorities</li><li>Drag cards on any board; use the menu on a card if dragging is awkward on touch screens</li><li>Hover a page banner to add your own cover photo</li></ul>
      <div class="divider"></div><div class="eyebrow" style="margin-bottom:8px">Danger zone</div><button class="btn sm danger" data-action="wipe">${I('trash')} Delete all my data</button></div></div>`;
  },
  mount() { if (Store.assets) Store.assets.list().then(r => { const u = r && r.usage; const el = document.getElementById('asset-usage'); if (el && u) el.textContent = `Photos: ${(r.assets || []).length} files${u.bytes != null ? ' · ' + (u.bytes / 1048576).toFixed(1) + ' MB' : ''}.`; }).catch(() => {}); }
});
LOS.actions['set-cur'] = el => Store.setSettings({currency: el.value});
LOS.actions['set-anim'] = el => Store.setSettings({animations: el.checked});
LOS.actions['set-hidden'] = el => Store.setSettings({hidden: {...Store.settings().hidden, [el.dataset.k]: !el.checked}});
LOS.actions['reset-widgets'] = () => { Store.setSettings({widgets: null}); LOS.toast('Dashboard layout reset'); };
LOS.actions.backup = async () => {
  LOS.toast('Packing your data and photos…');
  const dump = await LOS.dumpAllWithPhotos();
  await LOS.exportFile(`organize-life-backup-${D.today()}.json`, JSON.stringify(dump));
  if (dump.photosMissing) LOS.toast(`${dump.photosMissing} photo(s) couldn’t be packed — they’ll need re-uploading after a restore.`, {ms: 7000});
};
LOS.actions.restore = () => {
  const inp = document.getElementById('json-picker'); inp.value = '';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    let data; try { data = JSON.parse(await f.text()); } catch (e) { LOS.toast('That file isn’t valid JSON.'); return; }
    const recs = Array.isArray(data.records) ? data.records.filter(r => r && typeof r.kind === 'string' && typeof r.id === 'string' && /^[a-z]+$/.test(r.kind)) : null;
    if (!recs || !recs.length) { LOS.toast('No Organize Life Co. records found in that file.'); return; }
    const exists = recs.filter(r => Store.get(r.kind, r.id)).length;
    if (!(await LOS.confirm(`Restore ${plural(recs.length, 'record')}${exists ? ` (${exists} will overwrite existing ones)` : ''}? Nothing else is deleted.`, {ok: 'Restore', danger: false, title: 'Restore backup'}))) return;
    LOS.toast('Restoring… this can take a moment with many photos'); for (const r of recs) Store.put(r.kind, await LOS.prepareRestoredRecord(r), {silent: true}); Store.emit(); LOS.toast(`Backup restored ✿ ${recs.length} records${data.photoCount ? ' and ' + data.photoCount + ' photos' : ''}`, {ms: 6000});
  };
  inp.click();
};
LOS.actions.wipe = () => {
  const m = LOS.modal({title: 'Delete everything?', size: 'narrow', body: `<p class="small" style="margin-top:0">This permanently deletes every task, expense, journal entry and photo. Export a backup first if you might want it back.</p><div class="field"><label for="wipe-c">Type DELETE to confirm</label><input id="wipe-c" autocomplete="off"></div>`, foot: `<button class="btn" data-n>Cancel</button><button class="btn terra" data-y>Delete everything</button>`,
    onMount: w => { w.querySelector('[data-n]').onclick = () => m.close(); w.querySelector('[data-y]').onclick = async () => { if (w.querySelector('#wipe-c').value.trim() !== 'DELETE') { LOS.toast('Type DELETE to confirm'); return; } m.close(); const all = []; Object.values(Store.mem).forEach(mm => mm.forEach(o => all.push(o))); all.forEach(o => { ['image', 'photo'].forEach(k => o[k] && LOS.dropImage(o[k])); (o.photos || []).forEach(LOS.dropImage); if (o.kind === 'settings') { Object.values(o.covers || {}).forEach(LOS.dropImage); Object.values(o.tiles || {}).forEach(LOS.dropImage); if (o.profile && o.profile.photo) LOS.dropImage(o.profile.photo); } Store.del(o.kind, o.id); }); LOS.toast('All data deleted'); LOS.go('home'); }; }});
};
})();
