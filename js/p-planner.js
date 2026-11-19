/* Rua — tasks engine, Today, Focus mode, Planner (board/list/table/calendar/timeline/day/week/month/year) */
(function(){
'use strict';
const {$, $$, esc, uid, num, by, sum, pct, plural, mins, D, Store, icon: I, chart: C} = LOS;
LOS.calProviders = LOS.calProviders || [];

const STATUSES = ['Not Started', 'To Do', 'In Progress', 'On Hold', 'Completed', 'Cancelled'];
const PRIOS = ['Critical', 'High', 'Medium', 'Low'];
const PRANK = {Critical: 0, High: 1, Medium: 2, Low: 3};
const COLS = [['Backlog', 'Not Started', '#9A8C80'], ['To Do', 'To Do', '#E0A21A'], ['In Progress', 'In Progress', '#7B62C9'], ['On Hold', 'On Hold', '#D9638F'], ['Completed', 'Completed', '#3F8F3F']];
const CATS = ['Personal', 'Work', 'Career', 'Learning', 'Health', 'Home', 'Finance', 'Errands', 'Creative', 'Self-care'];
const RECUR = [['none', 'Does not repeat'], ['daily', 'Every day'], ['weekdays', 'Every weekday (Mon–Fri)'], ['weekly', 'Every week'], ['biweekly', 'Every 2 weeks'], ['monthly', 'Every month'], ['yearly', 'Every year'], ['custom', 'Every N days (custom)']];

const isDone = t => t.status === 'Completed';
const isOpen = t => t.status !== 'Completed' && t.status !== 'Cancelled';
const isOverdue = t => isOpen(t) && t.due && t.due < D.today();

const Tasks = LOS.Tasks = {
  STATUSES, PRIOS, CATS, isDone, isOpen, isOverdue,
  all: () => Store.all('task'),
  create(d) {
    const t = Object.assign({title: '', desc: '', category: 'Personal', project: '', priority: 'Medium', status: 'To Do', start: '', due: '', estMin: null, actualMin: 0, subtasks: [], tags: [], recur: 'none', recurN: null, links: [], notes: '', reminder: '', completedAt: null}, d);
    t.id = t.id || uid(); if (t.recur && t.recur !== 'none' && !t.seriesId) t.seriesId = t.id;
    return Store.put('task', t);
  },
  nextDue(t) {
    const base = t.due || D.today();
    switch (t.recur) {
      case 'daily': return D.add(base, 1);
      case 'weekdays': { let k = D.add(base, 1); while ([0, 6].includes(D.parse(k).getDay())) k = D.add(k, 1); return k; }
      case 'weekly': return D.add(base, 7);
      case 'biweekly': return D.add(base, 14);
      case 'monthly': return D.addMonths(base, 1, t.anchorDay || D.parse(base).getDate());
      case 'yearly': return D.addMonths(base, 12, t.anchorDay || D.parse(base).getDate());
      case 'custom': return D.add(base, Math.max(1, num(t.recurN) || 1));
    }
    return null;
  },
  spawnNext(t) {
    if (!t.recur || t.recur === 'none') return null;
    const next = Tasks.nextDue(t); if (!next) return null;
    if (t.recurUntil && next > t.recurUntil) return null;
    const series = t.seriesId || t.id;
    const id = series + '~' + next;
    if (Store.get('task', id)) return null; // never duplicate an occurrence
    const off = t.start && t.due ? D.diff(t.start, t.due) : null;
    const n = Object.assign({}, t, {id, seriesId: series, due: next, start: off != null ? D.add(next, -off) : '', status: 'To Do', completedAt: null, actualMin: 0, createdAt: null, top: false, topDate: null, originalDue: null, reschedules: [],
      anchorDay: t.anchorDay || (t.due ? D.parse(t.due).getDate() : null), subtasks: (t.subtasks || []).map(s => ({...s, done: false, doneAt: null}))});
    return Store.put('task', n, {silent: true});
  },
  setStatus(t, status) {
    const was = t.status; t = Object.assign({}, t, {status});
    if (status === 'Completed' && was !== 'Completed') { t.completedAt = D.today(); Store.put('task', t); Tasks.spawnNext(t); LOS.cheer(t.top); LOS.afterTaskDone && LOS.afterTaskDone(t); }
    else { if (status !== 'Completed') t.completedAt = null; Store.put('task', t); }
    return t;
  },
  toggle(id) { const t = Store.get('task', id); if (!t) return; Tasks.setStatus(t, isDone(t) ? 'To Do' : 'Completed'); },
  reschedule(t, due) {
    const n = Object.assign({}, t, {due});
    if (!n.originalDue) n.originalDue = t.due || '';
    n.reschedules = [...(t.reschedules || []), {from: t.due || '', to: due, at: D.today()}];
    if (n.start && n.start > due) n.start = due;
    return Store.put('task', n);
  },
  todaySet() { const t = D.today(); return Tasks.all().filter(x => x.status !== 'Cancelled' && (x.due === t || x.completedAt === t || (x.top && x.topDate === t))); },
  priorities() { const t = D.today(); return Tasks.all().filter(x => x.top && x.topDate === t && x.status !== 'Cancelled').sort(by(x => x.topOrder || 0)).slice(0, 3); },
  suggestions() {
    const t = D.today();
    return Tasks.all().filter(x => isOpen(x) && !(x.top && x.topDate === t) && (!x.due || x.due <= D.add(t, 2)))
      .sort((a, b) => (PRANK[a.priority] - PRANK[b.priority]) || ((a.due || '9') < (b.due || '9') ? -1 : 1)).slice(0, 5);
  }
};
LOS.Tasks.cats = () => Array.from(new Set([...CATS, ...Tasks.all().map(t => t.category).filter(Boolean)]));
LOS.Tasks.projects = () => Array.from(new Set(Tasks.all().map(t => t.project).filter(Boolean))).sort();

/* ---------- task form ---------- */
const taskFields = () => [
  {k: 'title', label: 'Task', required: true, full: true, ph: 'e.g., Update resume for cloud roles'},
  {k: 'desc', label: 'Description', type: 'textarea', rows: 2},
  {k: 'priority', label: 'Priority', type: 'select', options: PRIOS, def: 'Medium'},
  {k: 'status', label: 'Status', type: 'select', options: STATUSES, def: 'To Do'},
  {k: 'category', label: 'Category', list: Tasks.cats, def: 'Personal'},
  {k: 'project', label: 'Project', list: Tasks.projects, ph: 'Optional'},
  {k: 'start', label: 'Start date', type: 'date'},
  {k: 'due', label: 'Due date', type: 'date', after: 'start'},
  {k: 'estMin', label: 'Estimated time (minutes)', type: 'number', min: 0, step: 5},
  {k: 'actualMin', label: 'Actual time spent (minutes)', type: 'number', min: 0, step: 5},
  {k: 'recur', label: 'Repeat', type: 'select', options: RECUR.map(([v, l]) => ({v, l})), def: 'none'},
  {k: 'recurN', label: 'Custom: repeat every N days', type: 'number', min: 1, step: 1, hint: 'Only used with “Every N days”'},
  {k: 'recurUntil', label: 'Repeat until (optional)', type: 'date'},
  {k: 'reminder', label: 'Reminder', type: 'datetime-local', hint: 'Shows in your notification centre'},
  {k: 'subtasks', label: 'Smaller steps', type: 'list', addLabel: 'Add a step', ph: 'A tiny next step…'},
  {k: 'tags', label: 'Tags', type: 'tags', ph: 'comma, separated', full: true},
  {k: 'links', label: 'Attachments & links', type: 'links', addLabel: 'Add link', hint: 'Paste links to docs, files in your cloud drive, etc.'},
  {k: 'notes', label: 'Notes', type: 'textarea', rows: 2}
];
LOS.editTask = (id, preset = {}) => {
  const t = id ? Store.get('task', id) : null;
  const vals = t || Object.assign({status: 'To Do', priority: 'Medium', category: 'Personal'}, preset);
  LOS.openForm({title: t ? 'Edit task' : 'New task', size: 'wide', fields: taskFields(), values: vals,
    extraFoot: t && t.completedAt ? `<span class="small muted left" style="align-self:center">Completed ${D.fmt(t.completedAt, {month: 'short', day: 'numeric', year: 'numeric'})}</span>` : (t && t.originalDue && t.originalDue !== t.due ? `<span class="small muted left" style="align-self:center">Originally due ${D.fmt(t.originalDue)}</span>` : ''),
    onSave: d => {
      if (d.recur === 'custom' && !d.recurN) d.recurN = 1;
      if (t) {
        const dueChanged = t.due && d.due && t.due !== d.due;
        let n = Object.assign({}, t, d);
        if (dueChanged) { n.originalDue = t.originalDue || t.due; n.reschedules = [...(t.reschedules || []), {from: t.due, to: d.due, at: D.today()}]; }
        if (d.recur !== 'none' && !n.seriesId) n.seriesId = n.id;
        if (d.status === 'Completed' && t.status !== 'Completed') { Tasks.setStatus(n, 'Completed'); }
        else { if (d.status !== 'Completed') n.completedAt = null; Store.put('task', n); }
      } else { const n = Tasks.create(d); if (d.status === 'Completed') Tasks.setStatus(n, 'Completed'); else LOS.toast('Task added'); }
    },
    onDelete: t ? () => { Store.del('task', t.id); LOS.toast('Task deleted'); } : null});
};
LOS.actions['new-task'] = el => LOS.editTask(null, {due: el.dataset.due || '', status: el.dataset.status || 'To Do', category: el.dataset.cat || 'Personal'});
LOS.actions['edit-task'] = el => LOS.editTask(el.dataset.id);
LOS.actions['toggle-task'] = (el) => { const t = Store.get('task', el.dataset.id); if (!t) return; if (!isDone(t) && LOS.animOn()) el.classList.add('pop-check'); setTimeout(() => Tasks.toggle(el.dataset.id), LOS.animOn() ? 160 : 0); };
LOS.actions['toggle-sub'] = el => {
  const t = Store.get('task', el.dataset.id); if (!t) return;
  const subtasks = (t.subtasks || []).map(s => s.id === el.dataset.sub ? {...s, done: !s.done, doneAt: !s.done ? D.today() : null} : s);
  Store.put('task', {...t, subtasks, status: t.status === 'To Do' || t.status === 'Not Started' ? 'In Progress' : t.status});
  if (subtasks.every(s => s.done) && subtasks.length) LOS.toast('All steps done — mark the task complete?');
};
LOS.actions['task-status'] = el => { const t = Store.get('task', el.dataset.id); t && Tasks.setStatus(t, el.value); };
LOS.actions['pin-top'] = el => {
  const t = Store.get('task', el.dataset.id); if (!t) return;
  const cur = Tasks.priorities();
  if (t.top && t.topDate === D.today()) { Store.put('task', {...t, top: false, topDate: null}); return; }
  if (cur.length >= 3) { LOS.toast('You already have 3 priorities — unpin one first. Three is plenty ♡'); return; }
  Store.put('task', {...t, top: true, topDate: D.today(), topOrder: cur.length, due: t.due || D.today()});
};
LOS.actions['reschedule'] = el => {
  const t = Store.get('task', el.dataset.id); if (!t) return;
  const opts = [['Today', D.today()], ['Tomorrow', D.add(D.today(), 1)], ['This weekend', D.add(D.weekStart(), 5)], ['Next week', D.add(D.weekStart(), 7)]];
  const m = LOS.modal({title: 'Reschedule', size: 'narrow', body: `<p class="small muted" style="margin-top:0">No stress — “${esc(t.title)}” keeps all its details.${t.originalDue ? ` Originally due ${D.fmt(t.originalDue)}.` : ''}</p><div class="grid g2" style="gap:8px">${opts.map(([l, k]) => `<button class="btn" data-k="${k}">${l}<span class="tiny muted">${D.fmt(k, {weekday: 'short', month: 'short', day: 'numeric'})}</span></button>`).join('')}</div><div class="field" style="margin-top:14px"><label for="rs-d">Pick a date</label><input type="date" id="rs-d" value="${t.due || D.today()}"></div><button class="btn sm ghost" style="margin-top:10px" data-nodate>Remove the date (backlog)</button>`,
    foot: `<button class="btn primary" data-go>Move</button>`,
    onMount: w => {
      w.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { Tasks.reschedule(t, b.dataset.k); m.close(); LOS.toast('Moved to ' + D.rel(b.dataset.k)); });
      w.querySelector('[data-go]').onclick = () => { const v = w.querySelector('#rs-d').value; if (!v) return; Tasks.reschedule(t, v); m.close(); LOS.toast('Moved to ' + D.rel(v)); };
      w.querySelector('[data-nodate]').onclick = () => { Store.put('task', {...t, originalDue: t.originalDue || t.due, due: '', status: 'Not Started', top: false}); m.close(); };
    }});
};
LOS.actions['rollover'] = async el => {
  const to = el.dataset.to || D.today();
  const list = Tasks.all().filter(t => isOpen(t) && t.due && t.due < (el.dataset.before || D.today()));
  if (!list.length) { LOS.toast('Nothing to carry over'); return; }
  list.forEach(t => Tasks.reschedule(t, to));
  LOS.toast(`Moved ${plural(list.length, 'task')} to ${D.rel(to).toLowerCase()} — fresh start ✿`);
};
LOS.actions['breakdown'] = el => {
  const t = Store.get('task', el.dataset.id); if (!t) return;
  const m = LOS.modal({title: 'Break it down', body: `<p class="small muted" style="margin-top:0">Write one small step per line. Make the first one so easy it feels silly.</p><textarea class="input" id="bd" rows="7" placeholder="Open the document\nWrite 3 bullet points\n…">${esc((t.subtasks || []).filter(s => !s.done).map(s => s.t).join('\n'))}</textarea>`,
    foot: `<button class="btn primary" data-ok>Save steps</button>`,
    onMount: w => w.querySelector('[data-ok]').onclick = () => {
      const lines = w.querySelector('#bd').value.split('\n').map(s => s.trim()).filter(Boolean);
      const done = (t.subtasks || []).filter(s => s.done);
      const keep = Object.fromEntries((t.subtasks || []).map(s => [s.t, s]));
      Store.put('task', {...t, subtasks: [...done, ...lines.filter(l => !(keep[l] && keep[l].done)).map(l => keep[l] && !keep[l].done ? keep[l] : {id: uid(), t: l, done: false})]});
      m.close(); LOS.toast('Steps saved');
    }});
};

/* ---------- task renderers ---------- */
const prioChip = p => `<span class="chip p-${esc(p)}">${esc(p)}</span>`;
const dueChip = t => {
  if (!t.due) return '';
  if (isOverdue(t)) return `<span class="chip butter" data-tip="Originally ${esc(D.fmt(t.due))}">Carried over · ${esc(D.rel(t.due))}</span>`;
  return `<span class="chip ${t.due === D.today() ? 'peach' : 'ghost'}">${I('cal')}${esc(D.rel(t.due))}</span>`;
};
const subProg = t => (t.subtasks || []).length ? `<span class="tiny muted">${t.subtasks.filter(s => s.done).length}/${t.subtasks.length} steps</span>` : '';
LOS.taskRow = (t, opts = {}) => `<div class="item ${isDone(t) ? 'done' : ''}">
  <input type="checkbox" class="cb round" ${isDone(t) ? 'checked' : ''} data-action="toggle-task" data-id="${t.id}" aria-label="Complete ${esc(t.title)}">
  <div class="grow clickable" data-action="edit-task" data-id="${t.id}"><div class="t">${esc(t.title)}</div>
  <div class="meta">${prioChip(t.priority)}${dueChip(t)}${t.estMin ? `<span>${I('clock')} ${mins(t.estMin)}</span>` : ''}${t.category ? `<span>${esc(t.category)}</span>` : ''}${t.project ? `<span>· ${esc(t.project)}</span>` : ''}${t.recur && t.recur !== 'none' ? `<span data-tip="Repeats">${I('refresh')}</span>` : ''}${subProg(t)}</div></div>
  <div class="acts">${isOpen(t) ? `<button class="icon-btn sm" data-action="pin-top" data-id="${t.id}" data-tip="${t.top && t.topDate === D.today() ? 'Unpin from priorities' : 'Make a top-3 priority'}">${I('star')}</button><button class="icon-btn sm" data-action="breakdown" data-id="${t.id}" data-tip="Break into steps">${I('split')}</button><button class="icon-btn sm" data-action="reschedule" data-id="${t.id}" data-tip="Reschedule">${I('cal')}</button>` : ''}<button class="icon-btn sm" data-action="edit-task" data-id="${t.id}" data-tip="Edit">${I('edit')}</button>${LOS.delBtn('task', t.id, 'this task')}</div></div>`;

LOS.prioCard = (t, i) => `<div class="prio ${isDone(t) ? 'done' : ''}"><span class="num">${i + 1}</span><input type="checkbox" class="cb round" ${isDone(t) ? 'checked' : ''} data-action="toggle-task" data-id="${t.id}" aria-label="Complete">
  <div class="grow clickable" data-action="edit-task" data-id="${t.id}"><div class="t" style="font-weight:600">${esc(t.title)}</div><div class="meta small muted row wrap" style="gap:6px;margin-top:4px">${prioChip(t.priority)}${t.due ? `<span>${esc(D.rel(t.due))}</span>` : ''}${t.estMin ? `<span>· ${mins(t.estMin)}</span>` : ''}${subProg(t)}</div></div>
  <button class="icon-btn sm" data-action="pin-top" data-id="${t.id}" data-tip="Unpin">${I('x')}</button></div>`;

LOS.prioritiesBlock = () => {
  const p = Tasks.priorities();
  const sugg = p.length < 3 ? Tasks.suggestions() : [];
  return `${p.map(LOS.prioCard).join('')}${p.length < 3 ? `<div class="small muted" style="margin:8px 0 6px">${p.length ? 'Room for ' + (3 - p.length) + ' more.' : 'Pick up to three things that would make today feel good.'}</div>${sugg.map(t => `<div class="item"><button class="icon-btn sm" data-action="pin-top" data-id="${t.id}" data-tip="Make it a priority">${I('star')}</button><div class="grow small">${esc(t.title)} <span class="muted">· ${esc(t.priority)}${t.due ? ' · ' + esc(D.rel(t.due)) : ''}</span></div></div>`).join('')}<button class="btn sm ghost" data-action="new-task" data-due="${D.today()}" style="margin-top:6px">${I('plus')} New task for today</button>` : ''}`;
};

/* ---------- Today page ---------- */
LOS.todayStats = () => { const s = Tasks.todaySet(); const done = s.filter(isDone).length; return {total: s.length, done, pending: s.length - done, p: pct(done, s.length)}; };
LOS.register('today', {title: 'Today', icon: 'sun', hideable: false,
  render() {
    const st = LOS.todayStats(); const t = D.today();
    const set = Tasks.todaySet().filter(x => !(x.top && x.topDate === t)).sort((a, b) => (isDone(a) - isDone(b)) || PRANK[a.priority] - PRANK[b.priority]);
    const carried = Tasks.all().filter(isOverdue).sort(by(x => x.due));
    const day = Store.get('day', t) || {};
    const agenda = LOS.calendarItems(t, t).filter(x => x.type !== 'task');
    const blocks = (day.blocks || []).slice().sort(by(b => b.start));
    return LOS.hero('today', {title: D.long(t), script: 'one thing at a time', tone: 'peach', sub: st.total ? `${st.done} of ${st.total} done today. ${st.pending ? 'Gentle progress is still progress.' : 'Everything for today is done — enjoy it.'}` : 'A blank page. Choose up to three priorities to begin.',
      actions: `<button class="btn" data-action="focus-mode">${I('target')} Focus mode</button><button class="btn primary" data-action="new-task" data-due="${t}">${I('plus')} Add task</button>`}) +
    `<div class="grid g3">
      <div class="card tint-peach span2"><div class="card-h"><h3>Today’s three</h3><span class="eyebrow" style="flex:none">max 3</span></div>${LOS.prioritiesBlock()}</div>
      <div class="card" style="display:flex;flex-direction:column;align-items:center;gap:10px;justify-content:center">${C.ring(st.p, {size: 150, sub: `${st.done}/${st.total} tasks`})}<div class="small muted">${st.pending ? plural(st.pending, 'task') + ' left' : st.total ? 'All done ✿' : 'Nothing planned yet'}</div></div>
      ${carried.length ? `<div class="card spanall" style="background:#FBF6E6"><div class="card-h"><h3>Carried over</h3><button class="btn sm" data-action="rollover" data-to="${t}">Move all to today</button><button class="btn sm ghost" data-action="rollover" data-to="${D.add(t, 1)}">…or tomorrow</button></div><p class="small muted" style="margin:-6px 0 8px">These slipped past their dates. That happens — pick what still matters and let the rest wait.</p>${carried.slice(0, 8).map(x => LOS.taskRow(x)).join('')}${carried.length > 8 ? `<button class="btn sm ghost" data-route="planner" data-tab="list">See all ${carried.length}</button>` : ''}</div>` : ''}
      <div class="card span2"><div class="card-h"><h3>Also on today</h3><button class="btn sm ghost" data-action="new-task" data-due="${t}">${I('plus')} Add</button></div>${set.length ? set.map(x => LOS.taskRow(x)).join('') : LOS.empty('Nothing else scheduled', 'Your priorities are the whole plan. Lovely.')}</div>
      <div class="card"><div class="card-h"><h3>Schedule</h3><button class="btn sm ghost" data-action="add-block" data-date="${t}">${I('plus')} Block</button></div>
        ${blocks.length || agenda.length ? [...blocks.map(b => ({time: b.start, html: `<div class="item"><span class="chip lav">${esc(D.time(b.start))}${b.end ? '–' + esc(D.time(b.end)) : ''}</span><span class="grow">${esc(b.label)}</span><button class="icon-btn sm" data-action="del-block" data-date="${t}" data-id="${b.id}" aria-label="Remove">${I('x')}</button></div>`})), ...agenda.map(a => ({time: a.time || '99', html: `<div class="item clickable" data-action="cal-open" data-key="${esc(a.key)}"><span class="chip ${a.cls || ''}">${a.time ? esc(D.time(a.time)) : esc(a.label)}</span><span class="grow">${esc(a.title)}</span></div>`}))].sort(by(x => x.time)).map(x => x.html).join('') : LOS.empty('No time blocks', 'Block time for your priorities so they have a home.')}
      </div>
      ${LOS.habitsToday ? `<div class="card tint-sage"><div class="card-h"><h3>Habits</h3><button class="btn sm ghost" data-route="goals" data-tab="habits">All</button></div>${LOS.habitsToday()}</div>` : ''}
      <div class="card span2"><div class="card-h"><h3>Notes & reflection</h3></div>${dayNotes(t, day)}</div>
    </div>`;
  }
});
function dayNotes(k, day) {
  return `<div class="grid g2"><div class="field"><label for="dn-notes">Daily notes</label><textarea id="dn-notes" class="input" rows="4" data-input="day-field" data-date="${k}" data-f="notes" placeholder="Brain-dump here…">${esc(day.notes || '')}</textarea></div>
  <div class="field"><label for="dn-refl">End-of-day reflection</label><textarea id="dn-refl" class="input" rows="4" data-input="day-field" data-date="${k}" data-f="reflection" placeholder="What went well? What can wait for tomorrow?">${esc(day.reflection || '')}</textarea></div></div><div class="tiny muted" style="margin-top:6px">Saves automatically.</div>`;
}
LOS.dayNotes = dayNotes;
const saveDayField = LOS.debounce((k, f, v) => { const d = Store.get('day', k) || {id: k}; Store.put('day', {...d, [f]: v}, {silent: true}); }, 500);
LOS.actions['day-field'] = el => saveDayField(el.dataset.date, el.dataset.f, el.value);
LOS.actions['add-block'] = el => {
  const k = el.dataset.date;
  LOS.openForm({title: 'Time block', size: 'narrow', fields: [{k: 'label', label: 'What', required: true, full: true, list: () => Tasks.all().filter(isOpen).map(t => t.title)}, {k: 'start', label: 'Start', type: 'time', required: true}, {k: 'end', label: 'End', type: 'time', validate: (v, o) => v && o.start && v <= o.start ? 'End must be after start' : ''}],
    onSave: d => { const day = Store.get('day', k) || {id: k}; Store.put('day', {...day, blocks: [...(day.blocks || []), {id: uid(), ...d}]}); }});
};
LOS.actions['del-block'] = el => { const day = Store.get('day', el.dataset.date); if (!day) return; Store.put('day', {...day, blocks: (day.blocks || []).filter(b => b.id !== el.dataset.id)}); };

/* ---------- Focus mode ---------- */
let focus = {id: null, sec: 25 * 60, left: 25 * 60, running: false, mode: 'timer', elapsed: 0, iv: null, logged: 0};
LOS.actions['focus-mode'] = (el) => {
  const cand = [...Tasks.priorities().filter(isOpen), ...Tasks.all().filter(t => isOpen(t) && t.status === 'In Progress'), ...Tasks.todaySet().filter(isOpen)];
  focus.id = (el && el.dataset && el.dataset.id) || focus.id || (cand[0] && cand[0].id) || null;
  renderFocus();
};
function fmtT(s) { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60), r = s % 60; return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`; }
function renderFocus() {
  let w = $('.focus-wrap'); if (!w) { w = document.createElement('div'); w.className = 'focus-wrap'; document.body.appendChild(w); }
  const t = focus.id && Store.get('task', focus.id);
  const opts = Tasks.all().filter(isOpen).sort((a, b) => ((b.top && b.topDate === D.today()) - (a.top && a.topDate === D.today())) || PRANK[a.priority] - PRANK[b.priority]);
  w.innerHTML = `<button class="btn ghost" style="position:absolute;top:18px;right:18px" data-fx="exit">${I('x')} Exit focus</button>
  <div class="focus-card"><div class="eyebrow">Focus mode</div>
  ${t ? `<h1>${esc(t.title)}</h1>${t.desc ? `<p class="muted">${esc(t.desc)}</p>` : ''}` : `<h1>Pick one thing</h1>`}
  <select class="input" data-fx="pick" style="max-width:420px;margin:0 auto" aria-label="Choose task"><option value="">— choose a task —</option>${opts.map(o => `<option value="${o.id}" ${o.id === focus.id ? 'selected' : ''}>${esc(o.title)}</option>`).join('')}</select>
  <div class="seg" style="margin-top:22px">${[['timer', 'Timer'], ['stopwatch', 'Stopwatch']].map(([k, l]) => `<button class="${focus.mode === k ? 'on' : ''}" data-fx="mode" data-v="${k}">${l}</button>`).join('')}</div>
  <div class="timer" id="fx-time">${focus.mode === 'timer' ? fmtT(focus.left) : fmtT(focus.elapsed)}</div>
  ${focus.mode === 'timer' ? `<div class="row" style="justify-content:center;gap:6px;margin-bottom:14px">${[5, 15, 25, 45, 60].map(m => `<button class="btn sm ${focus.sec === m * 60 ? 'primary' : ''}" data-fx="len" data-v="${m}">${m}m</button>`).join('')}</div>` : ''}
  <div class="row" style="justify-content:center;gap:10px"><button class="btn terra" data-fx="go" style="height:48px;padding:0 26px">${focus.running ? I('pause') + ' Pause' : I('play') + ' Start'}</button><button class="btn" data-fx="reset" style="height:48px">${I('reset')} Reset</button></div>
  ${t && (t.subtasks || []).length ? `<div class="focus-steps"><div class="eyebrow" style="margin-bottom:6px">Steps</div>${t.subtasks.map(s => `<label class="item check"><input type="checkbox" class="cb" ${s.done ? 'checked' : ''} data-fx="sub" data-v="${s.id}"><span class="${s.done ? 'muted' : ''}" style="${s.done ? 'text-decoration:line-through' : ''}">${esc(s.t)}</span></label>`).join('')}</div>` : (t ? `<p class="small muted" style="margin:20px 0">No steps yet. <button class="btn sm" data-fx="bd">Break it down</button></p>` : '')}
  ${t ? `<div class="row" style="justify-content:center;gap:10px;margin-top:10px"><button class="btn primary" data-fx="done">${I('check')} Mark complete</button></div><p class="tiny muted" style="margin-top:14px">Time logged this session: ${mins(focus.logged)} · total on task: ${mins(t.actualMin)}</p>` : ''}</div>`;
  w.onclick = e => {
    const b = e.target.closest('[data-fx]'); if (!b) return; const a = b.dataset.fx;
    if (a === 'exit') { stopTimer(true); w.remove(); focus.logged = 0; return; }
    if (a === 'mode') { stopTimer(true); focus.mode = b.dataset.v; focus.elapsed = 0; focus.left = focus.sec; renderFocus(); }
    if (a === 'len') { stopTimer(false); focus.sec = focus.left = +b.dataset.v * 60; renderFocus(); }
    if (a === 'go') { focus.running ? stopTimer(true) : startTimer(); renderFocus(); }
    if (a === 'reset') { stopTimer(true); focus.left = focus.sec; focus.elapsed = 0; renderFocus(); }
    if (a === 'sub') { LOS.actions['toggle-sub']({dataset: {id: focus.id, sub: b.dataset.v}}); setTimeout(renderFocus, 30); }
    if (a === 'done') { stopTimer(true); const t2 = Store.get('task', focus.id); Tasks.setStatus(t2, 'Completed'); focus.id = null; setTimeout(renderFocus, 50); }
    if (a === 'bd') LOS.actions.breakdown({dataset: {id: focus.id}});
  };
  w.querySelector('[data-fx=pick]').onchange = e => { stopTimer(true); focus.id = e.target.value || null; renderFocus(); };
}
let lastTick = 0, accum = 0;
function startTimer() {
  focus.running = true; lastTick = Date.now(); accum = 0;
  focus.iv = setInterval(() => {
    const now = Date.now(), dt = (now - lastTick) / 1000; lastTick = now; accum += dt;
    if (focus.mode === 'timer') { focus.left -= dt; if (focus.left <= 0) { focus.left = 0; stopTimer(true); LOS.toast('Time’s up — take a breath ✿'); LOS.confetti(30); renderFocus(); } }
    else focus.elapsed += dt;
    const el = $('#fx-time'); if (el) el.textContent = fmtT(focus.mode === 'timer' ? focus.left : focus.elapsed);
  }, 250);
}
function stopTimer(log) {
  if (focus.iv) clearInterval(focus.iv); focus.iv = null; focus.running = false;
  const m = Math.round(accum / 60); accum = 0;
  if (log && m > 0 && focus.id) { const t = Store.get('task', focus.id); if (t) { Store.put('task', {...t, actualMin: num(t.actualMin) + m, status: t.status === 'To Do' || t.status === 'Not Started' ? 'In Progress' : t.status}); focus.logged += m; } }
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('.focus-wrap') && !$('.modal-wrap')) { stopTimer(true); $('.focus-wrap').remove(); } });

/* ---------- calendar aggregation ---------- */
LOS.calProviders.push((from, to) => Tasks.all().filter(t => t.due && D.inR(t.due, [from, to]) && t.status !== 'Cancelled').map(t => ({key: 'task:' + t.id, date: t.due, title: t.title, type: 'task', cls: 'task' + (isDone(t) ? ' done' : ''), label: 'Task', open: () => LOS.editTask(t.id)})));
LOS.calProviders.push((from, to) => Store.all('event').filter(e => D.inR(e.date, [from, to])).map(e => ({key: 'event:' + e.id, date: e.date, time: e.time, title: e.title, type: 'event', cls: 'event', label: e.type || 'Event', open: () => editEvent(e.id)})));
LOS.calendarItems = (from, to) => LOS.calProviders.flatMap(p => { try { return p(from, to); } catch (e) { console.warn(e); return []; } });
let calCache = {};
LOS.actions['cal-open'] = el => { const it = calCache[el.dataset.key] || LOS.calendarItems('0000-01-01', '9999-12-31').find(x => x.key === el.dataset.key); it && it.open && it.open(); };
const EVT_TYPES = ['Appointment', 'Important date', 'Deadline', 'Birthday', 'Social', 'Other'];
function editEvent(id, preset = {}) {
  const e = id ? Store.get('event', id) : null;
  LOS.openForm({title: e ? 'Edit event' : 'New event', fields: [{k: 'title', label: 'Title', required: true, full: true}, {k: 'date', label: 'Date', type: 'date', required: true}, {k: 'time', label: 'Time (optional)', type: 'time'}, {k: 'type', label: 'Type', type: 'select', options: EVT_TYPES}, {k: 'location', label: 'Where'}, {k: 'notes', label: 'Notes', type: 'textarea', rows: 2}],
    values: e || Object.assign({date: D.today(), type: 'Appointment'}, preset),
    onSave: d => { Store.put('event', Object.assign({}, e || {}, d)); }, onDelete: e ? () => Store.del('event', e.id) : null});
}
LOS.editEvent = editEvent;
LOS.actions['new-event'] = el => editEvent(null, {date: el.dataset.date || D.today(), type: el.dataset.type || 'Appointment'});
LOS.actions['cal-day'] = el => {
  const k = el.dataset.date; if (el.dataset.keyclick) return;
  const items = LOS.calendarItems(k, k);
  const m = LOS.modal({title: D.long(k), body: (items.length ? items.map(i => `<div class="item"><span class="chip ${i.cls}">${esc(i.time ? D.time(i.time) : i.label)}</span><span class="grow clickable" data-k="${esc(i.key)}">${esc(i.title)}</span>${/^(task|event):/.test(i.key) ? `<button class="icon-btn sm del" data-delk="${esc(i.key)}" aria-label="Delete">${I('trash')}</button>` : ''}</div>`).join('') : `<p class="muted small">Nothing here yet.</p>`),
    foot: `<button class="btn" data-ne>${I('cal')} Add event</button><button class="btn primary" data-nt>${I('plus')} Add task</button>`,
    onMount: w => {
      w.querySelectorAll('[data-k]').forEach(r => r.onclick = () => { const it = items.find(x => x.key === r.dataset.k); m.close(); it.open && it.open(); });
      w.querySelectorAll('[data-delk]').forEach(b => b.onclick = async () => { const [kind, id] = b.dataset.delk.split(':'); m.close(); await LOS.delWithConfirm(kind, id, kind === 'task' ? 'this task' : 'this event'); });
      w.querySelector('[data-nt]').onclick = () => { m.close(); LOS.editTask(null, {due: k}); };
      w.querySelector('[data-ne]').onclick = () => { m.close(); editEvent(null, {date: k}); };
    }});
};
LOS.monthGrid = (month, {mini = false, sm = false} = {}) => {
  const first = D.monthStart(month), start = D.weekStart(first), end = D.add(D.weekStart(D.monthEnd(month)), 6);
  const items = LOS.calendarItems(start, end); items.forEach(i => calCache[i.key] = i);
  const byDay = LOS.groupBy(items, i => i.date);
  const days = D.days(start, end);
  return `<div class="cal ${mini ? 'mini-cal' : ''}">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="dow">${mini ? d[0] : d}</div>`).join('')}${days.map(k => {
    const its = (byDay[k] || []).sort(by(i => i.time || 'z'));
    return `<div class="day ${k.slice(0, 7) !== month ? 'other' : ''} ${k === D.today() ? 'today' : ''}" data-action="${sm ? 'sticker-place' : 'cal-day'}" data-date="${k}" ${mini && its.length ? `data-tip="${esc(its.map(i => i.title).join(', '))}"` : ''}><span class="n">${D.parse(k).getDate()}</span>${mini ? '' : LOS.dayStickers(k, sm)}${mini ? (its.length ? `<div style="width:5px;height:5px;border-radius:50%;background:var(--terra);margin:0 auto"></div>` : '') : its.slice(0, 3).map(i => `<span class="ev ${i.cls}">${i.time ? esc(D.time(i.time)) + ' ' : ''}${esc(i.title)}</span>`).join('') + (its.length > 3 ? `<span class="tiny muted">+${its.length - 3} more</span>` : '')}</div>`;
  }).join('')}</div>`;
};


