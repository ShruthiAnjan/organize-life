/* Organize Life Co. — Goals & Habits */
(function(){
'use strict';
const {esc, uid, num, pct, by, sum, plural, D, Store, icon: I, chart: C} = LOS;
const F = () => LOS.state.filters;
const GCATS = ['Financial', 'Career', 'Education', 'Health', 'Personal development', 'Lifestyle', 'Relationships', 'Creativity', 'Other'];
const GCOL = {Financial: 'butter', Career: 'pink', Education: 'lav', Health: 'sage', 'Personal development': 'peach', Lifestyle: 'peach', Relationships: 'pink', Creativity: 'lav', Other: 'ghost'};

/* ---------- goals ---------- */
LOS.goalProgress = g => {
  if (!g) return 0; if (g.status === 'Completed') return 100;
  const mode = g.mode || 'auto'; const ms = g.milestones || []; const lt = (g.linked || []).map(id => Store.get('task', id)).filter(Boolean);
  const byMs = () => pct(ms.filter(m => m.done).length, ms.length);
  const byVal = () => num(g.targetVal) ? Math.max(0, Math.min(100, Math.round((num(g.currentVal) - num(g.baseVal)) / (num(g.targetVal) - num(g.baseVal)) * 100))) : 0;
  const byTasks = () => pct(lt.filter(t => t.status === 'Completed').length, lt.length);
  if (mode === 'milestones') return byMs(); if (mode === 'value') return byVal(); if (mode === 'tasks') return byTasks(); if (mode === 'manual') return Math.round(num(g.manual));
  if (ms.length) return byMs(); if (num(g.targetVal)) return byVal(); if (lt.length) return byTasks(); return Math.round(num(g.manual));
};
const goalFields = () => [
  {k: 'title', label: 'Goal', required: true, full: true, ph: 'e.g., Complete an Azure certification'}, {k: 'desc', label: 'Why it matters', type: 'textarea', rows: 2},
  {k: 'category', label: 'Category', type: 'select', options: GCATS}, {k: 'status', label: 'Status', type: 'select', options: ['Not started', 'In progress', 'On hold', 'Completed']},
  {k: 'start', label: 'Start date', type: 'date'}, {k: 'target', label: 'Target date', type: 'date', after: 'start'},
  {k: 'milestones', label: 'Milestones', type: 'list', addLabel: 'Add milestone', ph: 'e.g., Understand Azure fundamentals'},
  {k: 'mode', label: 'Measure progress by', type: 'select', options: [{v: 'auto', l: 'Automatic (milestones → value → linked tasks)'}, {v: 'milestones', l: 'Completed milestones'}, {v: 'value', l: 'Current vs target value'}, {v: 'tasks', l: 'Linked tasks'}, {v: 'manual', l: 'Manual percentage'}]},
  {k: 'manual', label: 'Manual progress %', type: 'number', min: 0, max: 100, step: 1},
  {k: 'unit', label: 'Unit (for value goals)', ph: 'e.g., $, km, books'}, {k: 'baseVal', label: 'Starting value', type: 'number'},
  {k: 'currentVal', label: 'Current value', type: 'number'}, {k: 'targetVal', label: 'Target value', type: 'number'},
  {k: 'lproject', label: 'Related learning subject', type: 'select', blank: '—', options: () => Store.all('lproject').map(p => ({v: p.id, l: p.name}))}];
LOS.editGoal = (id, preset = {}) => { const g = id ? Store.get('goal', id) : null;
  LOS.openForm({title: g ? 'Edit goal' : 'New goal', size: 'wide', fields: goalFields(), values: g || Object.assign({category: 'Personal development', status: 'In progress', start: D.today(), mode: 'auto'}, preset),
    onSave: d => { const n = Object.assign({linked: []}, g || {}, d); if (d.status === 'Completed' && (!g || g.status !== 'Completed')) { n.completedAt = D.today(); LOS.confetti(140); LOS.toast('Goal achieved! ✿'); } if (d.status !== 'Completed') n.completedAt = null; Store.put('goal', n); },
    onDelete: g ? () => Store.del('goal', g.id) : null}); };
LOS.actions['add-goal'] = el => LOS.editGoal(null, el.dataset.cat ? {category: el.dataset.cat} : {}); LOS.actions['edit-goal'] = el => LOS.editGoal(el.dataset.id);
LOS.actions['goal-ms'] = el => {
  const g = Store.get('goal', el.dataset.id); const milestones = (g.milestones || []).map(m => m.id === el.dataset.ms ? {...m, done: el.checked, doneAt: el.checked ? D.today() : null} : m);
  const n = {...g, milestones, status: g.status === 'Not started' ? 'In progress' : g.status};
  const allDone = milestones.length && milestones.every(m => m.done);
  if (allDone && (g.mode === 'auto' || g.mode === 'milestones' || !g.mode)) { n.status = 'Completed'; n.completedAt = D.today(); Store.put('goal', n); LOS.confetti(150); LOS.toast('Every milestone done — goal achieved! ✿'); }
  else { if (g.status === 'Completed' && !allDone) { n.status = 'In progress'; n.completedAt = null; } Store.put('goal', n); if (el.checked) { LOS.confetti(40); LOS.toast('Milestone reached ✿'); } }
};
LOS.actions['goal-value'] = el => { const g = Store.get('goal', el.dataset.id); LOS.openForm({title: 'Update progress', size: 'narrow', fields: [{k: 'currentVal', label: `Current value${g.unit ? ' (' + g.unit + ')' : ''}`, type: 'number', required: true}], values: g, onSave: d => { const n = {...g, currentVal: d.currentVal, history: [...(g.history || []), {date: D.today(), v: d.currentVal}]}; Store.put('goal', n); if (LOS.goalProgress(n) >= 100) { LOS.confetti(100); LOS.toast('Target reached ✿ Mark the goal complete when you’re ready.'); } }}); };
LOS.actions['goal-link'] = el => {
  const g = Store.get('goal', el.dataset.id); const linked = new Set(g.linked || []);
  const ts = LOS.Tasks.all().filter(t => t.status !== 'Cancelled').sort((a, b) => (linked.has(b.id) - linked.has(a.id)) || (a.status === 'Completed') - (b.status === 'Completed'));
  const m = LOS.modal({title: 'Link tasks to “' + g.title + '”', body: ts.length ? `<input class="input" placeholder="Filter…" id="gl-q" style="margin-bottom:10px"><div id="gl-list" style="max-height:50vh;overflow:auto">${ts.map(t => `<label class="item check" data-t="${esc(t.title.toLowerCase())}"><input type="checkbox" class="cb" value="${t.id}" ${linked.has(t.id) ? 'checked' : ''}><span class="grow ${t.status === 'Completed' ? 'muted' : ''}">${esc(t.title)}</span><span class="tiny muted">${esc(t.status)}</span></label>`).join('')}</div>` : '<p class="muted">No tasks yet — create tasks in the planner first.</p>',
    foot: `<button class="btn" data-nt>${I('plus')} New linked task</button><button class="btn primary" data-ok>Save links</button>`, onMount: w => {
      const q = w.querySelector('#gl-q'); if (q) q.oninput = () => w.querySelectorAll('[data-t]').forEach(r => r.hidden = !r.dataset.t.includes(q.value.toLowerCase()));
      w.querySelector('[data-ok]').onclick = () => { const ids = [...w.querySelectorAll('input[type=checkbox]:checked')].map(c => c.value); Store.put('goal', {...Store.get('goal', g.id), linked: ids}); m.close(); };
      w.querySelector('[data-nt]').onclick = () => { m.close(); const t = LOS.Tasks.create({title: 'Next step: ' + g.title, category: g.category, priority: 'Medium', status: 'To Do'}); Store.put('goal', {...g, linked: [...(g.linked || []), t.id]}); LOS.editTask(t.id); };
    }});
};
LOS.afterTaskDone = t => { Store.all('goal').filter(g => (g.linked || []).includes(t.id) && g.status !== 'Completed').forEach(g => { if (LOS.goalProgress(g) >= 100 && (g.mode === 'tasks')) LOS.toast(`All tasks for “${g.title}” are done ✿`); }); };
const goalCard = g => {
  const p = LOS.goalProgress(g); const ms = g.milestones || []; const lt = (g.linked || []).map(id => Store.get('task', id)).filter(Boolean);
  const daysLeft = g.target ? D.diff(D.today(), g.target) : null;
  return `<div class="card hover ${g.status === 'Completed' ? 'tint-sage' : ''}"><div class="row top" style="gap:14px">${C.ring(p, {size: 84, color: g.status === 'Completed' ? '#3F8F3F' : '#C98770'})}<div class="grow"><span class="chip ${GCOL[g.category] || 'ghost'}">${esc(g.category)}</span><h3 class="clickable" style="margin:6px 0 2px" data-action="edit-goal" data-id="${g.id}">${esc(g.title)}</h3><div class="tiny muted">${esc(g.status)}${g.target ? ` · ${daysLeft >= 0 ? plural(daysLeft, 'day') + ' to go' : 'target was ' + D.fmt(g.target)}` : ''}</div></div><button class="icon-btn sm" data-action="edit-goal" data-id="${g.id}" aria-label="Edit">${I('edit')}</button>${LOS.delBtn('goal', g.id, 'this goal')}</div>
  ${g.desc ? `<p class="small muted" style="margin:10px 0 0">${esc(g.desc)}</p>` : ''}
  ${num(g.targetVal) ? `<div class="row small" style="margin-top:12px"><span class="grow">${esc(g.unit || '')}${num(g.currentVal)} of ${esc(g.unit || '')}${num(g.targetVal)}</span><button class="btn sm" data-action="goal-value" data-id="${g.id}">Update</button></div>` : ''}
  ${ms.length ? `<div class="eyebrow" style="margin:14px 0 4px">Milestones · ${ms.filter(m => m.done).length}/${ms.length}</div>${ms.map((m, i) => `<label class="item check" style="padding:6px 2px"><input type="checkbox" class="cb" ${m.done ? 'checked' : ''} data-change="goal-ms" data-id="${g.id}" data-ms="${m.id}"><span class="small ${m.done ? 'muted' : ''}" style="${m.done ? 'text-decoration:line-through' : ''}">${i + 1}. ${esc(m.t)}</span></label>`).join('')}` : ''}
  <div class="row" style="margin-top:12px"><button class="btn sm ghost" data-action="goal-link" data-id="${g.id}">${I('link')} ${lt.length ? `${lt.filter(t => t.status === 'Completed').length}/${lt.length} linked tasks` : 'Link tasks'}</button>${g.lproject && Store.get('lproject', g.lproject) ? `<span class="chip lav">${esc(Store.get('lproject', g.lproject).name)} · ${LOS.Learn.projProgress(g.lproject).p}%</span>` : ''}</div></div>`;
};

/* ---------- habits ---------- */
const H = LOS.Habits = {
  all: () => Store.all('habit').filter(h => !h.archived).sort(by(h => h.order ?? h.createdAt)),
  has: (h, k) => (h.dates || []).includes(k),
  countIn: (h, r) => (h.dates || []).filter(k => D.inR(k, r)).length,
  period: (h, k = D.today()) => h.freq === 'weekly' ? [D.weekStart(k), D.add(D.weekStart(k), 6)] : h.freq === 'monthly' ? [D.monthStart(D.month(k)), D.monthEnd(D.month(k))] : [k, k],
  target: h => Math.max(1, num(h.target) || 1),
  doneFor: (h, k = D.today()) => H.countIn(h, H.period(h, k)) >= H.target(h),
  streak(h) {
    let n = 0; let k = D.today();
    if (h.freq === 'weekly' || h.freq === 'monthly') {
      const step = p => h.freq === 'weekly' ? D.add(p, -7) : D.monthStart(D.monthAdd(D.month(p), -1));
      if (!H.doneFor(h, k)) k = step(k);
      for (let i = 0; i < 520 && H.doneFor(h, k); i++) { n++; k = step(k); }
      return n;
    }
    if (!H.has(h, k)) k = D.add(k, -1);
    while (H.has(h, k) && n < 5000) { n++; k = D.add(k, -1); }
    return n;
  },
  best(h) { if (h.freq !== 'daily' && h.freq) return null; const ds = [...new Set(h.dates || [])].sort(); let best = 0, cur = 0, prev = null; ds.forEach(k => { cur = prev && D.diff(prev, k) === 1 ? cur + 1 : 1; best = Math.max(best, cur); prev = k; }); return best; },
  consistency(h, days = 30) {
    const created = D.key(new Date(h.createdAt || Date.now()));
    if (h.freq === 'weekly') { const ws = Array.from({length: 8}, (_, i) => D.add(D.weekStart(), -7 * i)).filter(w => D.add(w, 6) >= created); return pct(ws.filter(w => H.doneFor(h, w)).length, ws.length); }
    if (h.freq === 'monthly') { const ms = Array.from({length: 6}, (_, i) => D.monthAdd(D.month(), -i)).filter(m => D.monthEnd(m) >= created); return pct(ms.filter(m => H.doneFor(h, D.monthStart(m))).length, ms.length); }
    const from = D.add(D.today(), -(days - 1)); const start = created > from ? created : from; const n = D.diff(start, D.today()) + 1;
    return pct(H.countIn(h, [start, D.today()]), n);
  },
  toggle(id, k = D.today()) {
    const h = Store.get('habit', id); if (!h) return; const has = H.has(h, k);
    const dates = has ? (h.dates || []).filter(x => x !== k) : [...(h.dates || []), k];
    Store.put('habit', {...h, dates});
    if (!has) { const n = {...h, dates}; const s = H.streak(n); if (H.doneFor(n, k) && !H.doneFor(h, k)) { if ([7, 14, 21, 30, 50, 100].includes(s)) { LOS.confetti(80); LOS.toast(`${s}-${h.freq === 'weekly' ? 'week' : h.freq === 'monthly' ? 'month' : 'day'} streak! ✿`); } else LOS.cheer(); } }
  }
};
LOS.editHabit = id => { const h = id ? Store.get('habit', id) : null;
  LOS.openForm({title: h ? 'Edit habit' : 'New habit', fields: [{k: 'name', label: 'Habit', required: true, ph: 'e.g., Read 10 pages', full: true}, {k: 'emoji', label: 'Emoji (optional)', ph: '📚'}, {k: 'freq', label: 'Track', type: 'select', options: [{v: 'daily', l: 'Daily'}, {v: 'weekly', l: 'Weekly'}, {v: 'monthly', l: 'Monthly'}]}, {k: 'target', label: 'Times per period', type: 'number', min: 1, max: 31, step: 1, hint: 'e.g., 3 times per week'}, {k: 'color', label: 'Colour', type: 'color'}],
    values: h || {freq: 'daily', target: 1, color: '#3F8F3F'}, onSave: d => Store.put('habit', Object.assign({dates: []}, h || {}, d)),
    onDelete: h ? () => Store.del('habit', h.id) : null, extraFoot: h ? `<button class="btn left" data-arch>${h.archived ? 'Restore' : 'Archive (keeps history)'}</button>` : ''});
  if (h) setTimeout(() => { const b = document.querySelector('[data-arch]'); if (b) b.onclick = () => { Store.put('habit', {...h, archived: !h.archived}); document.querySelector('.modal-wrap [data-close]').click(); }; }, 30);
};
LOS.actions['add-habit'] = () => LOS.editHabit(); LOS.actions['edit-habit'] = el => LOS.editHabit(el.dataset.id);
LOS.actions['habit-toggle'] = el => H.toggle(el.dataset.id, el.dataset.date || D.today());
LOS.habitsToday = () => {
  const hs = H.all(); if (!hs.length) return LOS.empty('No habits yet', 'Start with one tiny habit.', `<button class="btn sm" data-action="add-habit">${I('plus')} Add habit</button>`);
  return hs.map(h => { const done = H.has(h, D.today()); const s = H.streak(h); const c = H.countIn(h, H.period(h)); return `<label class="item check"><input type="checkbox" class="cb" ${done ? 'checked' : ''} data-action="habit-toggle" data-id="${h.id}" style="${done ? `background:${h.color};border-color:${h.color}` : ''}"><span class="grow">${h.emoji ? esc(h.emoji) + ' ' : ''}${esc(h.name)}${h.freq !== 'daily' ? ` <span class="tiny muted">${c}/${H.target(h)} this ${h.freq === 'weekly' ? 'week' : 'month'}</span>` : ''}</span>${s ? `<span class="streak ${LOS.animOn() ? 'anim' : ''}">${I('flame')}${s}</span>` : ''}</label>`; }).join('');
};
LOS.habitHeat = (from, to) => { const hs = Store.all('habit').filter(h => (h.freq || 'daily') === 'daily'); return C.heatmap({from, to, val: k => { const act = hs.filter(h => D.key(new Date(h.createdAt || 0)) <= k && (!h.archived || (h.dates || []).length)); return act.length ? act.filter(h => H.has(h, k)).length / act.length : null; }, tip: (k, v) => `${D.fmt(k)}: ${Math.round(v * 100)}% of daily habits`, color: '#3F8F3F'}); };
LOS.habitWeekly = (n = 8) => { const hs = H.all(); const weeks = Array.from({length: n}, (_, i) => D.add(D.weekStart(), (i - n + 1) * 7));
  return C.bar({labels: weeks.map(w => D.fmt(w)), series: [{name: 'Completion', values: weeks.map(w => { const end = D.add(w, 6) > D.today() ? D.today() : D.add(w, 6); let tot = 0, got = 0; hs.forEach(h => { if (h.freq === 'weekly') { tot += H.target(h); got += Math.min(H.target(h), H.countIn(h, [w, D.add(w, 6)])); } else if (!h.freq || h.freq === 'daily') { const days = D.days(w, end).filter(k => k >= D.key(new Date(h.createdAt || 0))); tot += days.length; got += days.filter(k => H.has(h, k)).length; } }); return tot ? Math.round(got / tot * 100) : 0; }), color: '#3F8F3F'}], fmt: v => Math.round(v) + '%', emptyMsg: 'Check off habits to see weekly progress.'}); };

LOS.register('goals', {title: 'Goals & Habits', icon: 'target',
  render() {
    const tab = LOS.tab('goals', 'goals'); const gs = Store.all('goal');
    return LOS.hero('goals', {title: 'Goals & Habits', script: 'becoming, gradually', tone: 'sage', sub: `${gs.filter(g => g.status !== 'Completed').length} active goals · ${H.all().length} habits`, actions: `<button class="btn" data-action="add-habit">${I('plus')} Habit</button><button class="btn primary" data-action="add-goal">${I('plus')} Goal</button>`}) +
      LOS.tabsHtml('goals', [['goals', 'Goals'], ['habits', 'Habit tracker'], ['insights', 'Habit insights']], tab) + ({goals, habits, insights})[tab]();
  }
});
function goals() {
  const c = F().gcat || ''; const st = F().gst || 'active';
  const gs = Store.all('goal').filter(g => (!c || g.category === c) && (st === 'all' || (st === 'done' ? g.status === 'Completed' : g.status !== 'Completed'))).sort(by(g => g.target || '9'));
  return `<div class="toolbar">${LOS.seg('gst', [['active', 'Active'], ['done', 'Achieved'], ['all', 'All']], st)}<select class="input" data-change="fset" data-k="gcat" aria-label="Category"><option value="">All categories</option>${GCATS.map(x => `<option ${x === c ? 'selected' : ''}>${x}</option>`).join('')}</select><span class="spacer"></span></div>
  ${gs.length ? `<div class="grid g2">${gs.map(goalCard).join('')}</div>` : `<div class="card">${LOS.empty(st === 'done' ? 'Achieved goals will live here' : 'What are you working towards?', 'Break a big goal into milestones — progress updates as you tick them off.', `<button class="btn primary sm" data-action="add-goal">${I('plus')} New goal</button>`)}</div>`}`;
}
function habits() {
  const hs = H.all(); const ws = F().hweek || D.weekStart(); const days = D.days(ws, D.add(ws, 6));
  const arch = Store.all('habit').filter(h => h.archived);
  if (!hs.length) return `<div class="card">${LOS.empty('No habits yet', 'Tiny and specific works best: “drink a glass of water after waking up”.', `<button class="btn primary sm" data-action="add-habit">${I('plus')} Add habit</button>`)}</div>`;
  return `<div class="toolbar"><button class="icon-btn" data-action="hweek" data-d="-7" aria-label="Previous week">${I('left')}</button><b style="min-width:180px;text-align:center">${D.fmt(ws)} – ${D.fmt(D.add(ws, 6))}</b><button class="icon-btn" data-action="hweek" data-d="7" aria-label="Next week">${I('right')}</button>${ws !== D.weekStart() ? `<button class="btn sm" data-action="hweek" data-d="0">This week</button>` : ''}<input type="date" class="input" value="${ws}" data-change="period-date" data-key="hweek" data-week="1" aria-label="Jump to week"><span class="spacer"></span><button class="btn sm primary" data-action="add-habit">${I('plus')} Habit</button></div>
  <div class="card" style="overflow-x:auto"><div class="hgrid" style="min-width:560px"><div></div>${days.map(k => `<div class="hd" style="${k === D.today() ? 'color:var(--terra)' : ''}">${D.dow(k)}<br>${D.parse(k).getDate()}</div>`).join('')}<div class="hd">Streak</div>
  ${hs.map(h => `<div class="hn"><div class="row" style="gap:4px"><span class="grow clickable" data-action="edit-habit" data-id="${h.id}" title="${esc(h.name)}" style="overflow:hidden;text-overflow:ellipsis"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${esc(h.color || '#3F8F3F')};margin-right:6px"></span>${h.emoji ? esc(h.emoji) + ' ' : ''}${esc(h.name)}</span><span class="hacts"><button class="icon-btn sm" data-action="edit-habit" data-id="${h.id}" aria-label="Edit habit" style="width:24px;height:24px">${I('edit')}</button><button class="icon-btn sm del" data-action="del-rec" data-kind="habit" data-id="${h.id}" data-label="this habit and its history" aria-label="Delete habit" style="width:24px;height:24px">${I('trash')}</button></span></div><div class="tiny muted">${h.freq === 'daily' || !h.freq ? 'daily' : `${H.countIn(h, H.period(h, ws))}/${H.target(h)} ${h.freq === 'weekly' ? 'this week' : 'this month'}`} · ${H.consistency(h)}%</div></div>${days.map(k => `<div class="hc">${k > D.today() ? '<span class="tiny muted">·</span>' : `<input type="checkbox" class="cb" ${H.has(h, k) ? 'checked' : ''} data-action="habit-toggle" data-id="${h.id}" data-date="${k}" aria-label="${esc(h.name)} on ${D.fmt(k)}" style="${H.has(h, k) ? `background:${h.color};border-color:${h.color}` : ''}">`}</div>`).join('')}<div class="hc"><span class="streak ${LOS.animOn() ? 'anim' : ''}">${I('flame')}${H.streak(h)}</span></div>`).join('')}</div>
  <p class="tiny muted" style="margin:14px 0 0">Missed a day? Your history stays — consistency shows the bigger picture, and every check-in counts.</p></div>
  ${arch.length ? `<details style="margin-top:14px"><summary class="small muted" style="cursor:pointer">${plural(arch.length, 'archived habit')}</summary>${arch.map(h => `<div class="item"><span class="grow clickable" data-action="edit-habit" data-id="${h.id}">${esc(h.name)} <span class="tiny muted">· ${plural((h.dates || []).length, 'check-in')}</span></span>${LOS.delBtn('habit', h.id, 'this habit and its history')}</div>`).join('')}</details>` : ''}`;
}
LOS.actions.hweek = el => { const d = +el.dataset.d; F().hweek = d ? D.add(F().hweek || D.weekStart(), d) : D.weekStart(); LOS.render(); };
function insights() {
  const hs = H.all(); const t = D.today();
  if (!hs.length) return `<div class="card">${LOS.empty('Add a habit to see insights')}</div>`;
  return `<div class="grid g2"><div class="card spanall"><div class="card-h"><h3>Monthly habit heatmap</h3><span class="small muted">share of daily habits done each day</span></div>${LOS.habitHeat(D.add(t, -120), t)}</div>
  <div class="card"><div class="card-h"><h3>Weekly progress</h3></div>${LOS.habitWeekly()}</div>
  <div class="card"><div class="card-h"><h3>Per habit</h3></div>${hs.map(h => `<div style="margin-bottom:14px"><div class="row small"><span class="grow">${h.emoji ? esc(h.emoji) + ' ' : ''}${esc(h.name)}</span><span class="streak">${I('flame')}${H.streak(h)}</span>${H.best(h) != null ? `<span class="tiny muted">best ${H.best(h)}</span>` : ''}<b>${H.consistency(h)}%</b></div>${LOS.bar(H.consistency(h), '', 'Consistency')}<div class="tiny muted" style="margin-top:3px">${plural((h.dates || []).length, 'check-in')} total</div></div>`).join('')}</div>
  ${hs.map(h => `<div class="card"><div class="card-h"><h4 style="flex:1">${h.emoji ? esc(h.emoji) + ' ' : ''}${esc(h.name)}</h4><span class="chip ghost">${esc(h.freq || 'daily')}</span></div>${C.heatmap({from: D.add(t, -90), to: t, val: k => k < D.key(new Date(h.createdAt || 0)) ? null : H.has(h, k) ? 1 : 0, tip: (k, v) => `${D.fmt(k)}: ${v ? 'done' : '—'}`, color: h.color})}</div>`).join('')}</div>`;
}

/* integrations */
LOS.widgets.habits = {title: 'Habits today', tone: 'sage', link: ['goals', 'Tracker', 'habits'], render: () => LOS.habitsToday()};
LOS.widgets.goals = {title: 'Goals', link: ['goals', 'Goals'], render() { const gs = Store.all('goal').filter(g => g.status !== 'Completed').sort(by(g => g.target || '9')).slice(0, 4); return gs.length ? gs.map(g => `<div style="margin-bottom:12px"><div class="row between small"><span class="clickable" data-action="edit-goal" data-id="${g.id}">${esc(g.title)}</span><b>${LOS.goalProgress(g)}%</b></div>${LOS.bar(LOS.goalProgress(g), 'terra')}</div>`).join('') : LOS.empty('No active goals', '', `<button class="btn sm" data-action="add-goal">${I('plus')} Goal</button>`); }};
LOS.calProviders.push((from, to) => Store.all('goal').filter(g => g.target && g.status !== 'Completed' && D.inR(g.target, [from, to])).map(g => ({key: 'goal:' + g.id, date: g.target, title: 'Goal target · ' + g.title, type: 'event', cls: 'event', label: 'Goal', open: () => LOS.editGoal(g.id)})));
LOS.notifProviders.push(() => { const t = D.today(), out = [];
  Store.all('goal').filter(g => g.target && g.status !== 'Completed' && g.target >= t && g.target <= D.add(t, 14)).forEach(g => out.push({key: 'goal-' + g.id + g.target, cat: 'goals', icon: 'target', tone: 'sage', title: `“${g.title}” target ${D.rel(g.target).toLowerCase()}`, body: `${LOS.goalProgress(g)}% there — what’s one small next step?`, open: () => LOS.editGoal(g.id)}));
  const h = new Date().getHours(); const left = H.all().filter(x => (!x.freq || x.freq === 'daily') && !H.has(x, t));
  if (h >= 17 && left.length) out.push({key: 'habits-' + t, cat: 'habits', icon: 'flame', tone: 'sage', title: `${plural(left.length, 'habit')} still open today`, body: left.map(x => x.name).join(', ') + ' — only if you have the energy ♡', route: 'goals', tab: 'habits'});
  return out; });
LOS.searchProviders.push(q => Store.all('goal').filter(g => LOS.match(q, g.title, g.desc, (g.milestones || []).map(m => m.t).join(' '))).map(g => ({icon: 'target', title: g.title, sub: 'Goal · ' + LOS.goalProgress(g) + '%', open: () => LOS.editGoal(g.id)})));
LOS.searchProviders.push(q => Store.all('habit').filter(h => LOS.match(q, h.name)).map(h => ({icon: 'flame', title: h.name, sub: 'Habit', open: () => LOS.editHabit(h.id)})));
LOS.quick.push({label: 'Goal', icon: 'target', open: () => LOS.editGoal()});
LOS.quick.push({label: 'Habit', icon: 'flame', open: () => LOS.editHabit()});
})();
