/* Rua — lightweight SVG charts (validated categorical palette, hover tooltips, table fallback) */
(function(){
'use strict';
const {esc, num, clamp, D} = LOS;
const CAT = ['#D0643F', '#159C8C', '#7B62C9', '#E0A21A', '#D9638F', '#3F8F3F', '#3577C4', '#B8483F'];
const C = LOS.chart = {CAT};
const anim = () => LOS.animOn() ? ' anim' : '';
function nice(max) {
  if (max <= 0) return {max: 1, step: .25};
  const raw = max / 4, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
  return {max: Math.ceil(max / step) * step, step};
}
function table(head, rows) {
  return `<button class="tbl-toggle" data-action="toggle-table">Show as table</button><div class="table-wrap" hidden style="margin-top:8px;max-height:240px"><table class="tbl"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${i ? 'num' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
LOS.actions['toggle-table'] = el => { const t = el.nextElementSibling; t.hidden = !t.hidden; el.textContent = t.hidden ? 'Show as table' : 'Hide table'; };
const legend = series => series.length > 1 ? `<div class="legend">${series.map((s, i) => `<span><i style="background:${s.color || CAT[i]}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
const isEmpty = series => !series.some(s => s.values.some(v => num(v) !== 0));
C.empty = (msg = 'No data yet — it’ll appear here as you add entries.') => `<div class="chart-empty">${esc(msg)}</div>`;

C.bar = ({labels, series, fmt = v => v, h = 200, emptyMsg, stacked = false, target}) => {
  if (!labels.length || isEmpty(series)) return C.empty(emptyMsg);
  const W = 600, L = 46, B = 24, T = 10, R = 6, ph = h - B - T, pw = W - L - R;
  const totals = labels.map((_, i) => stacked ? series.reduce((a, s) => a + num(s.values[i]), 0) : Math.max(...series.map(s => num(s.values[i]))));
  let {max, step} = nice(Math.max(...totals, target || 0));
  if (series.every(x => x.values.every(v => Number.isInteger(num(v)))) && step < 1) { step = 1; max = Math.max(1, Math.ceil(max)); }
  const bw = pw / labels.length; const gap = 2;
  const inner = stacked ? Math.min(bw * .6, 44) : Math.min((bw * .72) / series.length, 30);
  let g = '';
  for (let v = 0; v <= max + 1e-9; v += step) { const y = T + ph - v / max * ph; g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text class="axis" x="${L - 6}" y="${y + 4}" text-anchor="end">${esc(fmt(v, true))}</text>`; }
  let bars = '';
  labels.forEach((lab, i) => {
    const cx = L + bw * i + bw / 2; let acc = 0;
    series.forEach((s, j) => {
      const v = num(s.values[i]); if (!v) return;
      const hh = v / max * ph; const col = s.color || CAT[j];
      const x = stacked ? cx - inner / 2 : cx - (inner * series.length + gap * (series.length - 1)) / 2 + j * (inner + gap);
      const y = T + ph - hh - (stacked ? acc / max * ph : 0);
      const r = Math.min(4, inner / 2, hh);
      const path = `M${x},${y + hh}V${y + r}Q${x},${y} ${x + r},${y}H${x + inner - r}Q${x + inner},${y} ${x + inner},${y + r}V${y + hh}Z`;
      bars += `<path class="mark bar" d="${path}" fill="${col}" style="animation-delay:${i * 30}ms" data-tip="<b>${esc(lab)}</b><br>${esc(s.name)}: ${esc(fmt(v))}"/>`;
      if (stacked) { acc += v; bars += `<line x1="${x}" x2="${x + inner}" y1="${y + hh}" y2="${y + hh}" stroke="#FFFDF9" stroke-width="2"/>`; }
    });
  });
  const every = Math.ceil(labels.length / 12);
  const xl = labels.map((l, i) => i % every ? '' : `<text class="axis" x="${L + bw * i + bw / 2}" y="${h - 6}" text-anchor="middle">${esc(l)}</text>`).join('');
  const tgt = target ? `<line x1="${L}" x2="${W - R}" y1="${T + ph - target / max * ph}" y2="${T + ph - target / max * ph}" stroke="#55483F" stroke-dasharray="4 4" stroke-width="1.2"/><text class="axis" x="${W - R}" y="${T + ph - target / max * ph - 4}" text-anchor="end">goal</text>` : '';
  return `<div class="chart${anim()}"><svg viewBox="0 0 ${W} ${h}" role="img"><g class="grid">${g}</g>${bars}<line class="base" x1="${L}" x2="${W - R}" y1="${T + ph}" y2="${T + ph}"/>${tgt}${xl}</svg>${legend(series)}${table(['', ...series.map(s => s.name)], labels.map((l, i) => [l, ...series.map(s => fmt(num(s.values[i])))]))}</div>`;
};

C.line = ({labels, series, fmt = v => v, h = 200, emptyMsg, area = true, min0 = true, target}) => {
  if (!labels.length || series.every(s => s.values.every(v => v == null))) return C.empty(emptyMsg);
  const W = 600, L = 46, B = 24, T = 12, R = 10, ph = h - B - T, pw = W - L - R;
  const vals = series.flatMap(s => s.values.filter(v => v != null).map(num));
  let {max, step} = nice(Math.max(...vals, target || 0, 0));
  if (vals.every(v => Number.isInteger(v)) && !(target % 1) && step < 1) { step = 1; max = Math.max(1, Math.ceil(max)); }
  const X = i => L + (labels.length === 1 ? pw / 2 : i / (labels.length - 1) * pw), Y = v => T + ph - v / max * ph;
  let g = ''; for (let v = 0; v <= max + 1e-9; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${esc(fmt(v, true))}</text>`;
  let marks = '';
  series.forEach((s, j) => {
    const col = s.color || CAT[j]; const pts = s.values.map((v, i) => v == null ? null : [X(i), Y(num(v))]);
    let d = '', seg = [];
    pts.forEach(p => { if (p) { d += (seg.length ? 'L' : 'M') + p[0] + ',' + p[1]; seg.push(p); } else seg = []; });
    const valid = pts.filter(Boolean);
    if (area && series.length === 1 && valid.length > 1) marks += `<path d="${d}L${valid[valid.length - 1][0]},${T + ph}L${valid[0][0]},${T + ph}Z" fill="${col}" opacity=".10"/>`;
    marks += `<path class="line" d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    pts.forEach((p, i) => { if (p) marks += `<circle class="mark" cx="${p[0]}" cy="${p[1]}" r="${valid.length > 40 ? 2.5 : 4}" fill="${col}" stroke="#FFFDF9" stroke-width="2"/><rect x="${p[0] - Math.max(6, pw / labels.length / 2)}" y="${T}" width="${Math.max(12, pw / labels.length)}" height="${ph}" fill="transparent" data-tip="<b>${esc(labels[i])}</b><br>${esc(s.name)}: ${esc(fmt(num(s.values[i])))}"/>`; });
  });
  const every = Math.ceil(labels.length / 10);
  const xl = labels.map((l, i) => i % every ? '' : `<text class="axis" x="${X(i)}" y="${h - 6}" text-anchor="middle">${esc(l)}</text>`).join('');
  const tgt = target ? `<line x1="${L}" x2="${W - R}" y1="${Y(target)}" y2="${Y(target)}" stroke="#55483F" stroke-dasharray="4 4" stroke-width="1.2"/><text class="axis" x="${W - R}" y="${Y(target) - 4}" text-anchor="end">limit</text>` : '';
  return `<div class="chart${anim()}"><svg viewBox="0 0 ${W} ${h}" role="img"><g class="grid">${g}</g>${marks}<line class="base" x1="${L}" x2="${W - R}" y1="${T + ph}" y2="${T + ph}"/>${tgt}${xl}</svg>${legend(series)}${table(['', ...series.map(s => s.name)], labels.map((l, i) => [l, ...series.map(s => s.values[i] == null ? '—' : fmt(num(s.values[i])))]))}</div>`;
};

C.donut = ({items, fmt = v => v, center, size = 180, emptyMsg}) => {
  items = items.filter(x => num(x.value) > 0);
  const total = items.reduce((a, x) => a + num(x.value), 0);
  if (!total) return C.empty(emptyMsg);
  if (items.length > 8) { const top = items.sort((a, b) => b.value - a.value).slice(0, 7); const rest = items.slice(7).reduce((a, x) => a + num(x.value), 0); items = [...top, {label: 'Other', value: rest, color: '#9A8C80'}]; }
  const R = 80, r = 54, cx = 90, cy = 90; let a0 = -Math.PI / 2; let arcs = '';
  items.forEach((x, i) => {
    const frac = num(x.value) / total; const a1 = a0 + frac * Math.PI * 2; const col = x.color || CAT[i];
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a, rad) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
    let d;
    if (frac >= .9999) d = `M${cx},${cy - R}A${R},${R} 0 1 1 ${cx - .01},${cy - R}L${cx - .01},${cy - r}A${r},${r} 0 1 0 ${cx},${cy - r}Z`;
    else { const [x1, y1] = p(a0, R), [x2, y2] = p(a1, R), [x3, y3] = p(a1, r), [x4, y4] = p(a0, r); d = `M${x1},${y1}A${R},${R} 0 ${large} 1 ${x2},${y2}L${x3},${y3}A${r},${r} 0 ${large} 0 ${x4},${y4}Z`; }
    arcs += `<path class="mark" d="${d}" fill="${col}" stroke="#FFFDF9" stroke-width="2" data-tip="<b>${esc(x.label)}</b><br>${esc(fmt(x.value))} · ${Math.round(frac * 100)}%"/>`;
    a0 = a1;
  });
  const c = center ? `<text x="90" y="88" text-anchor="middle" style="font:600 22px var(--serif);fill:#55483F">${esc(center.v)}</text><text x="90" y="106" text-anchor="middle" class="axis">${esc(center.l)}</text>` : '';
  return `<div class="chart"><div class="row wrap" style="gap:18px;align-items:center"><svg viewBox="0 0 180 180" style="width:${size}px;max-width:100%" role="img">${arcs}${c}</svg>
  <div class="legend" style="flex-direction:column;gap:6px;flex:1;min-width:150px">${items.map((x, i) => `<span class="row" style="gap:6px"><i style="background:${x.color || CAT[i]};flex:none"></i><span class="grow">${esc(x.label)}</span><b style="font-weight:600">${esc(fmt(x.value))}</b><span class="muted" style="width:38px;text-align:right">${Math.round(x.value / total * 100)}%</span></span>`).join('')}</div></div></div>`;
};

C.hbar = ({items, fmt = v => v, emptyMsg, max}) => {
  if (!items.length) return C.empty(emptyMsg);
  const m = max || Math.max(...items.map(x => num(x.max || x.value)), 1);
  return `<div class="chart stack" style="gap:12px">${items.map((x, i) => {
    const p = x.max ? clamp(num(x.value) / num(x.max) * 100, 0, 100) : clamp(num(x.value) / m * 100, 0, 100);
    return `<div><div class="row between small" style="margin-bottom:5px"><span>${esc(x.label)}</span><b style="font-weight:600">${esc(x.text || fmt(x.value))}</b></div><div class="progress" data-tip="<b>${esc(x.label)}</b><br>${esc(x.text || fmt(x.value))}"><i data-w="${p}" style="background:${x.color || CAT[i % 8]}"></i></div></div>`;
  }).join('')}</div>`;
};

C.funnel = ({items, emptyMsg}) => {
  if (!items.length || !items[0].value) return C.empty(emptyMsg);
  const top = items[0].value;
  return `<div class="chart stack" style="gap:6px">${items.map((x, i) => {
    const w = Math.max(6, x.value / top * 100);
    const conv = i ? (items[i - 1].value ? Math.round(x.value / items[i - 1].value * 100) + '% of previous' : '—') : '';
    return `<div class="row" style="gap:12px"><span class="small" style="width:130px;flex:none">${esc(x.label)}</span><div class="grow" style="display:flex;justify-content:center"><div class="mark" data-tip="<b>${esc(x.label)}</b><br>${x.value}${conv ? ' · ' + conv : ''}" style="width:${w}%;height:30px;border-radius:8px;background:${x.color || CAT[i % 8]};color:#fff;display:grid;place-items:center;font-size:12px;font-weight:600;transition:width .8s">${x.value}</div></div><span class="tiny muted" style="width:96px;flex:none;text-align:right">${conv}</span></div>`;
  }).join('')}</div>`;
};

C.heatmap = ({from, to, val, tip, color = '#3F8F3F'}) => {
  if (to < from) return C.empty('Nothing to show for this period yet.');
  const fill = v => v == null ? 'transparent' : v <= 0 ? '#F1EBE4' : color;
  const op = v => v == null || v <= 0 ? 1 : (.28 + .72 * clamp(v, 0, 1)).toFixed(2);
  const legend = `<div class="legend"><span><i style="background:#F1EBE4"></i>None</span><span><i style="background:${color};opacity:.45"></i>Some</span><span><i style="background:${color}"></i>All</span></div>`;
  const span = D.diff(from, to) + 1;
  if (span <= 42) { // short ranges: a readable calendar grid
    const start = D.weekStart(from), end = D.add(D.weekStart(to), 6);
    const cells = D.days(start, end).map(k => { const out = k < from || k > to; const v = out ? null : val(k); return `<div class="hm-day ${out ? 'out' : ''}" ${v == null ? '' : `data-tip="${esc(tip ? tip(k, v) : D.fmt(k))}"`} style="${v != null && v > 0 ? `background:${color};color:#fff;opacity:${op(v)}` : ''}">${D.parse(k).getDate()}</div>`; }).join('');
    return `<div class="chart"><div class="hm-cal">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<div class="hm-dow">${d}</div>`).join('')}${cells}</div>${legend}</div>`;
  }
  const start = D.weekStart(from); const days = D.days(start, to); const cols = Math.ceil(days.length / 7);
  const CW = 15, LW = 26, TH = 16; let cells = '', mons = '', lastCol = -9, lastM = '';
  days.forEach((k, i) => { const c = Math.floor(i / 7), r = i % 7; const v = k < from ? null : val(k); cells += `<rect x="${LW + c * CW}" y="${TH + r * CW}" width="12" height="12" rx="3" fill="${fill(v)}" opacity="${op(v)}" ${v == null ? '' : `data-tip="${esc(tip ? tip(k, v) : D.fmt(k))}"`}/>`;
    const m = k.slice(0, 7); if (r === 0 && m !== lastM && k >= from) { if (c - lastCol >= 3) { mons += `<text class="axis" x="${LW + c * CW}" y="11">${D.mname(m, {month: 'short'})}</text>`; lastCol = c; } lastM = m; } });
  const dl = ['Mon', '', 'Wed', '', 'Fri', '', ''].map((d, r) => d ? `<text class="axis" x="0" y="${TH + r * CW + 10}">${d}</text>` : '').join('');
  const W = LW + cols * CW, H = TH + 7 * CW;
  return `<div class="chart" style="overflow-x:auto"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="width:${W}px!important;height:${H}px;max-width:none;display:block">${mons}${dl}${cells}</svg>${legend}</div>`;
};
C.ring = (p, {size = 132, label, sub, color} = {}) => {
  const r = (size - 14) / 2, c = 2 * Math.PI * r, off = c * (1 - clamp(p, 0, 100) / 100);
  return `<div class="ring" style="width:${size}px;height:${size}px" role="img" aria-label="${Math.round(p)}%"><svg width="${size}" height="${size}"><circle class="bg" cx="${size / 2}" cy="${size / 2}" r="${r}"/><circle class="fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-off="${off}" ${color ? `style="stroke:${color}"` : ''}/></svg><div class="lbl"><b>${esc(label ?? Math.round(p) + '%')}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div></div>`;
};
LOS.animateRings = el => requestAnimationFrame(() => LOS.$$('.ring .fg[data-off]', el).forEach(c => c.style.strokeDashoffset = c.dataset.off));
})();