/* ---------- calendar stickers ---------- */
const STICKERS = {
  heart: '<path d="M16 27s-10-6.2-10-14a5.6 5.6 0 0 1 10-3.4A5.6 5.6 0 0 1 26 13c0 7.8-10 14-10 14z" fill="#E59AA8"/><path d="M11 10.5a3 3 0 0 1 3-1.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".8"/>',
  flower: '<g fill="#F2B8C0"><circle cx="16" cy="9" r="5"/><circle cx="23" cy="14" r="5"/><circle cx="20.5" cy="22" r="5"/><circle cx="11.5" cy="22" r="5"/><circle cx="9" cy="14" r="5"/></g><circle cx="16" cy="16" r="4" fill="#F2C94C"/>',
  star: '<path d="M16 4l3.6 7.4 8.1 1.2-5.9 5.7 1.4 8.1L16 22.6l-7.2 3.8 1.4-8.1-5.9-5.7 8.1-1.2z" fill="#F2C94C" stroke="#D9A82E" stroke-width="1" stroke-linejoin="round"/>',
  sun: '<circle cx="16" cy="16" r="6.5" fill="#F4B860"/><g stroke="#F4B860" stroke-width="2.2" stroke-linecap="round"><path d="M16 3v3M16 26v3M3 16h3M26 16h3M6.8 6.8l2.1 2.1M23.1 23.1l2.1 2.1M6.8 25.2l2.1-2.1M23.1 8.9l2.1-2.1"/></g>',
  moon: '<path d="M22 22.5A10 10 0 0 1 12.2 6a10 10 0 1 0 13.6 13.6A10 10 0 0 1 22 22.5z" fill="#B9A6D9"/><circle cx="24" cy="8" r="1.3" fill="#E0C068"/><circle cx="27" cy="13" r=".9" fill="#E0C068"/>',
  coffee: '<path d="M7 12h15v7a6 6 0 0 1-6 6h-3a6 6 0 0 1-6-6z" fill="#C9A98F"/><path d="M22 14h2a3 3 0 0 1 0 6h-2" stroke="#9C6B4E" stroke-width="2" fill="none"/><path d="M11 5c-1 2 1 3 0 5M16 5c-1 2 1 3 0 5" stroke="#B5A291" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
  cake: '<rect x="6" y="15" width="20" height="11" rx="2.5" fill="#F2C6CF"/><path d="M6 19c3 2 4.5-1 7 0s4 2 6.5 0 4.5 1 6.5 0" stroke="#fff" stroke-width="1.8" fill="none"/><rect x="15" y="8" width="2" height="7" rx="1" fill="#B9A6D9"/><path d="M16 4c1.5 1.6 1.5 3 0 3.6-1.5-.6-1.5-2 0-3.6z" fill="#F4B860"/>',
  plane: '<path d="M4 17l24-9-6 18-5-7-7 4 1-6z" fill="#9EC3E0"/><path d="M17 19l5-8" stroke="#fff" stroke-width="1.4"/>',
  book: '<path d="M5 8c4-1.5 7.5-1 11 1v17c-3.5-2-7-2.5-11-1z" fill="#A9C1A0"/><path d="M27 8c-4-1.5-7.5-1-11 1v17c3.5-2 7-2.5 11-1z" fill="#C7D7BF"/>',
  leaf: '<path d="M7 25C7 13 14 6 26 6c0 12-7 19-19 19z" fill="#8FB58A"/><path d="M7 25L20 12" stroke="#E8F0E4" stroke-width="1.6" stroke-linecap="round"/>',
  gift: '<rect x="6" y="13" width="20" height="13" rx="2" fill="#E8A68F"/><rect x="5" y="10" width="22" height="5" rx="1.5" fill="#F0BFAE"/><rect x="14.5" y="10" width="3" height="16" fill="#F2C94C"/><path d="M16 10c-3-5-8-3-5 0M16 10c3-5 8-3 5 0" stroke="#F2C94C" stroke-width="2" fill="none"/>',
  sparkle: '<path d="M14 4l2.2 6.8L23 13l-6.8 2.2L14 22l-2.2-6.8L5 13l6.8-2.2z" fill="#E0C068"/><path d="M24 19l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#F2B8C0"/>',
  dumbbell: '<rect x="3" y="12" width="4" height="8" rx="1.5" fill="#9C6B4E"/><rect x="25" y="12" width="4" height="8" rx="1.5" fill="#9C6B4E"/><rect x="7" y="10" width="4" height="12" rx="1.5" fill="#C98770"/><rect x="21" y="10" width="4" height="12" rx="1.5" fill="#C98770"/><rect x="11" y="15" width="10" height="2" fill="#B5A291"/>',
  music: '<path d="M12 22V8l13-3v14" stroke="#7B62C9" stroke-width="2" fill="none"/><circle cx="9.5" cy="22.5" r="3.5" fill="#B9A6D9"/><circle cx="22.5" cy="19.5" r="3.5" fill="#B9A6D9"/>',
  camera: '<rect x="4" y="10" width="24" height="16" rx="4" fill="#B5A291"/><path d="M11 10l2-3h6l2 3" fill="#9C8673"/><circle cx="16" cy="18" r="5" fill="#F1E8DF"/><circle cx="16" cy="18" r="2.6" fill="#6B6259"/>',
  home: '<path d="M5 15L16 6l11 9v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" fill="#E3D3C5"/><path d="M3.5 15.5L16 5.5l12.5 10" stroke="#9C6B4E" stroke-width="2" stroke-linecap="round" fill="none"/><rect x="13" y="19" width="6" height="8" rx="1" fill="#C98770"/>',
  check: '<circle cx="16" cy="16" r="12" fill="#A9C1A0"/><path d="M10.5 16.5l3.6 3.6 7.4-8" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  rainbow: '<path d="M4 24a12 12 0 0 1 24 0" stroke="#E59AA8" stroke-width="3.2" fill="none"/><path d="M8 24a8 8 0 0 1 16 0" stroke="#F4B860" stroke-width="3.2" fill="none"/><path d="M12 24a4 4 0 0 1 8 0" stroke="#9EC3E0" stroke-width="3.2" fill="none"/>',
  money: '<rect x="4" y="9" width="24" height="15" rx="3" fill="#A9C1A0"/><circle cx="16" cy="16.5" r="4" fill="#E8F0E4"/><path d="M16 14v5" stroke="#5E7F55" stroke-width="1.6" stroke-linecap="round"/>',
  party: '<path d="M6 27l5-15 10 10z" fill="#F4B860"/><circle cx="21" cy="8" r="1.6" fill="#E59AA8"/><circle cx="26" cy="13" r="1.4" fill="#9EC3E0"/><circle cx="24" cy="5" r="1.2" fill="#B9A6D9"/><path d="M15 9c1-3 4-4 5-2M22 16c3-1 5 1 4 3" stroke="#E59AA8" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
};
const STICKER_NAMES = {heart: 'Love', flower: 'Flower', star: 'Star', sun: 'Sunny', moon: 'Rest', coffee: 'Coffee', cake: 'Birthday', plane: 'Travel', book: 'Study', leaf: 'Fresh start', gift: 'Gift', sparkle: 'Sparkle', dumbbell: 'Workout', music: 'Music', camera: 'Memory', home: 'Home', check: 'Done', rainbow: 'Good day', money: 'Payday', party: 'Celebrate'};
LOS.stickerHtml = (code, size = 22) => {
  if (code.startsWith('b:')) { const k = code.slice(2); return STICKERS[k] ? `<svg viewBox="0 0 32 32" style="width:${size}px;height:${size}px;stroke:none" aria-label="${esc(STICKER_NAMES[k])}">${STICKERS[k]}</svg>` : ''; }
  const c = Store.get('sticker', code.slice(2)); return c ? `<img src="${esc(LOS.imgSrc(c.image))}" alt="${esc(c.name || 'sticker')}" style="width:${size}px;height:${size}px;object-fit:contain">` : '';
};
LOS.dayStickers = (k, sm) => { const d = Store.get('daysticker', k); const list = ((d && d.list) || []).filter(x => LOS.stickerHtml(x.s)); if (!list.length) return ''; return `<div class="stk-row">${list.slice(0, 4).map(x => `<span class="stk" ${sm ? `data-action="sticker-remove" data-date="${k}" data-sid="${x.id}" data-tip="Remove sticker"` : ''}>${LOS.stickerHtml(x.s)}</span>`).join('')}${list.length > 4 ? `<span class="tiny muted">+${list.length - 4}</span>` : ''}</div>`; };
LOS.stickerTray = () => {
  const sel = F().sticker || 'b:heart'; const custom = Store.all('sticker').sort(by(x => x.createdAt));
  return `<div class="card" style="margin-bottom:14px;padding:16px 18px"><div class="row wrap" style="margin-bottom:10px"><b class="grow" style="font-family:var(--serif)">Sticker tray</b><span class="tiny muted">Pick a sticker, then click days to place it · click a placed sticker to remove it</span></div>
  <div class="stk-tray">${Object.keys(STICKERS).map(k => `<button class="stk-pick ${sel === 'b:' + k ? 'on' : ''}" data-action="sticker-pick" data-s="b:${k}" data-tip="${esc(STICKER_NAMES[k])}">${LOS.stickerHtml('b:' + k, 28)}</button>`).join('')}
  ${custom.map(c => `<span class="stk-pick-wrap"><button class="stk-pick ${sel === 'c:' + c.id ? 'on' : ''}" data-action="sticker-pick" data-s="c:${c.id}" data-tip="${esc(c.name || 'My sticker')}">${LOS.stickerHtml('c:' + c.id, 28)}</button><button class="stk-del" data-action="del-rec" data-kind="sticker" data-id="${c.id}" data-label="this sticker" aria-label="Delete sticker">${I('x')}</button></span>`).join('')}
  <button class="stk-pick add" data-action="sticker-upload" data-tip="Upload your own (PNG with transparent background works best)">${I('plus')}</button></div></div>`;
};
LOS.actions['sticker-mode'] = () => { F().stickerMode = !F().stickerMode; LOS.render(); };
LOS.actions['sticker-pick'] = el => { F().sticker = el.dataset.s; LOS.render(); };
LOS.actions['sticker-place'] = el => {
  const k = el.dataset.date; const s = F().sticker || 'b:heart'; const d = Store.get('daysticker', k) || {id: k, list: []};
  if ((d.list || []).length >= 8) { LOS.toast('That day is full of stickers already ✿'); return; }
  Store.put('daysticker', {...d, list: [...(d.list || []), {id: uid(), s}]});
};
LOS.actions['sticker-remove'] = (el, e) => { e && e.stopPropagation(); const d = Store.get('daysticker', el.dataset.date); if (!d) return; const list = d.list.filter(x => x.id !== el.dataset.sid); list.length ? Store.put('daysticker', {...d, list}) : Store.del('daysticker', d.id); };
LOS.actions['sticker-upload'] = async () => {
  const files = (await LOS.pickImages(true)).filter(LOS.validImage); if (!files.length) return;
  for (const f of files) { try { const ref = await LOS.saveImage(f, 320, true); const n = Store.put('sticker', {image: ref, name: f.name.replace(/\.[^.]+$/, '')}); F().sticker = 'c:' + n.id; } catch (e) { LOS.toast(e.message); } }
  LOS.toast('Sticker added to your tray ✿');
};

