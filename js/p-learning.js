/* Rua — Learning Hub */
(function(){
'use strict';
const {esc, uid, num, pct, by, sum, plural, mins, hrs, D, Store, icon: I, chart: C} = LOS;
const F = () => LOS.state.filters;
const LCOLS = [['Backlog', '#9A8C80'], ['To Learn', '#E0A21A'], ['Currently Learning', '#7B62C9'], ['Practicing', '#159C8C'], ['Revision', '#D9638F'], ['Completed', '#3F8F3F']];
const UNDER = ['', 'Understood', 'Needs practice', 'Needs revision'];
const UCHIP = {'Understood': 'sage', 'Needs practice': 'butter', 'Needs revision': 'peach'};
const SUGGEST = ['Azure', 'Networking', 'Cloud Infrastructure', 'Kubernetes', 'Python', 'SQL', 'Tableau', 'Interview Preparation', 'Communication Skills', 'General Technology'];
const projects = () => Store.all('lproject').sort(by(p => p.createdAt));
const tasks = () => Store.all('ltask');
const sessions = () => tasks().flatMap(t => (t.sessions || []).map(s => ({...s, task: t}))).concat(Store.all('studyplan').filter(p => p.done && !p.ltaskId).map(p => ({id: p.id, date: p.date, minutes: p.minutes, task: {projectId: p.projectId, topic: p.title}})));
const L = LOS.Learn = {
  minutesIn: r => sum(sessions().filter(s => D.inR(s.date, r)), s => s.minutes),
  projProgress: pid => { const ts = tasks().filter(t => t.projectId === pid); return {total: ts.length, done: ts.filter(t => t.status === 'Completed').length, p: pct(ts.filter(t => t.status === 'Completed').length, ts.length)}; },
  sessions
};
const projName = id => (Store.get('lproject', id) || {}).name || 'General';
const projColor = id => (Store.get('lproject', id) || {}).color || '#7B62C9';

LOS.editLProject = id => { const p = id ? Store.get('lproject', id) : null;
  LOS.openForm({title: p ? 'Edit subject' : 'New learning project', fields: [{k: 'name', label: 'Subject / project', required: true, list: SUGGEST}, {k: 'color', label: 'Colour', type: 'color'}, {k: 'target', label: 'Target date', type: 'date'}, {k: 'desc', label: 'Why I’m learning this', type: 'textarea', rows: 2}],
    values: p || {color: '#7B62C9'}, onSave: d => Store.put('lproject', Object.assign({}, p || {}, d)),
    onDelete: p ? () => { tasks().filter(t => t.projectId === p.id).forEach(t => Store.del('ltask', t.id)); Store.del('lproject', p.id); } : null}); };
const ltFields = () => [
  {k: 'topic', label: 'Topic', required: true, ph: 'e.g., Azure Virtual Networks'}, {k: 'projectId', label: 'Subject', type: 'select', options: () => projects().map(p => ({v: p.id, l: p.name})), required: true},
  {k: 'subtopic', label: 'Subtopic'}, {k: 'difficulty', label: 'Difficulty', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced']},
  {k: 'status', label: 'Status', type: 'select', options: LCOLS.map(c => c[0])}, {k: 'understanding', label: 'How well I know it', type: 'select', options: UNDER.map(u => ({v: u, l: u || '—'}))},
  {k: 'resource', label: 'Learning resource', ph: 'e.g., Microsoft Learn AZ-900 path'}, {k: 'url', label: 'Resource URL', type: 'url'},
  {k: 'estMin', label: 'Estimated study time (min)', type: 'number', min: 0, step: 5}, {k: 'actualMin', label: 'Extra time not in sessions (min)', type: 'number', min: 0, step: 5, hint: 'Logged sessions add up automatically'},
  {k: 'start', label: 'Start date', type: 'date'}, {k: 'target', label: 'Target completion', type: 'date', after: 'start'},
  {k: 'revision', label: 'Revision date', type: 'date'}, {k: 'desc', label: 'Description', type: 'textarea', rows: 2},
  {k: 'lessons', label: 'Smaller lessons', type: 'list', addLabel: 'Add lesson'}, {k: 'links', label: 'YouTube, PDFs & other resources', type: 'links', addLabel: 'Add resource'},
  {k: 'notes', label: 'Notes', type: 'textarea', rows: 4}];
LOS.editLTask = (id, preset = {}) => {
  const t = id ? Store.get('ltask', id) : null;
  if (!projects().length) { LOS.toast('Create a subject first'); LOS.editLProject(); return; }
  const tm = t ? sum(t.sessions || [], s => s.minutes) : 0;
  LOS.openForm({title: t ? t.topic : 'New topic', size: 'wide', fields: ltFields(), values: t || Object.assign({status: 'To Learn', difficulty: 'Beginner', projectId: projects()[0].id}, preset),
    extraFoot: t ? `<span class="small muted left" style="align-self:center">${plural((t.sessions || []).length, 'session')} · ${mins(tm)} logged</span>` : '',
    onSave: d => { const was = t && t.status; const n = Store.put('ltask', Object.assign({sessions: []}, t || {}, d, d.status === 'Completed' && was !== 'Completed' ? {completedAt: D.today()} : d.status !== 'Completed' ? {completedAt: null} : {})); if (d.status === 'Completed' && was !== 'Completed') LOS.cheer(true); return n; },
    onDelete: t ? () => Store.del('ltask', t.id) : null});
};
LOS.logStudy = (ltaskId) => {
  if (!tasks().length) { LOS.toast('Add a topic first'); LOS.editLTask(); return; }
  LOS.openForm({title: 'Log study time', size: 'narrow', fields: [{k: 'ltaskId', label: 'Topic', type: 'select', options: () => tasks().filter(t => t.status !== 'Completed' || t.id === ltaskId).map(t => ({v: t.id, l: projName(t.projectId) + ' · ' + t.topic}))}, {k: 'minutes', label: 'Minutes', type: 'number', min: 1, step: 5, required: true}, {k: 'date', label: 'Date', type: 'date', required: true}, {k: 'note', label: 'What did you cover?', full: true}],
    values: {ltaskId: ltaskId || '', date: D.today(), minutes: 30},
    onSave: d => { const t = Store.get('ltask', d.ltaskId); if (!t) return; Store.put('ltask', {...t, sessions: [...(t.sessions || []), {id: uid(), date: d.date, minutes: d.minutes, note: d.note}], status: ['Backlog', 'To Learn'].includes(t.status) ? 'Currently Learning' : t.status, start: t.start || d.date}); LOS.toast(`${mins(d.minutes)} logged — brain cells growing ✿`); }});
};
LOS.planStudy = (id) => {
  const p = id ? Store.get('studyplan', id) : null;
  LOS.openForm({title: p ? 'Study session' : 'Schedule study sessions', fields: [{k: 'title', label: 'What', required: true, ph: 'e.g., AZ-900 module 3'}, {k: 'projectId', label: 'Subject', type: 'select', blank: '—', options: () => projects().map(x => ({v: x.id, l: x.name}))}, {k: 'ltaskId', label: 'Topic (optional)', type: 'select', blank: '—', options: () => tasks().map(t => ({v: t.id, l: t.topic}))}, {k: 'date', label: 'Date', type: 'date', required: true}, {k: 'time', label: 'Time', type: 'time'}, {k: 'minutes', label: 'Planned minutes', type: 'number', min: 5, step: 5, required: true}, ...(p ? [] : [{k: 'repeat', label: 'Repeat weekly for', type: 'select', options: [{v: '0', l: 'Just once'}, {v: '3', l: '4 weeks'}, {v: '7', l: '8 weeks'}, {v: '11', l: '12 weeks'}]}])],
    values: p || {date: D.today(), minutes: 45, repeat: '0'},
    onSave: d => { if (p) { Store.put('studyplan', {...p, ...d}); return; } const series = uid(); for (let i = 0; i <= num(d.repeat); i++) { const date = D.add(d.date, i * 7); Store.put('studyplan', {id: series + '~' + date, series, title: d.title, projectId: d.projectId, ltaskId: d.ltaskId, date, time: d.time, minutes: d.minutes, done: false}, {silent: true}); } Store.emit(); LOS.toast('Study plan saved'); },
    onDelete: p ? () => Store.del('studyplan', p.id) : null});
};
LOS.actions['study-done'] = el => {
  const p = Store.get('studyplan', el.dataset.id); if (!p) return;
  if (p.done) { Store.put('studyplan', {...p, done: false}); return; }
  Store.put('studyplan', {...p, done: true});
  const t = p.ltaskId && Store.get('ltask', p.ltaskId);
  if (t) Store.put('ltask', {...t, sessions: [...(t.sessions || []), {id: 'plan-' + p.id, date: p.date, minutes: p.minutes, note: p.title}], status: ['Backlog', 'To Learn'].includes(t.status) ? 'Currently Learning' : t.status});
  LOS.cheer();
};
LOS.editCourse = id => { const c = id ? Store.get('course', id) : null;
  LOS.openForm({title: c ? c.name : 'Course or certification', fields: [{k: 'name', label: 'Name', required: true, ph: 'e.g., AZ-900 Azure Fundamentals'}, {k: 'type', label: 'Type', type: 'select', options: ['Course', 'Certification']}, {k: 'provider', label: 'Provider'}, {k: 'status', label: 'Status', type: 'select', options: ['Planned', 'In progress', 'Completed']}, {k: 'progress', label: 'Progress %', type: 'number', min: 0, max: 100, step: 1}, {k: 'projectId', label: 'Subject', type: 'select', blank: '—', options: () => projects().map(x => ({v: x.id, l: x.name}))}, {k: 'examDate', label: 'Exam / target date', type: 'date'}, {k: 'completed', label: 'Completed on', type: 'date'}, {k: 'expiry', label: 'Expires on', type: 'date'}, {k: 'url', label: 'Link / credential URL', type: 'url'}, {k: 'notes', label: 'Notes', type: 'textarea', rows: 2}],
    values: c || {type: 'Course', status: 'In progress', progress: 0},
    onSave: d => { if (d.status === 'Completed') { d.progress = 100; d.completed = d.completed || D.today(); } const first = d.status === 'Completed' && (!c || c.status !== 'Completed'); Store.put('course', Object.assign({}, c || {}, d)); if (first) { LOS.confetti(120); LOS.toast(d.type === 'Certification' ? 'Certified! Add it to Life in Motion ✿' : 'Course complete ✿'); } },
    onDelete: c ? () => Store.del('course', c.id) : null}); };
LOS.actions['add-lproj'] = () => LOS.editLProject(); LOS.actions['edit-lproj'] = el => LOS.editLProject(el.dataset.id);
LOS.actions['add-ltask'] = el => LOS.editLTask(null, {status: el.dataset.status || 'To Learn', ...(el.dataset.proj ? {projectId: el.dataset.proj} : {})});
LOS.actions['edit-ltask'] = el => LOS.editLTask(el.dataset.id);
LOS.actions['log-study'] = el => LOS.logStudy(el.dataset.id);
LOS.actions['plan-study'] = el => LOS.planStudy(el.dataset.id);
LOS.actions['del-session'] = async el => { if (!(await LOS.confirm('Delete this study session? Your hours will update.'))) return; const t = Store.get('ltask', el.dataset.id); Store.put('ltask', {...t, sessions: (t.sessions || []).filter(x => x.id !== el.dataset.sid)}); };
LOS.onDelete.lproject = [id => tasks().filter(t => t.projectId === id).forEach(t => Store.del('ltask', t.id))];
LOS.actions['add-course'] = () => LOS.editCourse(); LOS.actions['edit-course'] = el => LOS.editCourse(el.dataset.id);
LOS.actions['ltask-status'] = el => { const t = Store.get('ltask', el.dataset.id); if (!t) return; const done = el.value === 'Completed' && t.status !== 'Completed'; Store.put('ltask', {...t, status: el.value, completedAt: el.value === 'Completed' ? (t.completedAt || D.today()) : null}); if (done) LOS.cheer(true); };
LOS.actions['ltask-under'] = el => { const t = Store.get('ltask', el.dataset.id); Store.put('ltask', {...t, understanding: el.value, ...(el.value === 'Needs revision' && !t.revision ? {revision: D.add(D.today(), 3)} : {})}); };
LOS.actions['lesson-toggle'] = el => { const t = Store.get('ltask', el.dataset.id); Store.put('ltask', {...t, lessons: (t.lessons || []).map(l => l.id === el.dataset.l ? {...l, done: el.checked, doneAt: el.checked ? D.today() : null} : l)}); };

LOS.register('learning', {title: 'Learning Hub', icon: 'book',
  render() {
    const tab = LOS.tab('learning', 'board'); const wk = L.minutesIn(D.range('week'));
    return LOS.hero('learning', {title: 'Learning Hub', script: 'curiosity, compounded', tone: 'lav', sub: `${hrs(wk)} studied this week · ${tasks().filter(t => t.status === 'Completed').length} of ${tasks().length} topics completed`, actions: `<button class="btn" data-action="plan-study">${I('cal')} Schedule</button><button class="btn" data-action="log-study">${I('clock')} Log time</button><button class="btn primary" data-action="add-ltask">${I('plus')} Topic</button>`}) +
      LOS.tabsHtml('learning', [['board', 'Board'], ['subjects', 'Subjects'], ['schedule', 'Study schedule'], ['courses', 'Courses & certifications'], ['analytics', 'Analytics']], tab) + ({board, subjects, schedule, courses, analytics})[tab]();
  },
  mount(el) { if (LOS.tab('learning', 'board') === 'board') LOS.dnd(el, {item: '.kcard', zone: '.kcol', onDrop: (id, z) => LOS.actions['ltask-status']({dataset: {id}, value: z.dataset.status})}); }
});
function lcard(t) {
  const lm = sum(t.sessions || [], s => s.minutes) + num(t.actualMin); const ls = t.lessons || [];
  return `<div class="kcard" data-drag="${t.id}" style="border-left:4px solid ${projColor(t.projectId)}"><div class="tiny muted">${esc(projName(t.projectId))}${t.subtopic ? ' · ' + esc(t.subtopic) : ''}</div><div class="t clickable" data-action="edit-ltask" data-id="${t.id}">${esc(t.topic)}</div>
  <div class="meta"><span class="chip ghost">${esc(t.difficulty || '')}</span>${t.understanding ? `<span class="chip ${UCHIP[t.understanding]}">${esc(t.understanding)}</span>` : ''}${lm ? `<span>${I('clock')} ${mins(lm)}${t.estMin ? ' / ' + mins(t.estMin) : ''}</span>` : ''}${t.revision && t.status !== 'Completed' ? `<span class="chip ${t.revision <= D.today() ? 'peach' : 'ghost'}">Revise ${esc(D.rel(t.revision))}</span>` : ''}${ls.length ? `<span>${ls.filter(l => l.done).length}/${ls.length} lessons</span>` : ''}</div>
  ${ls.length ? LOS.bar(pct(ls.filter(l => l.done).length, ls.length), 'lav') : ''}
  <div class="mini"><select data-change="ltask-status" data-id="${t.id}" aria-label="Status" style="margin:0">${LCOLS.map(c => `<option ${c[0] === t.status ? 'selected' : ''}>${c[0]}</option>`).join('')}</select><button class="icon-btn sm" data-action="log-study" data-id="${t.id}" data-tip="Log study time">${I('clock')}</button>${t.url ? `<a class="icon-btn sm" href="${esc(t.url)}" target="_blank" rel="noopener" data-tip="Open resource">${I('link')}</a>` : ''}${LOS.delBtn('ltask', t.id, 'this topic')}</div></div>`;
}
function board() {
  if (!projects().length) return `<div class="card">${LOS.empty('What are you learning?', 'Start with a subject — Azure, Python, Networking — then add topics under it.', `<button class="btn primary sm" data-action="add-lproj">${I('plus')} Add subject</button>`)}<div class="chips" style="justify-content:center;margin-top:6px">${SUGGEST.map(s => `<button class="chip ghost clickable" data-action="quick-lproj" data-name="${esc(s)}">+ ${esc(s)}</button>`).join('')}</div></div>`;
  const f = F().lproj || ''; const u = F().lund || '';
  const list = tasks().filter(t => (!f || t.projectId === f) && (!u || t.understanding === u));
  return `<div class="toolbar">${LOS.seg('lproj', [['', 'All subjects'], ...projects().map(p => [p.id, p.name])], f)}<select class="input" data-change="fset" data-k="lund" aria-label="Understanding"><option value="">Any understanding</option>${UNDER.slice(1).map(x => `<option ${x === u ? 'selected' : ''}>${x}</option>`).join('')}</select><span class="spacer"></span><button class="btn sm ghost" data-action="add-lproj">${I('plus')} Subject</button></div>
  <div class="kanban" style="grid-auto-columns:minmax(240px,1fr)">${LCOLS.map(([s, col]) => { const cs = list.filter(t => t.status === s).sort(by(t => t.target || '9')); return `<div class="kcol" data-status="${s}"><div class="kcol-h"><span class="sw" style="background:${col}"></span>${s}<span class="n">${cs.length}</span><span class="grow"></span><button class="icon-btn sm" data-action="add-ltask" data-status="${s}" data-proj="${f}" aria-label="Add">${I('plus')}</button></div><div class="kcards">${cs.map(lcard).join('')}</div></div>`; }).join('')}</div>`;
}
LOS.actions['quick-lproj'] = el => { Store.put('lproject', {name: el.dataset.name, color: C.CAT[projects().length % 8]}); LOS.toast(el.dataset.name + ' added'); };
function subjects() {
  const ps = projects(); if (!ps.length) return board();
  return `<div class="toolbar"><span class="spacer"></span><button class="btn sm primary" data-action="add-lproj">${I('plus')} Subject</button></div><div class="grid g3">${ps.map(p => { const pr = L.projProgress(p.id); const ts = tasks().filter(t => t.projectId === p.id); const m = sum(ts.flatMap(t => t.sessions || []), s => s.minutes); return `<div class="card hover"><div class="card-h"><span style="width:12px;height:12px;border-radius:4px;background:${p.color}"></span><h3>${esc(p.name)}</h3><button class="icon-btn sm" data-action="edit-lproj" data-id="${p.id}" aria-label="Edit">${I('edit')}</button>${LOS.delBtn('lproject', p.id, 'this subject and all its topics')}</div>${p.desc ? `<p class="small muted" style="margin-top:-6px">${esc(p.desc)}</p>` : ''}<div class="row small" style="margin-bottom:6px"><span class="grow">${pr.done}/${pr.total} topics</span><b>${pr.p}%</b></div>${LOS.bar(pr.p, 'lav')}<div class="tiny muted" style="margin-top:6px">${mins(m)} studied${p.target ? ' · target ' + D.fmt(p.target) : ''}</div>
  <div class="divider"></div>${ts.slice(0, 6).map(t => `<div class="item"><div class="grow clickable small" data-action="edit-ltask" data-id="${t.id}">${esc(t.topic)}</div><select class="input" style="width:auto;height:28px;font-size:12px" data-change="ltask-under" data-id="${t.id}" aria-label="Understanding">${UNDER.map(x => `<option value="${x}" ${x === (t.understanding || '') ? 'selected' : ''}>${x || 'Rate…'}</option>`).join('')}</select></div>`).join('')}${ts.length > 6 ? `<div class="tiny muted">+${ts.length - 6} more</div>` : ''}<button class="btn sm ghost" data-action="add-ltask" data-proj="${p.id}">${I('plus')} Topic</button></div>`; }).join('')}</div>`;
}
function schedule() {
  const t = D.today(); const plans = Store.all('studyplan').sort(by(p => p.date + (p.time || '')));
  const up = plans.filter(p => p.date >= t && !p.done).slice(0, 20), past = plans.filter(p => p.date < t && !p.done);
  const revs = tasks().filter(x => x.revision && x.status !== 'Completed' && x.revision <= D.add(t, 14)).sort(by(x => x.revision));
  const row = p => `<div class="item"><input type="checkbox" class="cb round" ${p.done ? 'checked' : ''} data-action="study-done" data-id="${p.id}" aria-label="Done"><div class="grow clickable" data-action="plan-study" data-id="${p.id}"><div class="t">${esc(p.title)}</div><div class="meta"><span>${esc(D.rel(p.date))}${p.time ? ' · ' + esc(D.time(p.time)) : ''}</span><span>${mins(p.minutes)}</span>${p.projectId ? `<span>${esc(projName(p.projectId))}</span>` : ''}</div></div>${LOS.delBtn('studyplan', p.id, 'this study session')}</div>`;
  return `<div class="grid g3"><div class="card span2"><div class="card-h"><h3>Upcoming sessions</h3><button class="btn sm primary" data-action="plan-study">${I('plus')} Schedule</button></div>${up.length ? up.map(row).join('') : LOS.empty('No study sessions planned', 'Schedule a weekly rhythm — it repeats for you.')}${past.length ? `<div class="divider"></div><div class="eyebrow" style="margin-bottom:6px">Missed or not ticked</div>${past.slice(-6).map(row).join('')}` : ''}</div>
  <div class="card spanall"><div class="card-h"><h3>Study log</h3><button class="btn sm" data-action="log-study">${I('plus')} Log time</button></div>${(() => { const ss = tasks().flatMap(t => (t.sessions || []).map(x => ({...x, t}))).sort(by(x => x.date, -1)).slice(0, 25); return ss.length ? ss.map(x => `<div class="item"><span class="chip lav">${esc(D.rel(x.date))}</span><span class="grow small">${esc(x.t.topic)}${x.note ? ` <span class="muted">· ${esc(x.note)}</span>` : ''}</span><b class="small">${mins(x.minutes)}</b><button class="icon-btn sm del" data-action="del-session" data-id="${x.t.id}" data-sid="${x.id}" aria-label="Delete session">${I('trash')}</button></div>`).join('') : '<p class="small muted">Logged study sessions appear here.</p>'; })()}</div>
  <div class="card tint-pink"><div class="card-h"><h3>Revision reminders</h3></div>${revs.length ? revs.map(x => `<div class="item clickable" data-action="edit-ltask" data-id="${x.id}"><span class="chip ${x.revision <= t ? 'peach' : 'ghost'}">${esc(D.rel(x.revision))}</span><span class="grow small">${esc(x.topic)}</span></div>`).join('') : '<p class="small muted">Set a revision date on a topic (or mark it “Needs revision”) to get a reminder.</p>'}</div></div>`;
}
function courses() {
  const cs = Store.all('course').sort(by(c => c.status === 'Completed' ? 1 : 0));
  return `<div class="toolbar"><span class="small muted">${cs.filter(c => c.status === 'Completed').length} completed · ${cs.filter(c => c.status === 'In progress').length} in progress</span><span class="spacer"></span><button class="btn sm primary" data-action="add-course">${I('plus')} Add</button></div>
  ${cs.length ? `<div class="grid g3">${cs.map(c => `<div class="card hover clickable ${c.status === 'Completed' ? 'tint-sage' : 'tint-lav'}" data-action="edit-course" data-id="${c.id}"><div class="row"><span class="chip ${c.type === 'Certification' ? 'terra' : 'lav'}">${esc(c.type)}</span><span class="grow"></span><span class="chip ${c.status === 'Completed' ? 'sage' : 'ghost'}">${esc(c.status)}</span>${LOS.delBtn('course', c.id, 'this course')}</div><h3 style="margin:10px 0 2px">${esc(c.name)}</h3><div class="small muted">${esc(c.provider || '')}</div><div style="margin-top:12px">${LOS.bar(num(c.progress), c.status === 'Completed' ? '' : 'lav')}</div><div class="tiny muted" style="margin-top:6px">${num(c.progress)}%${c.examDate && c.status !== 'Completed' ? ' · exam ' + D.rel(c.examDate) : ''}${c.completed ? ' · completed ' + D.fmt(c.completed, {month: 'short', year: 'numeric'}) : ''}${c.expiry ? ' · expires ' + D.fmt(c.expiry, {month: 'short', year: 'numeric'}) : ''}</div></div>`).join('')}</div>` : `<div class="card">${LOS.empty('No courses or certifications yet', 'Track CCNA, AZ-900, online courses…')}</div>`}`;
}
LOS.learnCharts = () => {
  const weeks = Array.from({length: 8}, (_, i) => D.add(D.weekStart(), (i - 7) * 7));
  return {
    weekly: C.bar({labels: weeks.map(w => D.fmt(w)), series: [{name: 'Hours', values: weeks.map(w => L.minutesIn([w, D.add(w, 6)]) / 60), color: '#7B62C9'}], fmt: v => (+v).toFixed(1).replace(/\.0$/, '') + 'h', target: num(Store.settings().studyGoal) || null, emptyMsg: 'Log study time to see your weekly hours.'}),
    subjects: C.hbar({items: projects().map(p => { const pr = L.projProgress(p.id); return {label: p.name, value: pr.done, max: pr.total || 1, text: `${pr.done}/${pr.total} · ${pr.p}%`, color: p.color}; }), emptyMsg: 'Add subjects and topics to see progress.'})
  };
};
function analytics() {
  const ts = tasks(); const cs = Store.all('course'); const ch = LOS.learnCharts();
  const done = ts.filter(t => t.status === 'Completed').length;
  const lessons = ts.flatMap(t => t.lessons || []);
  return `<div class="stats" style="margin-bottom:18px">${[['Total topics', ts.length], ['Completed', done], ['In progress', ts.filter(t => ['Currently Learning', 'Practicing', 'Revision'].includes(t.status)).length], ['Hours this week', hrs(L.minutesIn(D.range('week')))], ['Hours this month', hrs(L.minutesIn(D.range('month')))], ['Course completion', cs.length ? Math.round(sum(cs, c => c.progress) / cs.length) + '%' : '—'], ['Lessons done', `${lessons.filter(l => l.done).length}/${lessons.length}`]].map(([l, v]) => `<div class="stat"><span class="l">${l}</span><span class="v">${v}</span></div>`).join('')}</div>
  <div class="grid g2"><div class="card"><div class="card-h"><h3>Weekly study hours</h3><button class="btn sm ghost" data-action="study-goal">Goal: ${num(Store.settings().studyGoal)}h</button></div>${ch.weekly}</div><div class="card"><div class="card-h"><h3>Subject-wise progress</h3></div>${ch.subjects}</div>
  <div class="card spanall"><div class="card-h"><h3>Understanding</h3></div>${C.donut({items: UNDER.slice(1).map((u, i) => ({label: u, value: ts.filter(t => t.understanding === u).length, color: ['#3F8F3F', '#E0A21A', '#D0643F'][i]})), emptyMsg: 'Rate topics as understood / needs practice / needs revision.'})}</div></div>`;
}
LOS.actions['study-goal'] = () => LOS.openForm({title: 'Weekly study goal', size: 'narrow', fields: [{k: 'studyGoal', label: 'Hours per week', type: 'number', min: 0, max: 100, step: .5}], values: {studyGoal: Store.settings().studyGoal}, onSave: d => Store.setSettings({studyGoal: d.studyGoal})});

LOS.widgets.learning = {title: 'Learning', tone: 'lav', link: ['learning', 'Learning'], render() {
  const ts = tasks(); const cur = ts.filter(t => t.status === 'Currently Learning' || t.status === 'Practicing').slice(0, 3);
  const wk = L.minutesIn(D.range('week')); const goal = num(Store.settings().studyGoal);
  const ms = ts.filter(t => t.status === 'Completed').length + ts.flatMap(t => t.lessons || []).filter(l => l.done).length;
  return `<div class="row" style="gap:16px">${C.ring(goal ? pct(wk / 60, goal) : 0, {size: 96, label: hrs(wk), sub: goal ? 'of ' + goal + 'h' : 'this week', color: '#7B62C9'})}<div class="stats flat grow" style="grid-template-columns:1fr 1fr;gap:10px"><div class="stat"><span class="v" style="font-size:22px">${Store.all('course').filter(c => c.status === 'In progress').length}</span><span class="l">Courses in progress</span></div><div class="stat"><span class="v" style="font-size:22px">${ms}</span><span class="l">Milestones done</span></div></div></div>
  <div class="divider"></div>${cur.length ? cur.map(t => `<div class="row small" style="margin-bottom:6px"><span style="width:8px;height:8px;border-radius:50%;background:${projColor(t.projectId)}"></span><span class="grow clickable" data-action="edit-ltask" data-id="${t.id}">${esc(t.topic)}</span><span class="tiny muted">${esc(projName(t.projectId))}</span></div>`).join('') : '<p class="small muted" style="margin:0">Nothing marked “currently learning”.</p>'}`;
}};
LOS.calProviders.push((from, to) => [...Store.all('studyplan').filter(p => D.inR(p.date, [from, to])).map(p => ({key: 'sp:' + p.id, date: p.date, time: p.time, title: 'Study · ' + p.title, type: 'study', cls: 'study' + (p.done ? ' done' : ''), label: 'Study', open: () => LOS.planStudy(p.id)})),
  ...tasks().filter(t => t.revision && t.status !== 'Completed' && D.inR(t.revision, [from, to])).map(t => ({key: 'rv:' + t.id, date: t.revision, title: 'Revise · ' + t.topic, type: 'study', cls: 'study', label: 'Revision', open: () => LOS.editLTask(t.id)})),
  ...Store.all('course').filter(c => c.examDate && c.status !== 'Completed' && D.inR(c.examDate, [from, to])).map(c => ({key: 'ex:' + c.id, date: c.examDate, title: 'Exam · ' + c.name, type: 'study', cls: 'study', label: 'Exam', open: () => LOS.editCourse(c.id)}))]);
LOS.notifProviders.push(() => { const t = D.today(), out = [];
  Store.all('studyplan').filter(p => !p.done && p.date === t).forEach(p => out.push({key: 'sp-' + p.id, cat: 'learning', icon: 'book', tone: 'lav', title: 'Study session today: ' + p.title, body: (p.time ? D.time(p.time) + ' · ' : '') + mins(p.minutes), route: 'learning', tab: 'schedule'}));
  tasks().filter(x => x.revision && x.revision <= t && x.status !== 'Completed').forEach(x => out.push({key: 'rv-' + x.id + x.revision, cat: 'learning', icon: 'refresh', tone: 'pink', title: 'Time to revise: ' + x.topic, body: projName(x.projectId), open: () => LOS.editLTask(x.id)}));
  Store.all('course').filter(c => c.examDate && c.status !== 'Completed' && c.examDate >= t && c.examDate <= D.add(t, 7)).forEach(c => out.push({key: 'ex-' + c.id, cat: 'learning', icon: 'flag', tone: 'butter', title: `${c.name} exam ${D.rel(c.examDate).toLowerCase()}`, body: 'You’ve got this.', open: () => LOS.editCourse(c.id)}));
  return out; });
LOS.searchProviders.push(q => tasks().filter(t => LOS.match(q, t.topic, t.subtopic, t.notes, t.resource)).map(t => ({icon: 'book', title: t.topic, sub: 'Learning · ' + projName(t.projectId), open: () => LOS.editLTask(t.id)})));
LOS.searchProviders.push(q => Store.all('course').filter(c => LOS.match(q, c.name, c.provider)).map(c => ({icon: 'book', title: c.name, sub: c.type, open: () => LOS.editCourse(c.id)})));
LOS.quick.push({label: 'Study time', icon: 'book', open: () => LOS.logStudy()});
})();
