/* Organize Life Co. — Home dashboard */
(function(){
'use strict';
const {$, $$, esc, D, Store, icon: I, chart: C, plural, by} = LOS;

const QUOTES = [
  ['Believe you can and you’re halfway there.', 'Theodore Roosevelt'], ['It always seems impossible until it’s done.', 'Nelson Mandela'],
  ['Well done is better than well said.', 'Benjamin Franklin'], ['The secret of getting ahead is getting started.', 'Mark Twain'],
  ['Little by little, one travels far.', 'J.R.R. Tolkien'], ['You are never too old to set another goal or to dream a new dream.', 'C.S. Lewis'],
  ['Act as if what you do makes a difference. It does.', 'William James'], ['Start where you are. Use what you have. Do what you can.', 'Arthur Ashe'],
  ['What you do today can improve all your tomorrows.', 'Ralph Marston'], ['Done is better than perfect.', 'Sheryl Sandberg'],
  ['Nothing will work unless you do.', 'Maya Angelou'], ['Be gentle with yourself, you’re doing the best you can.', 'Unknown'],
  ['Small steps every day.', 'Unknown'], ['The best time to plant a tree was 20 years ago. The second best time is now.', 'Proverb'],
  ['Courage doesn’t always roar.', 'Mary Anne Radmacher'], ['Dream big. Start small. Act now.', 'Robin Sharma'],
  ['Progress, not perfection.', 'Unknown'], ['You don’t have to see the whole staircase, just take the first step.', 'Martin Luther King Jr.'],
  ['Be the woman you would look up to.', 'Unknown'], ['Your future is created by what you do today, not tomorrow.', 'Robert Kiyosaki'],
  ['Rest is not idleness.', 'John Lubbock'], ['Everything you’ve ever wanted is on the other side of fear.', 'George Addair']
];
LOS.quoteOfDay = () => { const d = D.parse(D.today()); const i = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5); return QUOTES[i % QUOTES.length]; };
const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

const TILES = [['today', 'Daily Planner', 'sun'], ['planner', 'Task Manager', 'kanban'], ['goals', 'Goals & Habits', 'target'], ['finance', 'Finance', 'wallet'], ['career', 'Career', 'brief'], ['learning', 'Learning', 'book'], ['kitchen', 'Meal Planner', 'cup'], ['wellness', 'Wellness', 'heart'], ['selfcare', 'Self Care', 'flower'], ['hobbies', 'Hobbies', 'brush'], ['vision', 'Vision Board', 'sparkle'], ['reports', 'Reports', 'chart']];
const TILE_BG = ['#E4D6C9', '#D9CEC4', '#DEDBCF', '#E9DFD0', '#E2D2CB', '#D8CFC8', '#EBE3D9', '#DCCBC3', '#E6D9CF', '#D5D2C5', '#E7DCCB', '#E2DAD2'];

const DEFAULT_WIDGETS = [['priorities', 'l'], ['progress', 's'], ['habits', 's'], ['finance', 'm'], ['career', 'm'], ['learning', 'm'], ['wellness', 'l'], ['calendar', 'l'], ['goals', 'l'], ['achievements', 'l']];
function widgetLayout() {
  const saved = Store.settings().widgets || [];
  const ids = new Set(saved.map(w => w.id));
  const out = saved.filter(w => LOS.widgets[w.id]);
  DEFAULT_WIDGETS.forEach(([id, size]) => { if (!ids.has(id) && LOS.widgets[id]) out.push({id, size, hidden: false}); });
  Object.keys(LOS.widgets).forEach(id => { if (!out.find(w => w.id === id)) out.push({id, size: 'm', hidden: false}); });
  return out;
}
const saveLayout = l => Store.setSettings({widgets: l.map(({id, size, hidden}) => ({id, size, hidden}))});
let editing = false;

LOS.register('home', {title: 'Home', icon: 'home', hideable: false,
  render() {
    const s = Store.settings(); const [q, a] = LOS.quoteOfDay(); const t = D.today();
    const name = s.profile.name; const photo = LOS.imgSrc(s.profile.photo);
    const layout = widgetLayout(); const hiddenSec = s.hidden || {};
    const now = new Date();
    return `<section class="greet">
      <div class="arch">${photo ? `<img src="${esc(photo)}" alt="Profile">` : `<div class="ph" data-action="edit-profile">${I('image')}</div>`}<button class="btn sm cover-btn edit" data-action="edit-profile">${I('edit')} Edit</button></div>
      <div><h1>${esc(greeting())}${name ? `, <mark>${esc(name)}</mark>` : ` <button class="btn sm" data-action="edit-profile" style="vertical-align:middle">${I('edit')} Add your name</button>`}</h1>
        <div class="muted" style="margin:8px 0 16px">${esc(D.long(t))}${s.profile.tagline ? ' · ' + esc(s.profile.tagline) : ''}</div>
        <div class="quote">“${esc(q)}”<small>— ${esc(a)}</small></div></div>
      <div class="clock"><div class="tm" id="clock-t">${now.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'})}</div><div class="dw">${D.dow(t, 'long')}</div></div>
    </section>
    <div class="tiles">${TILES.filter(([p]) => !hiddenSec[p] && LOS.pages[p]).map(([p, l, ic], i) => { const img = LOS.imgSrc((s.tiles || {})[p]); return `<button class="tile" data-route="${p}"><div class="a" style="background:${TILE_BG[i]}">${img ? `<img src="${esc(img)}" alt="">` : `<div class="art">${I(ic)}</div>`}<span class="tedit" data-action="tile-img" data-page="${p}" role="button" tabindex="0" data-tip="${img ? 'Change picture' : 'Add a picture'}" aria-label="Change picture">${I(img ? 'edit' : 'image')}</span></div><span>${esc(l)}</span></button>`; }).join('')}</div>
    <p class="tiny muted" style="margin:-14px 0 22px">Hover a tile (or tap its round button on a phone) to add your own picture.</p>
    <div class="row" style="margin-bottom:14px"><h2 class="grow">My life at a glance</h2>${editing ? `<span class="small muted">Drag to reorder · resize · hide</span><button class="btn sm primary" data-action="edit-widgets">Done</button>` : `<button class="btn sm ghost" data-action="edit-widgets">${I('grid')} Customize</button>`}</div>
    ${editing && layout.some(w => w.hidden) ? `<div class="notice" style="margin-bottom:14px">Hidden: ${layout.filter(w => w.hidden).map(w => `<button class="btn sm" data-action="w-show" data-id="${w.id}">${I('eye')} ${esc(LOS.widgets[w.id].title)}</button>`).join(' ')}</div>` : ''}
    <div class="widgets">${layout.filter(w => !w.hidden).map(w => { const def = LOS.widgets[w.id]; let body; try { body = def.render(); } catch (e) { console.error(e); body = '<p class="small muted">Couldn’t load.</p>'; } return `<div class="widget s-${w.size}" data-wid="${w.id}">
      <div class="wtools"><span class="icon-btn sm" style="cursor:grab" aria-hidden="true">${I('move')}</span><button class="icon-btn sm" data-action="w-move" data-id="${w.id}" data-d="-1" aria-label="Move earlier">${I('left')}</button><button class="icon-btn sm" data-action="w-move" data-id="${w.id}" data-d="1" aria-label="Move later">${I('right')}</button><button class="icon-btn sm" data-action="w-size" data-id="${w.id}" data-tip="Size: ${w.size.toUpperCase()}">${I('resize')}</button><button class="icon-btn sm" data-action="w-hide" data-id="${w.id}" aria-label="Hide widget">${I('eyeoff')}</button></div>
      <div class="card hover ${def.tone ? 'tint-' + def.tone : ''}" style="height:100%"><div class="card-h"><h3>${esc(def.title)}</h3>${def.link ? `<button class="btn sm ghost" data-route="${def.link[0]}" ${def.link[2] ? `data-tab="${def.link[2]}"` : ''}>${esc(def.link[1])} ${I('right')}</button>` : ''}</div>${body}</div></div>`; }).join('')}</div>`;
  },
  mount(el) {
    document.body.classList.toggle('edit-widgets', editing);
    if (editing) {
      $$('.widget', el).forEach(w => { w.draggable = true; w.dataset.drag = w.dataset.wid; });
      LOS.dnd(el, {item: '.widget', zone: '.widget', onDrop: (id, z) => { const l = widgetLayout(); const from = l.findIndex(w => w.id === id), to = l.findIndex(w => w.id === z.dataset.wid); if (from < 0 || to < 0 || from === to) return; const [x] = l.splice(from, 1); l.splice(to, 0, x); saveLayout(l); }});
    }
  }
});
setInterval(() => { const c = $('#clock-t'); if (c) c.textContent = new Date().toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'}); }, 15000);
LOS.actions['edit-widgets'] = () => { editing = !editing; LOS.render(); };
LOS.actions['w-move'] = el => { const l = widgetLayout(); const i = l.findIndex(w => w.id === el.dataset.id); const vis = l.map((w, k) => [w, k]).filter(([w]) => !w.hidden); const vi = vis.findIndex(([w]) => w.id === el.dataset.id); const target = vis[vi + +el.dataset.d]; if (!target) return; const j = target[1]; [l[i], l[j]] = [l[j], l[i]]; saveLayout(l); };
LOS.actions['w-size'] = el => { const order = ['s', 'm', 'l', 'xl']; const l = widgetLayout(); const w = l.find(x => x.id === el.dataset.id); w.size = order[(order.indexOf(w.size) + 1) % 4]; saveLayout(l); };
LOS.actions['w-hide'] = el => { const l = widgetLayout(); l.find(x => x.id === el.dataset.id).hidden = true; saveLayout(l); };
LOS.actions['w-show'] = el => { const l = widgetLayout(); l.find(x => x.id === el.dataset.id).hidden = false; saveLayout(l); };
LOS.actions['tile-img'] = async (el, e) => {
  if (e) e.stopPropagation(); const p = el.dataset.page; const cur = (Store.settings().tiles || {})[p];
  const pick = async () => { const [f] = await LOS.pickImages(false); if (!f) return; try { LOS.toast('Uploading…'); const ref = await LOS.saveImage(f, 700); if (cur) LOS.dropImage(cur); Store.setSettings({tiles: {...(Store.settings().tiles || {}), [p]: ref}}); LOS.toast('Picture updated ✿'); } catch (er) { LOS.toast(er.message); } };
  if (!cur) return pick();
  const m = LOS.modal({title: 'Tile picture', size: 'narrow', body: `<img src="${esc(LOS.imgSrc(cur))}" alt="" style="width:140px;aspect-ratio:3/3.6;object-fit:cover;border-radius:999px 999px 4px 4px;display:block;margin:0 auto">`, foot: `<button class="btn danger left" data-rm>${I('trash')} Remove</button><button class="btn primary" data-up>${I('upload')} Replace</button>`,
    onMount: w => { w.querySelector('[data-up]').onclick = () => { m.close(); pick(); }; w.querySelector('[data-rm]').onclick = () => { LOS.dropImage(cur); const t = {...(Store.settings().tiles || {})}; delete t[p]; Store.setSettings({tiles: t}); m.close(); }; }});
};
LOS.actions['edit-profile'] = () => {
  const s = Store.settings();
  LOS.openForm({title: 'Your profile', fields: [{k: 'name', label: 'Your name', ph: 'e.g., Shruthi'}, {k: 'tagline', label: 'Personal motto', ph: 'Plan your life, beautifully.'}, {k: 'photo', label: 'Profile photo', type: 'image'}], values: s.profile,
    onSave: d => Store.setSettings({profile: {...s.profile, ...d}})});
};

/* core widgets */
LOS.widgets.priorities = {title: 'Today’s priorities', tone: 'peach', link: ['today', 'Today'], render: () => LOS.prioritiesBlock()};
LOS.widgets.progress = {title: 'Daily progress', link: ['today', 'Open'], render() {
  const st = LOS.todayStats();
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:8px">${C.ring(st.p, {sub: `${st.done} of ${st.total}`})}<div class="small muted">${st.total ? (st.pending ? plural(st.pending, 'task') + ' pending' : 'All done for today ✿') : 'No tasks for today yet'}</div></div>`;
}};
LOS.widgets.calendar = {title: 'Coming up', link: ['planner', 'Calendar', 'calendar'], render() {
  const t = D.today(); const items = LOS.calendarItems(t, D.add(t, 14)).filter(i => !/done/.test(i.cls || '')).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).slice(0, 8);
  if (!items.length) return LOS.empty('Nothing in the next two weeks', 'Tasks, bills, interviews and events will show here.');
  return items.map(i => `<div class="item clickable" data-action="cal-open" data-key="${esc(i.key)}"><span class="chip ${i.cls}" style="min-width:86px;justify-content:center">${esc(D.rel(i.date))}</span><span class="grow small">${esc(i.title)}</span><span class="tiny muted">${esc(i.label)}</span></div>`).join('');
}};
LOS.widgets.achievements = {title: 'Recent achievements', tone: 'sage', link: ['vision', 'Life in Motion'], render() {
  const since = D.add(D.today(), -30);
  const items = [];
  LOS.Tasks.all().filter(t => t.completedAt >= since && (t.top || ['Critical', 'High'].includes(t.priority))).forEach(t => items.push({d: t.completedAt, ic: 'check', t: t.title, s: 'Task completed'}));
  Store.all('goal').forEach(g => (g.milestones || []).filter(m => m.done && m.doneAt >= since).forEach(m => items.push({d: m.doneAt, ic: 'flag', t: m.t, s: 'Milestone · ' + g.title})));
  Store.all('goal').filter(g => g.status === 'Completed' && (g.completedAt || '') >= since).forEach(g => items.push({d: g.completedAt, ic: 'target', t: g.title, s: 'Goal achieved'}));
  Store.all('memory').filter(m => (m.date || '') >= since).forEach(m => items.push({d: m.date, ic: 'image', t: m.title, s: 'Memory', img: LOS.imgSrc(m.image)}));
  Store.all('course').filter(c => c.status === 'Completed' && (c.completed || '') >= since).forEach(c => items.push({d: c.completed, ic: 'book', t: c.name, s: c.type === 'Certification' ? 'Certification earned' : 'Course completed'}));
  if (!items.length) return LOS.empty('Your wins will gather here', 'Completed goals, milestones, important tasks and memories from the last 30 days.');
  return `<div class="grid" style="gap:10px;grid-template-columns:repeat(auto-fill,minmax(210px,1fr))">${items.sort(by(x => x.d, -1)).slice(0, 9).map(x => `<div class="item" style="border:0;background:#F6F9F3;border-radius:14px;padding:10px 12px">${x.img ? `<img class="thumb" src="${esc(x.img)}" alt="">` : `<span class="icon-btn sm" style="background:var(--sage);color:#3E5E3A">${I(x.ic)}</span>`}<div class="grow"><div class="small" style="font-weight:600">${esc(x.t)}</div><div class="tiny muted">${esc(x.s)} · ${esc(D.rel(x.d))}</div></div></div>`).join('')}</div>`;
}};
})();
