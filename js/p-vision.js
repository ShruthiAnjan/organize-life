/* Rua — My Vision & Inspiration: Vision Board + Life in Motion */
(function(){
'use strict';
const {$, $$, esc, uid, by, plural, D, Store, icon: I} = LOS;
const F = () => LOS.state.filters;
const VCATS = ['Dream home', 'Career', 'Travel', 'Financial', 'Lifestyle', 'Personal growth', 'Fitness', 'Fashion', 'Experiences', 'Other'];
const MCATS = ['Course', 'Certification', 'Travel', 'Creative work', 'Project', 'Personal milestone', 'Memorable day', 'New skill', 'Fitness', 'Career', 'Other'];
const SIZES = ['s', 'm', 'l', 'w'], SIZE_LABEL = {s: 'Small square', m: 'Portrait', l: 'Tall', w: 'Wide'};
const POS = [['center', 'Centre'], ['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right']];

const style = document.createElement('style');
style.textContent = `.pboard{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));grid-auto-rows:10px;grid-auto-flow:dense;gap:0 16px}
.pboard>*{margin-bottom:16px}.pboard .sz-s{grid-row:span 20}.pboard .sz-m{grid-row:span 26}.pboard .sz-l{grid-row:span 34}.pboard .sz-w{grid-row:span 22;grid-column:span 2}.pboard .slotc{grid-row:span 20}
.pboard .pin{height:calc(100% - 16px);margin:0}.pboard .pin img{height:100%;aspect-ratio:auto!important}.pboard .slot{height:calc(100% - 16px);min-height:0}
.pboard .pin .ov{position:absolute;left:0;right:0;bottom:0;padding:28px 14px 12px;background:linear-gradient(180deg,transparent,rgba(40,30,24,.62));color:#fff}
.pboard .pin .ov b{font:600 18px/1.15 var(--serif);display:block}.pboard .pin .ov span{font-size:11.5px;opacity:.9}
.pboard .pin{cursor:grab}.pboard .pin.dragging{opacity:.4}.board-drop{outline:2px dashed var(--terra);outline-offset:6px;border-radius:20px}
@media(max-width:600px){.pboard{grid-template-columns:repeat(2,1fr);gap:0 10px}.pboard .sz-w{grid-column:span 2}}`;
document.head.appendChild(style);

const allItems = kind => Store.all(kind).sort(by(x => x.order ?? x.createdAt));
/* ---------- boards: keep every past board, start new ones any time ---------- */
const DEF_NAME = {vision: 'My Vision Board', memory: 'My Life in Motion'};
const mainId = kind => 'main-' + kind;
const boardOf = (kind, it) => it.boardId || mainId(kind);
LOS.boards = kind => {
  const bs = Store.all('board').filter(b => b.type === kind).sort(by(b => b.createdAt || 0));
  if (!bs.some(b => b.id === mainId(kind)) && (!bs.length || allItems(kind).some(it => !it.boardId))) bs.unshift({id: mainId(kind), type: kind, name: DEF_NAME[kind], virtual: true, createdAt: 0});
  return bs;
};
const curBoard = kind => { const bs = LOS.boards(kind); const k = F()[kind + 'Board']; return bs.find(b => b.id === k) || bs[bs.length - 1]; };
const items = (kind, boardId) => { const b = boardId || curBoard(kind).id; return allItems(kind).filter(it => boardOf(kind, it) === b); };
const materialize = kind => { const b = LOS.boards(kind).find(x => x.virtual); if (b) Store.put('board', {id: b.id, type: kind, name: b.name, createdAt: Math.min(Date.now(), ...allItems(kind).map(i => i.createdAt || Date.now()))}, {silent: true}); };
LOS.actions['board-pick'] = el => { F()[el.dataset.kind + 'Board'] = el.value; LOS.render(); };
LOS.actions['board-new'] = el => { const kind = el.dataset.kind; const y = D.today().slice(0, 4);
  LOS.openForm({title: kind === 'vision' ? 'New vision board' : 'New Life in Motion board', size: 'narrow', saveLabel: 'Create board', fields: [{k: 'name', label: 'Board name', required: true}, {k: 'note', label: 'Intention for this board (optional)', type: 'textarea', rows: 2}], values: {name: kind === 'vision' ? `Vision Board ${y}` : `Life in Motion ${y}`},
    onSave: d => { materialize(kind); const b = Store.put('board', {type: kind, name: d.name, note: d.note}); F()[kind + 'Board'] = b.id; LOS.toast('New board ready ✿ your older boards are kept in the dropdown'); }}); };
LOS.actions['board-rename'] = el => { const kind = el.dataset.kind; const b = curBoard(kind);
  LOS.openForm({title: 'Board details', size: 'narrow', fields: [{k: 'name', label: 'Board name', required: true}, {k: 'note', label: 'Intention for this board', type: 'textarea', rows: 2}], values: b, onSave: d => { Store.put('board', {...(b.virtual ? {id: b.id, type: kind, createdAt: Date.now()} : b), ...d, virtual: undefined}); }}); };
LOS.actions['board-del'] = async el => { const kind = el.dataset.kind; const b = curBoard(kind); const its = items(kind, b.id);
  if (!(await LOS.confirm(`Delete “${b.name}”${its.length ? ` and its ${plural(its.length, 'photo')}` : ''}? Your other boards stay as they are.`, {ok: 'Delete board'}))) return;
  its.forEach(it => { LOS.dropImage(it.image); Store.del(kind, it.id); }); if (!b.virtual) Store.del('board', b.id); delete F()[kind + 'Board']; LOS.toast('Board deleted'); };
const boardBar = kind => { const bs = LOS.boards(kind); const b = curBoard(kind); const n = items(kind, b.id).length;
  return `<div class="boardbar"><span class="tiny muted">Board</span><select class="input" style="width:auto;min-width:200px" data-change="board-pick" data-kind="${kind}" aria-label="Choose board">${bs.slice().reverse().map(x => `<option value="${x.id}" ${x.id === b.id ? 'selected' : ''}>${esc(x.name)}${x.createdAt ? ' · ' + new Date(x.createdAt).toLocaleDateString(undefined, {month: 'short', year: 'numeric'}) : ''}</option>`).join('')}</select><span class="tiny muted">${plural(n, 'photo')}${bs.length > 1 ? ` · ${bs.length} boards kept` : ''}</span><span class="spacer"></span><button class="btn sm" data-action="board-new" data-kind="${kind}">${I('plus')} New board</button><button class="btn sm ghost" data-action="board-rename" data-kind="${kind}">${I('edit')} Rename</button><button class="btn sm ghost danger" data-action="board-del" data-kind="${kind}">${I('trash')} Delete board</button></div>${b.note ? `<p class="small muted" style="margin:-4px 0 14px">${esc(b.note)}</p>` : ''}`; };
async function upload(kind, files, extra = {}) {
  files = files.filter(f => { const ok = LOS.validImage(f); if (!ok) LOS.toast(`${f.name} isn’t a JPG, PNG or WEBP`); return ok; });
  if (!files.length) return [];
  LOS.toast(`Uploading ${plural(files.length, 'photo')}…`);
  const base = Math.max(0, ...Store.all(kind).map(x => x.order || 0)) + 1; const out = []; const bid = curBoard(kind).id; if (bid !== mainId(kind)) extra = {boardId: bid, ...extra};
  for (let i = 0; i < files.length; i++) {
    try { const ref = await LOS.saveImage(files[i]); const sz = ref.w && ref.h ? (ref.w > ref.h * 1.25 ? 'w' : ref.h > ref.w * 1.3 ? 'l' : ref.h > ref.w * 1.05 ? 'm' : 's') : 'm'; out.push(Store.put(kind, {image: ref, title: '', caption: '', category: '', size: sz, pos: 'center', order: base + i, ...(kind === 'memory' ? {date: D.today()} : {}), ...extra})); }
    catch (e) { LOS.toast(e.message || 'Upload failed'); console.error(e); }
  }
  if (out.length) LOS.toast(out.length === 1 ? 'Uploaded ✿ add a title anytime' : `${out.length} photos added ✿`);
  return out;
}
LOS.actions['vb-upload'] = async el => { const kind = el.dataset.kind; const files = await LOS.pickImages(true); const made = await upload(kind, files); if (made.length === 1) (kind === 'vision' ? editVision : editMemory)(made[0].id, true); };
LOS.actions['vb-replace'] = async el => { const kind = el.dataset.kind; const it = Store.get(kind, el.dataset.id); const [f] = await LOS.pickImages(false); if (!f) return; try { LOS.toast('Replacing…'); const ref = await LOS.saveImage(f); LOS.dropImage(it.image); Store.put(kind, {...it, image: ref}); } catch (e) { LOS.toast(e.message); } };
LOS.actions['vb-del'] = el => LOS.delWithConfirm(el.dataset.kind, el.dataset.id, 'this photo');
LOS.actions['vb-size'] = el => { const it = Store.get(el.dataset.kind, el.dataset.id); Store.put(el.dataset.kind, {...it, size: SIZES[(SIZES.indexOf(it.size || 'm') + 1) % SIZES.length]}); };
LOS.actions['vb-edit'] = el => (el.dataset.kind === 'vision' ? editVision : editMemory)(el.dataset.id);
function editVision(id, fresh) { const it = Store.get('vision', id);
  LOS.openForm({title: fresh ? 'Tell it a story' : 'Edit vision', fields: [{k: 'title', label: 'Title', ph: 'e.g., Sunlit apartment with plants'}, {k: 'category', label: 'Category', type: 'select', blank: '—', options: VCATS}, {k: 'caption', label: 'Caption / affirmation', type: 'textarea', rows: 2, ph: 'I am…'}, {k: 'size', label: 'Tile size', type: 'select', options: SIZES.map(s => ({v: s, l: SIZE_LABEL[s]}))}, {k: 'pos', label: 'Focus point (crop)', type: 'select', options: POS.map(([v, l]) => ({v, l}))}, {k: 'image', label: 'Photo', type: 'image', noClear: true}],
    values: it, onSave: d => Store.put('vision', {...it, ...d, image: d.image || it.image}), onDelete: () => { LOS.dropImage(it.image); Store.del('vision', id); }}); }
function editMemory(id, fresh) { const it = id ? Store.get('memory', id) : null;
  LOS.openForm({title: fresh ? 'Capture this moment' : it ? 'Edit memory' : 'New memory', size: 'wide', fields: [{k: 'title', label: 'Title', required: !fresh, ph: 'e.g., Passed my CCNA'}, {k: 'date', label: 'Date', type: 'date', required: true}, {k: 'category', label: 'Category', type: 'select', blank: '—', options: MCATS}, {k: 'achievement', label: 'Achievement or milestone', ph: 'What did you accomplish?'}, {k: 'desc', label: 'Description', type: 'textarea', rows: 2}, {k: 'reflection', label: 'Personal reflection', type: 'textarea', rows: 3, ph: 'How did it feel? What did it teach you?'}, {k: 'visionId', label: 'Connected to a vision (optional — your choice)', type: 'select', blank: '— not connected —', options: () => allItems('vision').map(v => ({v: v.id, l: (v.title || v.category || 'Untitled vision') + ' — ' + ((LOS.boards('vision').find(b => b.id === boardOf('vision', v)) || {}).name || '')}))}, {k: 'size', label: 'Tile size', type: 'select', options: SIZES.map(s => ({v: s, l: SIZE_LABEL[s]}))}, {k: 'pos', label: 'Focus point', type: 'select', options: POS.map(([v, l]) => ({v, l}))}, {k: 'image', label: 'Photo', type: 'image', noClear: true}],
    values: it || {date: D.today(), size: 'm', pos: 'center'}, onSave: d => { if (!d.image && !(it && it.image)) { LOS.toast('Add a photo for this memory'); return false; } Store.put('memory', {...(it || {order: Date.now(), ...(curBoard('memory').id !== mainId('memory') ? {boardId: curBoard('memory').id} : {})}), ...d, image: d.image || it.image}); }, onDelete: it ? () => { LOS.dropImage(it.image); Store.del('memory', id); } : null}); }
LOS.editMemory = editMemory;

const pin = (kind, it) => { const src = LOS.imgSrc(it.image); const t = it.title || ''; const sub = kind === 'vision' ? it.category || '' : [it.date ? D.fmt(it.date, {month: 'short', day: 'numeric', year: 'numeric'}) : '', it.category].filter(Boolean).join(' · ');
  return `<div class="pin sz-${it.size || 'm'}" data-drag="${it.id}" data-kind="${kind}"><img src="${esc(src)}" alt="${esc(t || 'Photo')}" loading="lazy" style="object-position:${esc(it.pos || 'center')}" draggable="false">
  <div class="tools"><button class="icon-btn" data-action="vb-edit" data-kind="${kind}" data-id="${it.id}" aria-label="Edit details">${I('edit')}</button><button class="icon-btn" data-action="vb-size" data-kind="${kind}" data-id="${it.id}" data-tip="Resize (${SIZE_LABEL[it.size || 'm']})">${I('resize')}</button><button class="icon-btn" data-action="vb-replace" data-kind="${kind}" data-id="${it.id}" data-tip="Replace image">${I('refresh')}</button><button class="icon-btn" data-action="vb-del" data-kind="${kind}" data-id="${it.id}" aria-label="Delete">${I('trash')}</button></div>
  ${t || sub || it.caption ? `<div class="ov">${t ? `<b>${esc(t)}</b>` : ''}<span>${esc(sub)}</span>${it.caption ? `<div style="font:500 13px var(--sans);margin-top:4px">${esc(it.caption)}</div>` : ''}${kind === 'memory' && it.achievement ? `<div style="font-size:12px;margin-top:4px">✦ ${esc(it.achievement)}</div>` : ''}</div>` : `<div class="ov" style="padding-top:20px"><span class="clickable" data-action="vb-edit" data-kind="${kind}" data-id="${it.id}">+ add a title</span></div>`}</div>`; };
const slot = (kind, n, label = 'Upload Image') => `<button class="slot slotc ${n % 3 === 1 ? 'tall' : ''}" style="${n % 3 === 1 ? 'grid-row:span 26' : ''}" data-action="vb-upload" data-kind="${kind}" data-slot><span class="plus">${I('plus')}</span><span class="small">${label}</span><span class="tiny">or drop photos here</span></button>`;
function board(kind, list, minSlots) {
  const empties = Math.max(1, minSlots - list.length);
  return `<div class="pboard" data-board="${kind}">${list.map(it => pin(kind, it)).join('')}${Array.from({length: empties}, (_, i) => slot(kind, i, i ? 'Upload Image' : list.length ? 'Add more' : 'Upload Image')).join('')}</div>`;
}

LOS.register('vision', {title: 'Vision & Inspiration', icon: 'sparkle',
  render() {
    const vs = items('vision'); const ms = items('memory'); const vb = curBoard('vision'), mb = curBoard('memory');
    const vc = F().vcat || ''; const mc = F().mcat || ''; const ord = F().mord || 'new';
    const vlist = vs.filter(v => !vc || v.category === vc);
    let mlist = ms.filter(m => !mc || m.category === mc);
    mlist = ord === 'custom' ? mlist : mlist.slice().sort(by(m => m.date || '', ord === 'new' ? -1 : 1));
    const linked = ms.filter(m => m.visionId && Store.get('vision', m.visionId)).length;
    const cats = new Set(vs.map(v => v.category).filter(Boolean));
    return LOS.hero('vision', {title: 'My Vision & Inspiration', script: 'where I’m going · how far I’ve come', tone: 'lav', sub: 'Two boards: the life you’re working towards, and the life you’re actually living. Both are yours alone.'}) +
    `<section><div class="row wrap" style="margin-bottom:6px"><div class="grow"><div class="eyebrow">Part one</div><h2>My Vision Board <span class="small" style="font:500 15px var(--sans);color:var(--terra);letter-spacing:0">the life I am working towards</span></h2></div><button class="btn primary" data-action="vb-upload" data-kind="vision">${I('upload')} Upload photos</button></div>
    ${boardBar('vision')}<div class="toolbar">${LOS.seg('vcat', [['', 'Everything'], ...VCATS.filter(c => vs.some(v => v.category === c)).map(c => [c, c])], vc)}<span class="spacer"></span><span class="tiny muted">Drag to rearrange · ${I('resize')} to resize</span></div>
    ${board('vision', vlist, vc ? 1 : 8)}</section>
    <div class="bridge"><div style="font-size:34px">✦</div><div class="grow"><div style="font:700 19px var(--serif);color:var(--brown);line-height:1.2">from dreaming to living</div><div class="small" style="color:var(--ink-2)">${vs.length} vision${vs.length === 1 ? '' : 's'} on “${esc(vb.name)}”${cats.size ? ` across ${cats.size} ${cats.size === 1 ? 'area' : 'areas'}` : ''} · ${plural(ms.length, 'moment')} captured in “${esc(mb.name)}”${linked ? ` · ${linked} you’ve personally connected to a vision` : ''}.</div><div class="tiny muted" style="margin-top:4px">Connections are only ever made by you, from a memory’s details.</div></div></div>
    <section><div class="row wrap" style="margin-bottom:6px"><div class="grow"><div class="eyebrow">Part two</div><h2>My Life in Motion <span class="small" style="font:500 15px var(--sans);color:var(--terra);letter-spacing:0">the life I am actually living</span></h2></div><button class="btn" data-action="new-memory">${I('plus')} Memory</button><button class="btn primary" data-action="vb-upload" data-kind="memory">${I('upload')} Upload photos</button></div>
    ${boardBar('memory')}<div class="toolbar">${LOS.seg('mord', [['new', 'Newest first'], ['old', 'Oldest first'], ['custom', 'My arrangement']], ord)}<select class="input" data-change="fset" data-k="mcat" aria-label="Category"><option value="">All categories</option>${MCATS.map(c => `<option ${c === mc ? 'selected' : ''}>${c}</option>`).join('')}</select>${ms.length ? `<span class="spacer"></span><span class="tiny muted">${plural(mlist.length, 'memory', 'memories')}</span>` : ''}</div>
    ${ord !== 'custom' && mlist.length ? timelineBoard(mlist) : board('memory', mlist, mc ? 1 : 6)}</section>`;
  },
  mount(el) {
    $$('[data-board]', el).forEach(b => {
      const kind = b.dataset.board;
      // file drag & drop onto the board
      b.addEventListener('dragover', e => { if ([...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); b.classList.add('board-drop'); } });
      b.addEventListener('dragleave', e => { if (!b.contains(e.relatedTarget)) b.classList.remove('board-drop'); });
      b.addEventListener('drop', async e => { b.classList.remove('board-drop'); if (e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); e.stopPropagation(); await upload(kind, [...e.dataTransfer.files]); } });
      // rearrange pins
      if (kind === 'vision' || LOS.filter('mord', 'new') === 'custom') LOS.dnd(b, {item: '.pin', zone: '.pin', onDrop: (id, z) => { if (id === z.dataset.drag) return; const list = items(kind); const from = list.findIndex(x => x.id === id), to = list.findIndex(x => x.id === z.dataset.drag); if (from < 0 || to < 0) return; const [x] = list.splice(from, 1); list.splice(to, 0, x); list.forEach((it, i) => { if (it.order !== i) Store.put(kind, {...it, order: i}, {silent: true}); }); Store.emit(); }});
    });
    $$('.pin', el).forEach(p => p.addEventListener('dragover', () => p.classList.add('drag-over'))); $$('.pin', el).forEach(p => p.addEventListener('dragleave', () => p.classList.remove('drag-over'))); $$('.pin', el).forEach(p => p.addEventListener('drop', () => p.classList.remove('drag-over')));
  }
});
function timelineBoard(list) {
  const byYear = LOS.groupBy(list, m => (m.date || '').slice(0, 4) || 'Undated');
  return Object.entries(byYear).sort((a, b) => LOS.filter('mord', 'new') === 'new' ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0])).map(([y, ms]) => `<div class="row" style="margin:6px 0 12px"><h3 style="font-size:28px">${esc(y)}</h3><div class="grow divider" style="margin:0"></div></div><div class="pboard" data-board="memory">${ms.map(m => pin('memory', m)).join('')}${slot('memory', 0, 'Add more')}</div>`).join('');
}
LOS.actions['new-memory'] = () => editMemory(null);
LOS.searchProviders.push(q => [...Store.all('vision').map(v => ({k: 'vision', it: v})), ...Store.all('memory').map(m => ({k: 'memory', it: m}))].filter(x => LOS.match(q, x.it.title, x.it.caption, x.it.category, x.it.desc, x.it.reflection, x.it.achievement)).map(x => ({icon: 'image', title: x.it.title || 'Untitled photo', sub: x.k === 'vision' ? 'Vision board' : 'Life in Motion · ' + D.fmt(x.it.date), open: () => (x.k === 'vision' ? editVision : editMemory)(x.it.id)})));
LOS.quick.push({label: 'Memory / achievement', icon: 'image', open: () => editMemory(null)});
})();