/* ---------- drag & drop helper (pointer + HTML5) ---------- */
LOS.dnd = (root, {item, zone, onDrop}) => {
  let dragId = null;
  root.querySelectorAll(item).forEach(c => {
    c.draggable = true;
    c.addEventListener('dragstart', e => { dragId = c.dataset.drag; c.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; } catch (er) {} });
    c.addEventListener('dragend', () => { c.classList.remove('dragging'); root.querySelectorAll('.over').forEach(z => z.classList.remove('over')); });
  });
  root.querySelectorAll(zone).forEach(z => {
    z.addEventListener('dragover', e => { e.preventDefault(); z.classList.add('over'); });
    z.addEventListener('dragleave', e => { if (!z.contains(e.relatedTarget)) z.classList.remove('over'); });
    z.addEventListener('drop', e => { e.preventDefault(); z.classList.remove('over'); const id = dragId || e.dataTransfer.getData('text/plain'); if (id) onDrop(id, z); dragId = null; });
  });
};

/* ---------- Planner page ---------- */
const F = () => LOS.state.filters;
function filtered() {
  const f = F(); const t = D.today(); const q = (f.pq || '').toLowerCase();
  return Tasks.all().filter(x => {
    if (f.pcat && x.category !== f.pcat) return false;
    if (f.pprio && x.priority !== f.pprio) return false;
    if (f.pstatus && x.status !== f.pstatus) return false;
    if (f.pproj && x.project !== f.pproj) return false;
    const comp = f.pcomp || 'all';
    if (comp === 'open' && !isOpen(x)) return false;
    if (comp === 'done' && !isDone(x)) return false;
    const dr = f.pdate || 'any';
    if (dr === 'today' && x.due !== t) return false;
    if (dr === 'week' && !D.inR(x.due, D.range('week'))) return false;
    if (dr === 'month' && !D.inR(x.due, D.range('month'))) return false;
    if (dr === 'overdue' && !isOverdue(x)) return false;
    if (dr === 'nodate' && x.due) return false;
    if (q && !LOS.match(q, x.title, x.desc, x.notes, (x.tags || []).join(' '))) return false;
    return true;
  });
}
function filterBar() {
  const f = F(); const sel = (k, label, opts) => `<select class="input" data-change="pf" data-k="${k}" aria-label="${label}"><option value="">${label}</option>${opts.map(o => `<option ${f[k] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  const active = ['pcat', 'pprio', 'pstatus', 'pproj', 'pq'].some(k => f[k]) || (f.pdate && f.pdate !== 'any') || (f.pcomp && f.pcomp !== 'all');
  return `<div class="toolbar"><input class="input" type="search" placeholder="Filter…" value="${esc(f.pq || '')}" data-input="pfq" aria-label="Filter tasks" style="width:150px">
  <select class="input" data-change="pf" data-k="pdate" aria-label="Date"><option value="any">Any date</option>${[['today', 'Due today'], ['week', 'This week'], ['month', 'This month'], ['overdue', 'Carried over'], ['nodate', 'No date']].map(([v, l]) => `<option value="${v}" ${f.pdate === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
  ${sel('pcat', 'Category', Tasks.cats())}${sel('pprio', 'Priority', PRIOS)}${sel('pstatus', 'Status', STATUSES)}${Tasks.projects().length ? sel('pproj', 'Project', Tasks.projects()) : ''}
  <select class="input" data-change="pf" data-k="pcomp" aria-label="Completion">${[['all', 'All tasks'], ['open', 'Open only'], ['done', 'Completed only']].map(([v, l]) => `<option value="${v}" ${(f.pcomp || 'all') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
  ${active ? `<button class="btn sm ghost" data-action="pf-clear">Clear</button>` : ''}<span class="spacer"></span><button class="btn primary sm" data-action="new-task">${I('plus')} Task</button></div>`;
}
LOS.actions.pf = el => { F()[el.dataset.k] = el.value; LOS.render(); };
LOS.actions.pfq = LOS.debounce(el => { F().pq = el.value; LOS.render(true); setTimeout(() => { const i = $('[data-input=pfq]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 0); }, 250);
LOS.actions['pf-clear'] = () => { ['pcat', 'pprio', 'pstatus', 'pproj', 'pq', 'pdate', 'pcomp'].forEach(k => delete F()[k]); LOS.render(); };

const VIEWS = [['board', 'Board'], ['list', 'List'], ['table', 'Table'], ['calendar', 'Calendar'], ['timeline', 'Timeline'], ['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly'], ['year', 'Yearly']];
LOS.register('planner', {title: 'My Planner', icon: 'kanban',
  render() {
    const v = LOS.tab('planner', 'board');
    const all = Tasks.all(); const open = all.filter(isOpen).length;
    const head = LOS.hero('planner', {title: 'My Planner', script: 'plan your life, beautifully', tone: 'lav', sub: `${plural(open, 'open task')} · ${all.filter(isDone).length} completed`, actions: `<button class="btn primary" data-action="new-task">${I('plus')} New task</button>`});
    const views = {board, list, table, calendar, timeline, day: dayPlan, week: weekPlan, month: monthPlan, year: yearPlan};
    const needsFilter = ['board', 'list', 'table', 'timeline'].includes(v);
    return head + LOS.tabsHtml('planner', VIEWS, v) + (needsFilter ? filterBar() : '') + views[v]();
  },
  mount(el) {
    const v = LOS.tab('planner', 'board');
    if (v === 'board') LOS.dnd(el, {item: '.kcard', zone: '.kcol', onDrop: (id, z) => { const t = Store.get('task', id); if (t && t.status !== z.dataset.status) Tasks.setStatus(t, z.dataset.status); }});
    if (v === 'week') LOS.dnd(el, {item: '.kcard', zone: '.kcol', onDrop: (id, z) => { const t = Store.get('task', id); if (t && t.due !== z.dataset.date) Tasks.reschedule(t, z.dataset.date); }});
  }
});
function kcard(t) {
  return `<div class="kcard" data-drag="${t.id}"><div class="t clickable" data-action="edit-task" data-id="${t.id}">${esc(t.title)}</div><div class="meta">${prioChip(t.priority)}${dueChip(t)}${t.estMin ? `<span>${mins(t.estMin)}</span>` : ''}${subProg(t)}</div>
  ${(t.subtasks || []).length ? LOS.bar(pct(t.subtasks.filter(s => s.done).length, t.subtasks.length), '', '') : ''}
  <div class="mini"><select data-change="task-status" data-id="${t.id}" aria-label="Status" style="margin:0">${STATUSES.map(s => `<option ${s === t.status ? 'selected' : ''}>${s}</option>`).join('')}</select>${LOS.delBtn('task', t.id, 'this task')}</div></div>`;
}
function board() {
  const list = filtered(); const cancelled = list.filter(t => t.status === 'Cancelled');
  return `<div class="kanban">${COLS.map(([name, status, col]) => {
    const cards = list.filter(t => t.status === status).sort((a, b) => PRANK[a.priority] - PRANK[b.priority] || ((a.due || '9') < (b.due || '9') ? -1 : 1));
    const shown = status === 'Completed' ? cards.sort(by(t => t.completedAt || '', -1)).slice(0, 30) : cards;
    return `<div class="kcol" data-status="${status}"><div class="kcol-h"><span class="sw" style="background:${col}"></span>${name}<span class="n">${cards.length}</span><span class="grow"></span><button class="icon-btn sm" data-action="new-task" data-status="${status}" aria-label="Add to ${name}">${I('plus')}</button></div><div class="kcards">${shown.map(kcard).join('') || `<div class="tiny muted" style="text-align:center;padding:16px 4px">Drop tasks here</div>`}</div></div>`;
  }).join('')}</div>${cancelled.length ? `<p class="small muted">${plural(cancelled.length, 'cancelled task')} hidden from the board — see List view.</p>` : ''}<p class="tiny muted">Drag cards between columns, or use the status menu on each card.</p>`;
}
function list() {
  const l = filtered();
  if (!l.length) return `<div class="card">${LOS.empty(Tasks.all().length ? 'No tasks match these filters' : 'No tasks yet', Tasks.all().length ? '' : 'Add your first task — even “drink water” counts.', `<button class="btn primary sm" data-action="new-task">${I('plus')} Add task</button>`)}</div>`;
  const groups = [['Carried over', l.filter(isOverdue)], ['Today', l.filter(t => isOpen(t) && t.due === D.today())], ['Upcoming', l.filter(t => isOpen(t) && t.due > D.today()).sort(by(t => t.due))], ['No date', l.filter(t => isOpen(t) && !t.due)], ['Completed', l.filter(isDone).sort(by(t => t.completedAt || '', -1))], ['Cancelled', l.filter(t => t.status === 'Cancelled')]];
  return groups.filter(g => g[1].length).map(([n, items]) => `<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>${n}</h3><span class="chip">${items.length}</span></div>${items.map(t => LOS.taskRow(t)).join('')}</div>`).join('');
}
function table() {
  const l = filtered(); const f = F(); const key = f.psort || 'due', dir = f.pdir === 'desc' ? -1 : 1;
  const cols = [['title', 'Task'], ['status', 'Status'], ['priority', 'Priority'], ['category', 'Category'], ['project', 'Project'], ['start', 'Start'], ['due', 'Due'], ['estMin', 'Est.'], ['actualMin', 'Actual'], ['completedAt', 'Completed']];
  const val = (t, k) => k === 'priority' ? PRANK[t.priority] : (t[k] ?? '');
  l.sort((a, b) => { const x = val(a, key), y = val(b, key); return (x === '' ? 1 : y === '' ? -1 : x > y ? 1 : x < y ? -1 : 0) * (x === '' || y === '' ? 1 : dir); });
  if (!l.length) return `<div class="card">${LOS.empty('Nothing to show', 'Try clearing filters.')}</div>`;
  return `<div class="toolbar"><span class="small muted">${plural(l.length, 'task')} · est. ${mins(sum(l, t => t.estMin))} · logged ${mins(sum(l, t => t.actualMin))}</span><span class="spacer"></span><button class="btn sm" data-action="export-tasks">${I('download')} Export CSV</button></div>
  <div class="table-wrap" style="max-height:70vh"><table class="tbl"><thead><tr>${cols.map(([k, l2]) => `<th data-action="psort" data-k="${k}">${l2}${key === k ? (dir > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('')}</tr></thead><tbody>${l.map(t => `<tr class="clickable" data-action="edit-task" data-id="${t.id}"><td class="wrap"><b style="font-weight:500">${esc(t.title)}</b></td><td>${esc(t.status)}</td><td>${prioChip(t.priority)}</td><td>${esc(t.category)}</td><td>${esc(t.project)}</td><td>${t.start ? D.fmt(t.start) : ''}</td><td>${t.due ? D.fmt(t.due) : ''}</td><td class="num">${t.estMin ? mins(t.estMin) : ''}</td><td class="num">${t.actualMin ? mins(t.actualMin) : ''}</td><td>${t.completedAt ? D.fmt(t.completedAt) : ''}</td></tr>`).join('')}</tbody></table></div>`;
}
LOS.actions.psort = el => { const f = F(); if (f.psort === el.dataset.k) f.pdir = f.pdir === 'desc' ? 'asc' : 'desc'; else { f.psort = el.dataset.k; f.pdir = 'asc'; } LOS.render(); };
LOS.actions['export-tasks'] = () => LOS.exportFile('tasks.csv', LOS.toCSV(Tasks.all(), [['Title', 'title'], ['Status', 'status'], ['Priority', 'priority'], ['Category', 'category'], ['Project', 'project'], ['Start', 'start'], ['Due', 'due'], ['Est min', 'estMin'], ['Actual min', 'actualMin'], ['Completed', 'completedAt'], ['Tags', 'tags'], ['Repeat', 'recur'], ['Notes', 'notes']]), 'text/csv');

function calendar() {
  const m = F().pmonth || D.month();
  return `<div class="toolbar">${LOS.monthPicker('pmonth', m)}<span class="spacer"></span><button class="btn sm ${F().stickerMode ? 'terra' : ''}" data-action="sticker-mode">${I('sparkle')} ${F().stickerMode ? 'Done with stickers' : 'Stickers'}</button><div class="legend" style="margin:0">${[['task', '#8E7AB5', 'Tasks'], ['event', '#C98770', 'Events'], ['bill', '#C9A04A', 'Bills'], ['job', '#C46A7E', 'Career'], ['study', '#7E9A72', 'Study']].map(([k, c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div><button class="btn sm" data-action="new-event">${I('plus')} Event</button></div>${F().stickerMode ? LOS.stickerTray() : ''}${LOS.monthGrid(m, {sm: !!F().stickerMode})}<p class="tiny muted">Click any day to see everything and add tasks or events.</p>`;
}
LOS.actions.pmonth = el => { const d = +el.dataset.d; F().pmonth = d ? D.monthAdd(F().pmonth || D.month(), d) : D.month(); LOS.render(); };
function timeline() {
  const l = filtered().filter(t => t.due || t.start).filter(t => t.status !== 'Cancelled');
  const from = F().ptl || D.add(D.weekStart(), -7); const n = 35; const to = D.add(from, n - 1);
  const inView = l.filter(t => (t.start || t.due) <= to && (t.due || t.start) >= from).sort(by(t => t.start || t.due));
  const days = D.days(from, to); const tmpl = `200px repeat(${n}, minmax(26px,1fr))`;
  const colFor = st => ({'Completed': '#3F8F3F', 'In Progress': '#7B62C9', 'On Hold': '#D9638F', 'To Do': '#E0A21A', 'Not Started': '#9A8C80'}[st] || '#C98770');
  return `<div class="toolbar"><button class="icon-btn" data-action="ptl" data-d="-14" aria-label="Earlier">${I('left')}</button><b>${D.fmt(from)} – ${D.fmt(to)}</b><button class="icon-btn" data-action="ptl" data-d="14" aria-label="Later">${I('right')}</button><button class="btn sm" data-action="ptl" data-d="0">Today</button></div>
  ${inView.length ? `<div class="timeline"><div class="tl-head" style="grid-template-columns:${tmpl};min-width:${200 + n * 26}px"><div style="background:var(--cream)"></div>${days.map(k => `<div class="${k === D.today() ? 'today' : ''}">${D.parse(k).getDate()}<br>${D.dow(k, 'narrow')}</div>`).join('')}</div>
  ${inView.map(t => { const s = t.start && t.start >= from ? t.start : (t.start ? from : t.due); const e = t.due && t.due <= to ? t.due : (t.due ? to : s); const c0 = D.diff(from, s < from ? from : s) + 2, c1 = D.diff(from, e) + 3; return `<div class="tl-row" style="grid-template-columns:${tmpl};min-width:${200 + n * 26}px"><div class="lab">${esc(t.title)}</div><div class="tl-bar" style="grid-column:${c0}/${Math.max(c1, c0 + 1)};grid-row:1;background:${colFor(t.status)}" data-action="edit-task" data-id="${t.id}" data-tip="<b>${esc(t.title)}</b><br>${esc(t.status)} · ${t.start ? esc(D.fmt(t.start)) + ' → ' : ''}${esc(D.fmt(t.due || t.start))}">${esc(t.title)}</div></div>`; }).join('')}</div>` : `<div class="card">${LOS.empty('Nothing on the timeline in this window', 'Tasks with start or due dates show up here as bars.')}</div>`}`;
}
LOS.actions.ptl = el => { const d = +el.dataset.d; F().ptl = d ? D.add(F().ptl || D.add(D.weekStart(), -7), d) : D.add(D.weekStart(), -7); LOS.render(); };

function dayPlan() {
  const k = F().pday || D.today(); const day = Store.get('day', k) || {};
  const tasks = Tasks.all().filter(t => t.due === k && t.status !== 'Cancelled').sort((a, b) => isDone(a) - isDone(b) || PRANK[a.priority] - PRANK[b.priority]);
  const items = LOS.calendarItems(k, k).filter(x => x.type !== 'task');
  const blocks = (day.blocks || []).slice().sort(by(b => b.start));
  const hours = Array.from({length: 17}, (_, i) => i + 6);
  return `<div class="toolbar"><button class="icon-btn" data-action="pday" data-d="-1" aria-label="Previous day">${I('left')}</button><h3 style="min-width:260px;text-align:center">${D.long(k)}</h3><button class="icon-btn" data-action="pday" data-d="1" aria-label="Next day">${I('right')}</button><button class="btn sm" data-action="pday" data-d="0">Today</button><input type="date" class="input" value="${k}" data-change="period-date" data-key="pday" aria-label="Jump to date"></div>
  <div class="grid g3"><div class="card"><div class="card-h"><h3>Time blocks</h3><button class="btn sm" data-action="add-block" data-date="${k}">${I('plus')} Block</button></div>
    <div style="position:relative">${hours.map(h => { const hh = String(h).padStart(2, '0'); const bs = blocks.filter(b => b.start.slice(0, 2) === hh); const ev = items.filter(i => i.time && i.time.slice(0, 2) === hh); return `<div class="row top" style="border-top:1px solid var(--line);min-height:38px;padding:4px 0"><span class="tiny muted" style="width:52px">${D.time(hh + ':00')}</span><div class="grow stack" style="gap:4px">${bs.map(b => `<div class="chip lav" style="height:auto;padding:4px 10px;justify-content:space-between">${esc(b.label)} · ${esc(D.time(b.start))}${b.end ? '–' + esc(D.time(b.end)) : ''}<button class="icon-btn sm" style="width:20px;height:20px" data-action="del-block" data-date="${k}" data-id="${b.id}" aria-label="Remove">${I('x')}</button></div>`).join('')}${ev.map(i => `<div class="chip peach clickable" data-action="cal-open" data-key="${esc(i.key)}">${esc(i.title)}</div>`).join('')}</div></div>`; }).join('')}</div></div>
  <div class="card"><div class="card-h"><h3>Tasks</h3><button class="btn sm" data-action="new-task" data-due="${k}">${I('plus')}</button></div>${k === D.today() ? `<div class="eyebrow" style="margin:4px 0 8px">Priorities</div>${Tasks.priorities().map(LOS.prioCard).join('') || '<p class="small muted">No priorities pinned — use ★ on a task.</p>'}<div class="divider"></div>` : ''}${tasks.map(t => LOS.taskRow(t)).join('') || LOS.empty('Nothing due', '')}
    <div class="divider"></div><div class="card-h"><h4 style="flex:1">Appointments</h4><button class="btn sm ghost" data-action="new-event" data-date="${k}">${I('plus')}</button></div>${items.map(i => `<div class="item clickable" data-action="cal-open" data-key="${esc(i.key)}"><span class="chip ${i.cls}">${i.time ? esc(D.time(i.time)) : esc(i.label)}</span><span class="grow">${esc(i.title)}</span></div>`).join('') || '<p class="small muted">None</p>'}</div>
  <div class="card"><div class="card-h"><h3>Notes</h3></div>${dayNotes(k, day).replace('class="grid g2"', 'class="stack"')}</div></div>`;
}
LOS.actions.pday = el => { const d = +el.dataset.d; F().pday = d ? D.add(F().pday || D.today(), d) : D.today(); LOS.render(); };

function weekPlan() {
  const ws = F().pweek || D.weekStart(); const we = D.add(ws, 6);
  const wk = Store.get('week', ws) || {};
  const tasks = Tasks.all().filter(t => D.inR(t.due, [ws, we]) && t.status !== 'Cancelled');
  const done = tasks.filter(isDone).length;
  const unfinished = Tasks.all().filter(t => isOpen(t) && t.due && t.due < (ws > D.today() ? ws : D.today()) && t.due >= D.add(ws, -7) && t.due <= we);
  const objs = wk.objectives || [];
  return `<div class="toolbar"><button class="icon-btn" data-action="pweek" data-d="-7" aria-label="Previous week">${I('left')}</button><h3 style="min-width:240px;text-align:center">${D.fmt(ws)} – ${D.fmt(we)}</h3><button class="icon-btn" data-action="pweek" data-d="7" aria-label="Next week">${I('right')}</button><button class="btn sm" data-action="pweek" data-d="0">This week</button><input type="date" class="input" value="${ws}" data-change="period-date" data-key="pweek" data-week="1" aria-label="Jump to week"><span class="spacer"></span><button class="btn sm terra" data-action="weekly-reset" data-week="${ws}">${I('refresh')} Weekly reset & review</button></div>
  <div class="grid g3" style="margin-bottom:18px"><div class="card tint-lav span2"><div class="card-h"><h3>Weekly objectives</h3><button class="btn sm" data-action="edit-list" data-kind="week" data-id="${ws}" data-f="objectives" data-title="Weekly objectives">${I('edit')} Edit</button></div>${objs.length ? objs.map(o => `<label class="item check"><input type="checkbox" class="cb" ${o.done ? 'checked' : ''} data-change="toggle-list" data-kind="week" data-id="${ws}" data-f="objectives" data-item="${o.id}"><span class="${o.done ? 'muted' : ''}">${esc(o.t)}</span></label>`).join('') : '<p class="small muted">What would make this week a good one? Add 1–3 objectives.</p>'}</div>
  <div class="card" style="text-align:center">${C.ring(pct(done, tasks.length), {sub: `${done}/${tasks.length} tasks`})}<div class="small muted" style="margin-top:8px">Weekly progress</div>${unfinished.length ? `<button class="btn sm" style="margin-top:10px" data-action="rollover" data-before="${ws > D.today() ? ws : D.today()}" data-to="${ws > D.today() ? ws : D.today()}">Roll over ${plural(unfinished.length, 'unfinished task')}</button>` : ''}</div></div>
  <div class="kanban" style="grid-auto-columns:minmax(170px,1fr)">${D.days(ws, we).map(k => { const its = tasks.filter(t => t.due === k).sort((a, b) => isDone(a) - isDone(b) || PRANK[a.priority] - PRANK[b.priority]); return `<div class="kcol" data-date="${k}" style="${k === D.today() ? 'box-shadow:inset 0 0 0 2px var(--terra)' : ''}"><div class="kcol-h">${D.dow(k)} <span class="muted" style="font-weight:400">${D.parse(k).getDate()}</span><span class="n">${its.length}</span><span class="grow"></span><button class="icon-btn sm" data-action="new-task" data-due="${k}" aria-label="Add task">${I('plus')}</button></div><div class="kcards">${its.map(t => `<div class="kcard" data-drag="${t.id}" style="padding:9px"><label class="row" style="gap:8px;align-items:flex-start"><input type="checkbox" class="cb round" ${isDone(t) ? 'checked' : ''} data-action="toggle-task" data-id="${t.id}"><span class="small clickable ${isDone(t) ? 'muted' : ''}" style="${isDone(t) ? 'text-decoration:line-through' : ''}" data-action="edit-task" data-id="${t.id}">${esc(t.title)}</span></label></div>`).join('')}</div></div>`; }).join('')}</div><p class="tiny muted">Drag tasks between days to reschedule (original dates are kept).</p>`;
}
LOS.actions.pweek = el => { const d = +el.dataset.d; F().pweek = d ? D.add(F().pweek || D.weekStart(), d) : D.weekStart(); LOS.render(); };
LOS.actions['edit-list'] = el => {
  const {kind, id, f, title} = el.dataset; const doc = Store.get(kind, id) || {id};
  LOS.openForm({title, fields: [{k: f, label: title, type: 'list', addLabel: 'Add'}], values: doc, onSave: d => Store.put(kind, {...doc, [f]: d[f]})});
};
LOS.actions['toggle-list'] = el => {
  const {kind, id, f, item} = el.dataset; const doc = Store.get(kind, id); if (!doc) return;
  Store.put(kind, {...doc, [f]: (doc[f] || []).map(o => o.id === item ? {...o, done: el.checked, doneAt: el.checked ? D.today() : null} : o)});
  if (el.checked) LOS.cheer();
};
LOS.actions['weekly-reset'] = el => {
  const ws = el.dataset.week; const wk = Store.get('week', ws) || {id: ws};
  const tasks = Tasks.all().filter(t => D.inR(t.completedAt, [ws, D.add(ws, 6)]));
  const open = Tasks.all().filter(isOverdue);
  const steps = ['Clear your inbox / brain-dump loose ends', 'Review last week’s wins', 'Check upcoming bills & deadlines', 'Move or drop carried-over tasks', 'Pick 1–3 objectives for next week', 'Tidy your space for 10 minutes'];
  const done = wk.resetDone || [];
  LOS.openForm({title: 'Weekly reset & review', size: 'wide', saveLabel: 'Save review',
    fields: [{section: `This week you completed ${plural(tasks.length, 'task')}. ${open.length ? plural(open.length, 'task') + ' are carried over — you can roll them over from the planner.' : 'Nothing is carried over.'}`},
      {k: 'wins', label: 'Wins & good moments', type: 'textarea', full: true}, {k: 'lessons', label: 'What did I learn? What felt hard?', type: 'textarea', full: true}, {k: 'nextFocus', label: 'Focus for next week', type: 'textarea', full: true},
      ...steps.map((s, i) => ({k: 'r' + i, label: '', type: 'check', text: s}))],
    values: Object.assign({}, wk, Object.fromEntries(steps.map((s, i) => ['r' + i, done.includes(i)]))),
    onSave: d => { const resetDone = steps.map((_, i) => d['r' + i] ? i : -1).filter(i => i >= 0); Store.put('week', {...wk, wins: d.wins, lessons: d.lessons, nextFocus: d.nextFocus, resetDone, reviewedAt: D.today()}); if (resetDone.length === steps.length) LOS.confetti(70); LOS.toast('Review saved ✿'); }});
};
function monthPlan() {
  const m = F().pmonth || D.month(); const mo = Store.get('month', m) || {};
  const range = [D.monthStart(m), D.monthEnd(m)];
  const tasks = Tasks.all().filter(t => D.inR(t.due, range) && t.status !== 'Cancelled');
  const done = tasks.filter(isDone).length;
  const dates = LOS.calendarItems(...range).filter(i => i.type !== 'task').sort(by(i => i.date));
  const goals = mo.goals || [];
  return `<div class="toolbar">${LOS.monthPicker('pmonth', m)}</div>
  <div class="grid g3"><div class="stack" style="gap:18px"><div class="card tint-butter"><div class="card-h"><h3>This month’s focus</h3><button class="btn sm" data-action="edit-list" data-kind="month" data-id="${m}" data-f="goals" data-title="Monthly goals">${I('edit')}</button></div>${goals.length ? goals.map(o => `<label class="item check"><input type="checkbox" class="cb" ${o.done ? 'checked' : ''} data-change="toggle-list" data-kind="month" data-id="${m}" data-f="goals" data-item="${o.id}"><span>${esc(o.t)}</span></label>`).join('') : '<p class="small muted">Add a few monthly goals.</p>'}</div>
  <div class="card"><div class="card-h"><h3>Progress</h3></div><div class="stats flat"><div class="stat"><span class="v">${done}/${tasks.length}</span><span class="l">tasks done</span></div><div class="stat"><span class="v">${pct(goals.filter(g => g.done).length, goals.length)}%</span><span class="l">goals done</span></div></div><div style="margin-top:12px">${LOS.bar(pct(done, tasks.length))}</div></div>
  <div class="card"><div class="card-h"><h3>Important dates & deadlines</h3><button class="btn sm ghost" data-action="new-event" data-date="${D.monthStart(m)}" data-type="Important date">${I('plus')}</button></div>${dates.length ? dates.slice(0, 14).map(i => `<div class="item clickable" data-action="cal-open" data-key="${esc(i.key)}"><span class="chip ${i.cls}">${D.fmt(i.date)}</span><span class="grow small">${esc(i.title)}</span></div>`).join('') : '<p class="small muted">No dates yet.</p>'}</div></div>
  <div class="span2">${LOS.monthGrid(m)}</div></div>`;
}
function yearPlan() {
  const y = F().pyear || D.today().slice(0, 4); const yr = Store.get('year', y) || {};
  const objs = yr.objectives || [];
  const done = Tasks.all().filter(t => t.completedAt && t.completedAt.startsWith(y));
  const months = Array.from({length: 12}, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`);
  const goals = Store.all('goal').filter(g => (g.target || '').startsWith(y) || (g.start || '').startsWith(y));
  const dates = Store.all('event').filter(e => e.date.startsWith(y) && ['Important date', 'Birthday', 'Deadline'].includes(e.type)).sort(by(e => e.date));
  return `<div class="toolbar"><button class="icon-btn" data-action="pyear" data-d="-1" aria-label="Previous year">${I('left')}</button>${LOS.yearSelect('pyear', y)}<button class="icon-btn" data-action="pyear" data-d="1" aria-label="Next year">${I('right')}</button>${y !== D.today().slice(0, 4) ? `<button class="btn sm" data-action="period-year" data-key="pyear" value="${D.today().slice(0, 4)}">This year</button>` : ''}<span class="spacer"></span><span class="tiny muted">Every year keeps its own objectives and history — pick any year to look back.</span></div>
  <div class="grid g2"><div class="card tint-peach"><div class="card-h"><h3>Annual objectives</h3><button class="btn sm" data-action="edit-list" data-kind="year" data-id="${y}" data-f="objectives" data-title="Annual objectives">${I('edit')}</button></div>${objs.length ? objs.map(o => `<label class="item check"><input type="checkbox" class="cb" ${o.done ? 'checked' : ''} data-change="toggle-list" data-kind="year" data-id="${y}" data-f="objectives" data-item="${o.id}"><span>${esc(o.t)}</span></label>`).join('') + `<div style="margin-top:10px">${LOS.bar(pct(objs.filter(o => o.done).length, objs.length), 'terra')}</div>` : '<p class="small muted">“Your whole life can change in one year.” What do you want this one to hold?</p>'}</div>
  <div class="card"><div class="card-h"><h3>Major milestones</h3><button class="btn sm ghost" data-route="goals">Goals</button></div>${goals.length ? goals.map(g => `<div style="margin-bottom:12px"><div class="row between small"><span>${esc(g.title)}</span><b>${LOS.goalProgress(g)}%</b></div>${LOS.bar(LOS.goalProgress(g), 'lav')}</div>`).join('') : '<p class="small muted">Goals with a target date this year appear here.</p>'}</div>
  <div class="card"><div class="card-h"><h3>Tasks completed by month</h3></div>${C.bar({labels: months.map(m => D.mname(m, {month: 'short'})), series: [{name: 'Completed', values: months.map(m => done.filter(t => t.completedAt.startsWith(m)).length), color: '#3F8F3F'}], emptyMsg: 'Complete tasks to see your year take shape.'})}</div>
  <div class="card"><div class="card-h"><h3>Important dates</h3><button class="btn sm ghost" data-action="new-event" data-type="Important date" data-date="${D.today()}">${I('plus')}</button></div>${dates.length ? dates.map(e => `<div class="item clickable" data-action="cal-open" data-key="event:${e.id}"><span class="chip peach">${D.fmt(e.date)}</span><span class="grow small">${esc(e.title)}</span><span class="tiny muted">${esc(e.type)}</span>${LOS.delBtn('event', e.id, 'this date')}</div>`).join('') : '<p class="small muted">Birthdays, anniversaries, exam dates…</p>'}</div>
  <div class="card spanall"><div class="card-h"><h3>Year at a glance</h3></div><div class="grid g4" style="gap:14px">${months.map(m => `<div><div class="small" style="font-weight:600;margin-bottom:4px">${D.mname(m, {month: 'long'})}</div>${LOS.monthGrid(m, {mini: true})}</div>`).join('')}</div></div></div>`;
}
LOS.actions.pyear = el => { F().pyear = String(+(F().pyear || D.today().slice(0, 4)) + +el.dataset.d); LOS.render(); };

/* quick add, search, notifications */
LOS.quick.push({label: 'Detailed task', icon: 'check', open: () => LOS.editTask()});
LOS.quick.push({label: 'Event / appointment', icon: 'cal', open: () => editEvent()});
LOS.searchProviders.push(q => Tasks.all().filter(t => LOS.match(q, t.title, t.desc, t.notes, t.project, (t.tags || []).join(' '))).map(t => ({icon: 'check', title: t.title, sub: `Task · ${t.status}${t.due ? ' · ' + D.rel(t.due) : ''}`, open: () => LOS.editTask(t.id)})));
LOS.searchProviders.push(q => Store.all('event').filter(e => LOS.match(q, e.title, e.notes)).map(e => ({icon: 'cal', title: e.title, sub: 'Event · ' + D.fmt(e.date), open: () => editEvent(e.id)})));
LOS.notifProviders.push(() => {
  const out = []; const t = D.today(); const all = Tasks.all();
  const over = all.filter(isOverdue);
  if (over.length) out.push({key: 'tasks-over-' + t, cat: 'tasks', icon: 'refresh', tone: 'butter', title: `${plural(over.length, 'task')} carried over`, body: 'No guilt — pick what still matters and reschedule the rest.', route: 'today'});
  const dueToday = all.filter(x => isOpen(x) && x.due === t && ['Critical', 'High'].includes(x.priority));
  dueToday.forEach(x => out.push({key: 'task-due-' + x.id + t, cat: 'tasks', icon: 'flag', tone: 'peach', title: 'Due today: ' + x.title, body: x.priority + ' priority', open: () => LOS.editTask(x.id)}));
  const now = new Date(); const nowStr = D.key(now) + 'T' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  all.filter(x => isOpen(x) && x.reminder && x.reminder <= nowStr && x.reminder >= D.add(t, -3)).forEach(x => out.push({key: 'rem-' + x.id + x.reminder, cat: 'tasks', icon: 'bell', tone: 'lav', title: 'Reminder: ' + x.title, body: 'Set for ' + new Date(x.reminder).toLocaleString(undefined, {weekday: 'short', hour: 'numeric', minute: '2-digit'}), open: () => LOS.editTask(x.id)}));
  Store.all('event').filter(e => e.date === t || e.date === D.add(t, 1)).forEach(e => out.push({key: 'evt-' + e.id + e.date, cat: 'tasks', icon: 'cal', tone: 'peach', title: `${e.type}: ${e.title}`, body: `${D.rel(e.date)}${e.time ? ' at ' + D.time(e.time) : ''}`, open: () => editEvent(e.id)}));
  const dow = D.parse(t).getDay();
  if ((dow === 0 || dow === 1) && !(Store.get('week', D.weekStart(t)) || {}).objectives) out.push({key: 'weekplan-' + D.weekStart(t), cat: 'planning', icon: 'cal', tone: 'lav', title: 'Plan your week', body: 'Set 1–3 objectives and do a quick weekly reset.', route: 'planner', tab: 'week'});
  const dim = D.parse(D.monthEnd(D.month(t))).getDate(), dd = D.parse(t).getDate();
  if (dd >= dim - 2 || dd <= 2) out.push({key: 'monthreview-' + D.month(dd <= 2 ? D.add(t, -5) : t), cat: 'planning', icon: 'chart', tone: 'butter', title: 'Monthly review time', body: 'Look back at the month in Reports and set next month’s focus.', route: 'reports'});
  return out;
});
})();
