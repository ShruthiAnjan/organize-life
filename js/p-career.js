/* Organize Life Co. — Career Hub: applications, pipeline, analytics, interview prep, networking */
(function(){
'use strict';
const {esc, uid, num, pct, by, plural, D, Store, icon: I, chart: C, groupBy} = LOS;
const F = () => LOS.state.filters;
const STAGES = ['Interested', 'Researching', 'Planning to Apply', 'Applied', 'Recruiter Contacted', 'Recruiter Screening', 'Technical Interview', 'Hiring Manager Interview', 'Final Interview', 'Offer Received', 'Rejected', 'Withdrawn'];
const STAGE_COL = ['#9A8C80', '#3577C4', '#7B62C9', '#E0A21A', '#159C8C', '#D9638F', '#D0643F', '#B8483F', '#7B62C9', '#3F8F3F', '#9A8C80', '#9A8C80'];
const IDX = Object.fromEntries(STAGES.map((s, i) => [s, i]));
const INTERVIEW = ['Recruiter Screening', 'Technical Interview', 'Hiring Manager Interview', 'Final Interview'];
const reached = (j, stage) => IDX[j.status] >= IDX[stage] && IDX[j.status] <= IDX['Offer Received'] || (j.history || []).some(h => IDX[h.status] >= IDX[stage] && IDX[h.status] <= IDX['Offer Received']);
const applied = j => !!j.appDate || reached(j, 'Applied');
const gotInterview = j => INTERVIEW.some(s => j.status === s || (j.history || []).some(h => h.status === s)) || j.status === 'Offer Received';
const responded = j => applied(j) && (reached(j, 'Recruiter Contacted') || j.status === 'Rejected');
const active = j => applied(j) && !['Rejected', 'Withdrawn', 'Offer Received'].includes(j.status);
const Career = LOS.Career = {STAGES, applied, gotInterview, responded, active, jobs: () => Store.all('job')};

function setStage(j, status) {
  if (j.status === status) return;
  const n = {...j, status, history: [...(j.history || []), {status, date: D.today()}]};
  if (IDX[status] >= IDX.Applied && IDX[status] <= IDX['Offer Received'] && !n.appDate) n.appDate = D.today();
  Store.put('job', n);
  if (status === 'Offer Received') { LOS.confetti(140); LOS.toast('An offer! You earned this ✿'); }
  else if (INTERVIEW.includes(status)) LOS.toast('Interview stage — prep notes are ready in Interview prep');
  else if (status === 'Rejected') LOS.toast('Their loss. Every application is practice ♡');
}
const jobFields = () => [
  {k: 'company', label: 'Company', required: true}, {k: 'title', label: 'Job title', required: true},
  {k: 'status', label: 'Status', type: 'select', options: STAGES}, {k: 'location', label: 'Location'},
  {k: 'url', label: 'Job posting URL', type: 'url', ph: 'https://…'}, {k: 'arrangement', label: 'Work arrangement', type: 'select', options: ['', 'Remote', 'Hybrid', 'On-site']},
  {k: 'empType', label: 'Employment type', type: 'select', options: ['', 'Full-time', 'Part-time', 'Contract', 'Internship', 'Temporary']}, {k: 'salary', label: 'Salary range', ph: 'e.g., $85k–$100k'},
  {k: 'discovered', label: 'Date discovered', type: 'date'}, {k: 'appDate', label: 'Application date', type: 'date'},
  {k: 'deadline', label: 'Application deadline', type: 'date'}, {k: 'followUp', label: 'Follow-up date', type: 'date'},
  {k: 'interviewDate', label: 'Next interview', type: 'datetime-local'}, {k: 'resume', label: 'Resume version used', list: () => Array.from(new Set(Store.all('job').map(j => j.resume).filter(Boolean)))},
  {k: 'recruiter', label: 'Recruiter name'}, {k: 'recruiterContact', label: 'Recruiter contact'},
  {k: 'referral', label: 'Referral contact', full: true}, {k: 'jd', label: 'Job description', type: 'textarea', rows: 4}, {k: 'notes', label: 'Notes', type: 'textarea', rows: 3}];
LOS.editJob = (id, preset = {}) => {
  const j = id ? Store.get('job', id) : null;
  LOS.openForm({title: j ? `${j.title} · ${j.company}` : 'New application', size: 'wide', fields: jobFields(), values: j || Object.assign({status: 'Interested', discovered: D.today()}, preset),
    extraFoot: j ? `<button class="btn left" data-prep="${j.id}">${I('book')} Interview prep</button>` : '',
    onSave: d => {
      if (j) { const statusChanged = d.status !== j.status; const n = {...j, ...d, status: j.status}; Store.put('job', n); if (statusChanged) setStage(Store.get('job', j.id), d.status); }
      else { const n = Store.put('job', {...d, history: [{status: d.status, date: D.today()}], ...(IDX[d.status] >= IDX.Applied && IDX[d.status] <= IDX['Offer Received'] && !d.appDate ? {appDate: D.today()} : {})}); LOS.toast('Application added'); }
    }, onDelete: j ? () => { Store.del('job', j.id); if (Store.get('prep', j.id)) Store.del('prep', j.id); } : null});
  if (j) setTimeout(() => { const b = document.querySelector('[data-prep]'); if (b) b.onclick = () => { document.querySelector('.modal-wrap [data-close]').click(); openPrep(j.id); }; }, 50);
};
LOS.actions['add-job'] = el => LOS.editJob(null, {status: el.dataset.status || 'Interested'});
LOS.actions['edit-job'] = el => LOS.editJob(el.dataset.id);
LOS.actions['job-stage'] = el => { const j = Store.get('job', el.dataset.id); j && setStage(j, el.value); };
LOS.actions['job-followed'] = el => { const j = Store.get('job', el.dataset.id); Store.put('job', {...j, followUp: '', lastFollowUp: D.today()}); LOS.toast('Follow-up done ✓'); };

/* interview prep */
const CHECK = ['Re-read the job description', 'Research the company & team', 'Prepare 3 STAR stories', 'Review technical topics', 'Prepare questions to ask', 'Test camera / plan the route', 'Outfit & documents ready', 'Send thank-you note afterwards'];
function openPrep(jobId) {
  const j = Store.get('job', jobId); if (!j) return; const p = Store.get('prep', jobId) || {id: jobId, checklist: CHECK.map(t => ({id: uid(), t, done: false}))};
  LOS.openForm({title: 'Interview prep · ' + j.company, size: 'wide', saveLabel: 'Save prep', fields: [
    {section: `${j.title}${j.interviewDate ? ' · interview ' + new Date(j.interviewDate).toLocaleString(undefined, {weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'}) : ''}`},
    {k: 'checklist', label: 'Preparation checklist', type: 'list', addLabel: 'Add item'},
    {k: 'research', label: 'Company research', type: 'textarea', full: true, rows: 3, ph: 'Mission, products, recent news, team, culture…'},
    {k: 'technical', label: 'Technical questions', type: 'textarea', full: true, rows: 3}, {k: 'behavioral', label: 'Behavioral questions', type: 'textarea', full: true, rows: 3},
    {k: 'star', label: 'STAR answers (Situation · Task · Action · Result)', type: 'textarea', full: true, rows: 5},
    {k: 'ask', label: 'Questions to ask them', type: 'textarea', full: true, rows: 3}, {k: 'notes', label: 'Interview notes', type: 'textarea', full: true, rows: 3},
    {k: 'feedback', label: 'Feedback received', type: 'textarea', full: true, rows: 2}, {k: 'followups', label: 'Follow-up actions', type: 'textarea', full: true, rows: 2}],
    values: p, onSave: d => Store.put('prep', {...p, ...d, jobId})});
  setTimeout(() => { // make checklist items checkable inside the form
    const le = document.querySelector('[data-field=checklist] .list-editor'); if (!le) return;
    le.querySelectorAll('[data-li]').forEach(r => { if (r.closest('template')) return; const it = (p.checklist || []).find(x => x.id === r.dataset.li); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'cb'; cb.checked = !!(it && it.done); cb.onchange = () => { const cur = Store.get('prep', jobId) || p; const list = (cur.checklist || p.checklist).map(x => x.id === r.dataset.li ? {...x, done: cb.checked} : x); p.checklist = list; Store.put('prep', {...cur, checklist: list, jobId}, {silent: true}); }; r.prepend(cb); });
  }, 40);
}
LOS.openPrep = openPrep;
LOS.actions['open-prep'] = el => openPrep(el.dataset.id);

/* networking */
const CONTACT_TYPES = ['Recruiter', 'Hiring manager', 'Referral', 'Peer / engineer', 'Mentor', 'Alumni', 'Other'];
LOS.editContact = id => { const c = id ? Store.get('contact', id) : null;
  LOS.openForm({title: c ? c.name : 'New contact', size: 'wide', fields: [{k: 'name', label: 'Name', required: true}, {k: 'type', label: 'Relationship', type: 'select', options: CONTACT_TYPES}, {k: 'company', label: 'Company'}, {k: 'role', label: 'Their role'}, {k: 'linkedin', label: 'LinkedIn URL', type: 'url'}, {k: 'email', label: 'Email'}, {k: 'channel', label: 'Where you talk', type: 'select', options: ['LinkedIn', 'Email', 'Phone', 'Coffee chat', 'Event', 'Other']}, {k: 'lastContact', label: 'Last contacted', type: 'date'}, {k: 'followUp', label: 'Follow up on', type: 'date'}, {k: 'jobId', label: 'Related application', type: 'select', blank: '—', options: () => Store.all('job').map(j => ({v: j.id, l: j.company + ' · ' + j.title}))}, {k: 'notes', label: 'Conversation notes', type: 'textarea', rows: 4}],
    values: c || {type: 'Recruiter', channel: 'LinkedIn', lastContact: D.today()}, onSave: d => Store.put('contact', Object.assign({}, c || {}, d)), onDelete: c ? () => Store.del('contact', c.id) : null}); };
LOS.actions['add-contact'] = () => LOS.editContact(); LOS.actions['edit-contact'] = el => LOS.editContact(el.dataset.id);
LOS.actions['contact-done'] = el => { const c = Store.get('contact', el.dataset.id); Store.put('contact', {...c, lastContact: D.today(), followUp: ''}); LOS.toast('Logged ✓'); };

/* page */
LOS.register('career', {title: 'Career Hub', icon: 'brief',
  render() {
    const tab = LOS.tab('career', 'pipeline');
    const jobs = Store.all('job');
    return LOS.hero('career', {title: 'Career Hub', script: 'the next chapter', tone: 'pink', sub: `${plural(jobs.filter(applied).length, 'application')} · ${jobs.filter(active).length} active · ${jobs.filter(j => j.status === 'Offer Received').length} offers`, actions: `<button class="btn" data-action="add-contact">${I('users')} Contact</button><button class="btn primary" data-action="add-job">${I('plus')} Application</button>`}) +
      LOS.tabsHtml('career', [['pipeline', 'Pipeline'], ['list', 'All applications'], ['analytics', 'Analytics'], ['prep', 'Interview prep'], ['network', 'Networking']], tab) + ({pipeline, list, analytics, prep, network})[tab]();
  },
  mount(el) { if (LOS.tab('career', 'pipeline') === 'pipeline') LOS.dnd(el, {item: '.kcard', zone: '.kcol', onDrop: (id, z) => { const j = Store.get('job', id); j && setStage(j, z.dataset.status); }}); }
});
function jcard(j) {
  const fu = j.followUp && j.followUp <= D.add(D.today(), 2);
  return `<div class="kcard" data-drag="${j.id}"><div class="t clickable" data-action="edit-job" data-id="${j.id}">${esc(j.company)}</div><div class="small" style="margin:-2px 0 6px">${esc(j.title)}</div><div class="meta">${j.arrangement ? `<span class="chip ghost">${esc(j.arrangement)}</span>` : ''}${j.appDate ? `<span>Applied ${esc(D.fmt(j.appDate))}</span>` : j.deadline ? `<span class="chip butter">Deadline ${esc(D.rel(j.deadline))}</span>` : ''}${fu ? `<span class="chip peach">Follow up ${esc(D.rel(j.followUp))}</span>` : ''}${j.interviewDate && j.interviewDate.slice(0, 10) >= D.today() ? `<span class="chip lav">Interview ${esc(D.rel(j.interviewDate.slice(0, 10)))}</span>` : ''}</div>
  <div class="mini"><select data-change="job-stage" data-id="${j.id}" aria-label="Stage" style="margin:0">${STAGES.map(s => `<option ${s === j.status ? 'selected' : ''}>${s}</option>`).join('')}</select><button class="icon-btn sm" data-action="open-prep" data-id="${j.id}" data-tip="Interview prep">${I('book')}</button>${LOS.delBtn('job', j.id, 'this application')}</div></div>`;
}
function pipeline() {
  const jobs = Store.all('job'); const q = (F().jq || '').toLowerCase();
  const list = jobs.filter(j => !q || LOS.match(q, j.company, j.title, j.location, j.notes));
  const hideClosed = F().jclosed !== 'show';
  if (!jobs.length) return `<div class="card">${LOS.empty('Your job search starts here', 'Add roles you’re interested in — even before applying.', `<button class="btn primary sm" data-action="add-job">${I('plus')} Add application</button>`)}</div>`;
  return `<div class="toolbar"><input class="input" type="search" placeholder="Search company or role…" value="${esc(F().jq || '')}" data-change="fset" data-k="jq" aria-label="Search applications" style="width:220px"><label class="check small"><input type="checkbox" class="cb" ${hideClosed ? '' : 'checked'} data-change="jclosed"> Show rejected & withdrawn</label><span class="spacer"></span></div>
  <div class="kanban" style="grid-auto-columns:minmax(232px,1fr)">${STAGES.filter(s => !hideClosed || !['Rejected', 'Withdrawn'].includes(s)).map(s => { const cards = list.filter(j => j.status === s).sort(by(j => j.updatedAt, -1)); return `<div class="kcol" data-status="${s}"><div class="kcol-h"><span class="sw" style="background:${STAGE_COL[IDX[s]]}"></span>${s}<span class="n">${cards.length}</span><span class="grow"></span><button class="icon-btn sm" data-action="add-job" data-status="${s}" aria-label="Add">${I('plus')}</button></div><div class="kcards">${cards.map(jcard).join('')}</div></div>`; }).join('')}</div>`;
}
LOS.actions.jclosed = el => { F().jclosed = el.checked ? 'show' : ''; LOS.render(); };
function list() {
  const jobs = Store.all('job').sort(by(j => j.appDate || j.discovered || '', -1));
  if (!jobs.length) return `<div class="card">${LOS.empty('No applications yet')}</div>`;
  return `<div class="toolbar"><span class="spacer"></span><button class="btn sm" data-action="export-jobs">${I('download')} Export CSV</button></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Company</th><th>Role</th><th>Status</th><th>Applied</th><th>Location</th><th>Type</th><th>Salary</th><th>Follow-up</th><th>Resume</th><th></th></tr></thead><tbody>${jobs.map(j => `<tr class="clickable" data-action="edit-job" data-id="${j.id}"><td><b style="font-weight:600">${esc(j.company)}</b>${j.url ? ` <a href="${esc(j.url)}" target="_blank" rel="noopener" aria-label="Posting">${I('link')}</a>` : ''}</td><td class="wrap">${esc(j.title)}</td><td><span class="chip" style="background:${STAGE_COL[IDX[j.status]]}22">${esc(j.status)}</span></td><td>${j.appDate ? D.fmt(j.appDate) : ''}</td><td>${esc(j.location || '')} ${j.arrangement ? '· ' + esc(j.arrangement) : ''}</td><td>${esc(j.empType || '')}</td><td>${esc(j.salary || '')}</td><td>${j.followUp ? D.fmt(j.followUp) : ''}</td><td>${esc(j.resume || '')}</td><td style="width:40px">${LOS.delBtn('job', j.id, 'this application')}</td></tr>`).join('')}</tbody></table></div>`;
}
LOS.actions['export-jobs'] = () => LOS.exportFile('job-applications.csv', LOS.toCSV(Store.all('job'), [['Company', 'company'], ['Title', 'title'], ['Status', 'status'], ['Location', 'location'], ['Arrangement', 'arrangement'], ['Type', 'empType'], ['Salary', 'salary'], ['Discovered', 'discovered'], ['Applied', 'appDate'], ['Deadline', 'deadline'], ['Follow-up', 'followUp'], ['Interview', 'interviewDate'], ['Resume', 'resume'], ['Recruiter', 'recruiter'], ['Recruiter contact', 'recruiterContact'], ['Referral', 'referral'], ['URL', 'url'], ['Notes', 'notes']]), 'text/csv');
LOS.careerStats = (range) => {
  const jobs = Store.all('job'); const inR = j => !range || D.inR(j.appDate, range);
  const ap = jobs.filter(j => applied(j) && inR(j));
  const iv = ap.filter(gotInterview).length, rs = ap.filter(responded).length;
  return {jobs, ap, total: ap.length, week: jobs.filter(j => D.inR(j.appDate, D.range('week'))).length, month: jobs.filter(j => D.inR(j.appDate, D.range('month'))).length, interviews: iv, ivRate: pct(iv, ap.length), respRate: pct(rs, ap.length), rejections: ap.filter(j => j.status === 'Rejected').length, active: ap.filter(active).length, offers: ap.filter(j => j.status === 'Offer Received').length, responded: rs};
};
LOS.careerFunnel = s => C.funnel({items: [{label: 'Applied', value: s.total, color: '#E0A21A'}, {label: 'Heard back', value: s.responded, color: '#159C8C'}, {label: 'Interviewed', value: s.interviews, color: '#7B62C9'}, {label: 'Final round', value: s.ap.filter(j => reached(j, 'Final Interview')).length, color: '#D0643F'}, {label: 'Offer', value: s.offers, color: '#3F8F3F'}], emptyMsg: 'Applications you submit will flow through this funnel.'});
function analytics() {
  const s = LOS.careerStats();
  const weeks = Array.from({length: 12}, (_, i) => D.add(D.weekStart(), (i - 11) * 7));
  const byCo = Object.entries(groupBy(s.ap, j => j.company)).map(([k, v]) => ({label: k, value: v.length})).sort(by(x => x.value, -1)).slice(0, 10);
  const dist = STAGES.map((st, i) => ({label: st, value: s.jobs.filter(j => j.status === st).length, color: STAGE_COL[i]})).filter(x => x.value);
  const events = s.jobs.flatMap(j => j.history || []);
  return `<div class="stats" style="margin-bottom:18px">${[['Total applications', s.total], ['This week', s.week], ['This month', s.month], ['Interviews', s.interviews], ['Interview rate', s.ivRate + '%'], ['Response rate', s.respRate + '%'], ['Active', s.active], ['Rejections', s.rejections], ['Offers', s.offers]].map(([l, v]) => `<div class="stat"><span class="l">${l}</span><span class="v">${v}</span></div>`).join('')}</div>
  <div class="grid g2"><div class="card"><div class="card-h"><h3>Applications per week</h3></div>${C.bar({labels: weeks.map(w => D.fmt(w)), series: [{name: 'Applications', values: weeks.map(w => s.jobs.filter(j => D.inR(j.appDate, [w, D.add(w, 6)])).length), color: '#D9638F'}]})}</div>
  <div class="card"><div class="card-h"><h3>Interview conversion funnel</h3></div>${LOS.careerFunnel(s)}</div>
  <div class="card"><div class="card-h"><h3>Status distribution</h3></div>${C.donut({items: dist, center: {v: s.jobs.length, l: 'tracked'}})}</div>
  <div class="card"><div class="card-h"><h3>By company</h3></div>${C.hbar({items: byCo, fmt: v => plural(v, 'app'), emptyMsg: 'No applications yet.'})}</div>
  <div class="card spanall"><div class="card-h"><h3>Job search activity</h3><span class="small muted">status updates per week</span></div>${C.line({labels: weeks.map(w => D.fmt(w)), series: [{name: 'Updates', values: weeks.map(w => events.filter(e => D.inR(e.date, [w, D.add(w, 6)])).length), color: '#7B62C9'}]})}</div></div>`;
}
function prep() {
  const jobs = Store.all('job'); const t = D.today();
  const upcoming = jobs.filter(j => j.interviewDate && j.interviewDate.slice(0, 10) >= t).sort(by(j => j.interviewDate));
  const inStage = jobs.filter(j => INTERVIEW.includes(j.status) && !upcoming.includes(j));
  const m = F().imonth || D.month();
  const ivDays = groupBy(jobs.filter(j => j.interviewDate && j.interviewDate.startsWith(m)), j => j.interviewDate.slice(0, 10));
  const days = D.days(D.weekStart(D.monthStart(m)), D.add(D.weekStart(D.monthEnd(m)), 6));
  const card = j => { const p = Store.get('prep', j.id); const cl = (p && p.checklist) || []; const done = cl.filter(x => x.done).length; return `<div class="card hover" style="margin-bottom:12px"><div class="row"><div class="grow"><b style="font-family:var(--serif);font-size:19px">${esc(j.company)}</b><div class="small muted">${esc(j.title)} · ${esc(j.status)}</div></div>${j.interviewDate ? `<span class="chip lav">${esc(new Date(j.interviewDate).toLocaleString(undefined, {weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'}))}</span>` : ''}<button class="btn sm primary" data-action="open-prep" data-id="${j.id}">${I('book')} Prep</button></div>${cl.length ? `<div style="margin-top:10px">${LOS.bar(pct(done, cl.length), 'lav', `${done}/${cl.length} prep steps`)}<div class="tiny muted" style="margin-top:4px">${done}/${cl.length} prep steps done</div></div>` : ''}</div>`; };
  return `<div class="grid g3"><div class="span2"><h3 style="margin-bottom:12px">Upcoming interviews</h3>${upcoming.length ? upcoming.map(card).join('') : `<div class="card">${LOS.empty('No interviews scheduled', 'Set “Next interview” on an application to see it here.')}</div>`}${inStage.length ? `<h3 style="margin:18px 0 12px">In interview stages</h3>${inStage.map(card).join('')}` : ''}</div>
  <div class="card"><div style="margin-bottom:10px">${LOS.monthPicker('imonth', m, {short: true})}</div><div class="cal mini-cal">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<div class="dow">${d}</div>`).join('')}${days.map(k => `<div class="day ${k.slice(0, 7) !== m ? 'other' : ''} ${k === t ? 'today' : ''}" ${ivDays[k] ? `data-tip="${esc(ivDays[k].map(j => j.company).join(', '))}" style="background:var(--lav)"` : ''}><span class="n">${D.parse(k).getDate()}</span></div>`).join('')}</div><p class="tiny muted">Interview calendar — shaded days have interviews.</p>
  <div class="divider"></div><div class="eyebrow" style="margin-bottom:8px">Prep any application</div><select class="input" data-change="prep-pick" aria-label="Choose application"><option value="">Choose…</option>${jobs.map(j => `<option value="${j.id}">${esc(j.company)} · ${esc(j.title)}</option>`).join('')}</select></div></div>`;
}
LOS.actions.imonth = el => { F().imonth = D.monthAdd(F().imonth || D.month(), +el.dataset.d); LOS.render(); };
LOS.actions['prep-pick'] = el => el.value && openPrep(el.value);
function network() {
  const cs = Store.all('contact'); const f = F().ctype || '';
  const list = cs.filter(c => !f || c.type === f).sort(by(c => c.followUp || '9999'));
  const due = cs.filter(c => c.followUp && c.followUp <= D.add(D.today(), 3));
  return `<div class="toolbar">${LOS.seg('ctype', [['', 'All'], ...CONTACT_TYPES.slice(0, 5).map(t => [t, t])], f)}<span class="spacer"></span><button class="btn sm primary" data-action="add-contact">${I('plus')} Contact</button></div>
  ${due.length ? `<div class="notice peach" style="margin-bottom:14px">${I('bell')}<div><b>Follow-ups due:</b> ${due.map(c => esc(c.name)).join(', ')}</div></div>` : ''}
  ${list.length ? `<div class="grid g3">${list.map(c => { const j = c.jobId && Store.get('job', c.jobId); return `<div class="card hover"><div class="row"><div class="icon-btn" style="background:var(--pink);color:var(--brown);border-radius:50%">${esc((c.name || '?')[0].toUpperCase())}</div><div class="grow clickable" data-action="edit-contact" data-id="${c.id}"><b>${esc(c.name)}</b><div class="tiny muted">${esc([c.role, c.company].filter(Boolean).join(' · '))}</div></div></div><div class="chips" style="margin:10px 0"><span class="chip pink">${esc(c.type)}</span>${c.channel ? `<span class="chip ghost">${esc(c.channel)}</span>` : ''}${j ? `<span class="chip ghost">${esc(j.company)}</span>` : ''}</div>${c.notes ? `<p class="small muted" style="margin:0 0 8px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${esc(c.notes)}</p>` : ''}<div class="row tiny muted"><span class="grow">${c.lastContact ? 'Last: ' + D.rel(c.lastContact) : ''}</span>${c.followUp ? `<span class="chip ${c.followUp <= D.today() ? 'peach' : 'butter'}">Follow up ${D.rel(c.followUp)}</span><button class="icon-btn sm" data-action="contact-done" data-id="${c.id}" data-tip="Mark followed up">${I('check')}</button>` : ''}${c.linkedin ? `<a class="icon-btn sm" href="${esc(c.linkedin)}" target="_blank" rel="noopener" aria-label="LinkedIn">${I('link')}</a>` : ''}${LOS.delBtn('contact', c.id, 'this contact')}</div></div>`; }).join('')}</div>` : `<div class="card">${LOS.empty('No contacts yet', 'Recruiters, referrals, hiring managers, mentors — keep the thread warm.')}</div>`}`;
}

/* integrations */
LOS.widgets.career = {title: 'Career', tone: 'pink', link: ['career', 'Pipeline'], render() {
  const s = LOS.careerStats(); const t = D.today();
  const ivs = s.jobs.filter(j => j.interviewDate && j.interviewDate.slice(0, 10) >= t).length;
  const fus = [...s.jobs.filter(j => j.followUp && j.followUp >= D.add(t, -7)).map(j => ({d: j.followUp, t: j.company})), ...Store.all('contact').filter(c => c.followUp).map(c => ({d: c.followUp, t: c.name}))].sort(by(x => x.d)).slice(0, 3);
  return `<div class="stats flat" style="grid-template-columns:1fr 1fr;gap:12px"><div class="stat"><span class="v">${s.month}</span><span class="l">Applied this month</span></div><div class="stat"><span class="v">${s.ap.filter(j => j.status === 'Applied').length}</span><span class="l">Awaiting response</span></div><div class="stat"><span class="v">${ivs}</span><span class="l">Interviews scheduled</span></div><div class="stat"><span class="v">${fus.length}</span><span class="l">Follow-ups</span></div></div>${fus.length ? `<div class="divider"></div>${fus.map(f => `<div class="row small" style="margin-bottom:6px"><span class="chip ${f.d <= t ? 'peach' : 'ghost'}">${D.rel(f.d)}</span><span>${esc(f.t)}</span></div>`).join('')}` : ''}`;
}};
LOS.calProviders.push((from, to) => Store.all('job').flatMap(j => [
  ...(j.interviewDate && D.inR(j.interviewDate.slice(0, 10), [from, to]) ? [{key: 'iv:' + j.id, date: j.interviewDate.slice(0, 10), time: j.interviewDate.slice(11, 16), title: 'Interview · ' + j.company, type: 'job', cls: 'job', label: 'Interview', open: () => openPrep(j.id)}] : []),
  ...(j.followUp && D.inR(j.followUp, [from, to]) ? [{key: 'fu:' + j.id, date: j.followUp, title: 'Follow up · ' + j.company, type: 'job', cls: 'job', label: 'Follow-up', open: () => LOS.editJob(j.id)}] : []),
  ...(j.deadline && !applied(j) && D.inR(j.deadline, [from, to]) ? [{key: 'dl:' + j.id, date: j.deadline, title: 'Apply by · ' + j.company, type: 'job', cls: 'job', label: 'Deadline', open: () => LOS.editJob(j.id)}] : [])]));
LOS.calProviders.push((from, to) => Store.all('contact').filter(c => c.followUp && D.inR(c.followUp, [from, to])).map(c => ({key: 'ct:' + c.id, date: c.followUp, title: 'Reach out · ' + c.name, type: 'job', cls: 'job', label: 'Network', open: () => LOS.editContact(c.id)})));
LOS.notifProviders.push(() => {
  const t = D.today(), out = [];
  Store.all('job').forEach(j => {
    if (j.interviewDate && j.interviewDate.slice(0, 10) >= t && j.interviewDate.slice(0, 10) <= D.add(t, 2)) out.push({key: 'iv-' + j.id + j.interviewDate, cat: 'career', icon: 'brief', tone: 'lav', title: `Interview with ${j.company} ${D.rel(j.interviewDate.slice(0, 10)).toLowerCase()}`, body: new Date(j.interviewDate).toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'}) + ' · open your prep checklist', open: () => openPrep(j.id)});
    if (j.followUp && j.followUp <= t) out.push({key: 'jfu-' + j.id + j.followUp, cat: 'career', icon: 'brief', tone: 'pink', title: `Follow up with ${j.company}`, body: j.title, open: () => LOS.editJob(j.id)});
    if (j.deadline && !applied(j) && j.deadline >= t && j.deadline <= D.add(t, 3)) out.push({key: 'jdl-' + j.id, cat: 'career', icon: 'flag', tone: 'butter', title: `Application deadline: ${j.company}`, body: D.rel(j.deadline), open: () => LOS.editJob(j.id)});
  });
  Store.all('contact').filter(c => c.followUp && c.followUp <= t).forEach(c => out.push({key: 'cfu-' + c.id + c.followUp, cat: 'career', icon: 'users', tone: 'pink', title: 'Reach out to ' + c.name, body: [c.type, c.company].filter(Boolean).join(' · '), open: () => LOS.editContact(c.id)}));
  return out;
});
LOS.searchProviders.push(q => Store.all('job').filter(j => LOS.match(q, j.company, j.title, j.notes, j.location)).map(j => ({icon: 'brief', title: `${j.company} — ${j.title}`, sub: 'Application · ' + j.status, open: () => LOS.editJob(j.id)})));
LOS.searchProviders.push(q => Store.all('contact').filter(c => LOS.match(q, c.name, c.company, c.notes)).map(c => ({icon: 'users', title: c.name, sub: 'Contact · ' + (c.company || c.type), open: () => LOS.editContact(c.id)})));
LOS.onDelete.job = [id => { if (Store.get('prep', id)) Store.del('prep', id); }];
LOS.quick.push({label: 'Job application', icon: 'brief', open: () => LOS.editJob()});
})();
