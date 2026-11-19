/* Rua — Finance Hub: loans, expenses, income, budgets, bills, reports */
(function(){
'use strict';
const {esc, uid, num, round2, sum, pct, by, plural, D, Store, icon: I, chart: C, money: $m, groupBy} = LOS;
const F = () => LOS.state.filters;
const DEFAULT_CATS = ['Rent', 'Groceries', 'Transportation', 'Utilities', 'Phone & Internet', 'Subscriptions', 'Shopping', 'Personal care', 'Eating out', 'Education', 'Healthcare', 'Entertainment', 'Loan payment', 'Miscellaneous'];
const METHODS = ['Debit card', 'Credit card', 'Cash', 'Bank transfer', 'UPI / Wallet', 'Other'];
const cats = () => Array.from(new Set([...(Store.settings().expenseCats || DEFAULT_CATS), ...Store.all('expense').map(e => e.category).filter(Boolean)]));
const curMonth = () => F().fmonth || D.month();
const inMonth = (k, m) => (k || '').startsWith(m);

/* ---------- calculations ---------- */
const Fin = LOS.Fin = {
  income: m => sum(Store.all('income').filter(x => inMonth(x.date, m)), x => x.amount),
  expenses: m => sum(Store.all('expense').filter(x => inMonth(x.date, m)), x => x.amount),
  byCat: m => { const g = groupBy(Store.all('expense').filter(x => inMonth(x.date, m)), x => x.category || 'Miscellaneous'); return Object.entries(g).map(([k, v]) => ({label: k, value: sum(v, x => x.amount)})).sort(by(x => x.value, -1)); },
  budgets: m => Store.all('budget').filter(b => b.month === m),
  budgetTotal: m => sum(Fin.budgets(m), b => b.amount),
  loan(l) {
    const pays = (l.payments || []).slice().sort(by(p => p.date));
    const principalPaid = sum(pays, p => num(p.amount) - num(p.interest));
    const paid = sum(pays, p => p.amount);
    const interestPaid = sum(pays, p => p.interest);
    const start = num(l.startBalance ?? l.original);
    const outstanding = Math.max(0, round2(start - principalPaid));
    const original = num(l.original) || start;
    const repaid = round2(original - outstanding);
    const m = D.month();
    const paidThisMonth = sum(pays.filter(p => inMonth(p.date, m)), p => p.amount);
    const recent = pays.filter(p => p.date >= D.add(D.today(), -95));
    const months = new Set(recent.map(p => p.date.slice(0, 7))).size || 1;
    const avg = recent.length ? sum(recent, p => p.amount) / Math.max(months, 1) : 0;
    const P = Math.max(num(l.minPay), avg);
    let payoff = null, monthsLeft = null;
    if (outstanding <= 0) payoff = 'Paid off';
    else if (P > 0) {
      const r = num(l.rate) / 1200;
      if (r === 0) monthsLeft = Math.ceil(outstanding / P);
      else if (P > outstanding * r) monthsLeft = Math.ceil(-Math.log(1 - r * outstanding / P) / Math.log(1 + r));
      if (monthsLeft != null) payoff = D.mname(D.monthAdd(m, monthsLeft), {month: 'short', year: 'numeric'});
      else payoff = 'Payment doesn’t cover interest';
    }
    const dd = num(l.dueDay) || null;
    let nextDue = null;
    if (dd && outstanding > 0) {
      const thisM = D.addMonths(D.monthStart(m), 0, dd), nextM = D.addMonths(D.monthStart(D.monthAdd(m, 1)), 0, dd);
      if (num(l.minPay) > 0) nextDue = paidThisMonth >= num(l.minPay) ? nextM : thisM;
      else nextDue = D.today() <= thisM ? thisM : nextM;
    }
    let bal = start; const trend = pays.map(p => { bal = round2(bal - (num(p.amount) - num(p.interest))); return {date: p.date, bal: Math.max(0, bal)}; });
    return {pays, paid, principalPaid, interestPaid, outstanding, original, repaid, pctRepaid: pct(repaid, original), paidThisMonth, monthPct: pct(paidThisMonth, num(l.minPay)), payoff, monthsLeft, nextDue, trend, P};
  },
  totalDebt: () => sum(Store.all('loan'), l => Fin.loan(l).outstanding),
  billStatus(b) {
    if (b.paid) return 'Paid';
    const t = D.today(); if (b.due < t) return 'Overdue';
    const soon = Math.max(num(b.remindDays) || 0, Store.settings().billSoonDays || 3);
    return D.diff(t, b.due) <= soon ? 'Due Soon' : 'Upcoming';
  }
};
const STATUS_CHIP = {Paid: 'sage', Overdue: 'peach', 'Due Soon': 'butter', Upcoming: 'ghost'};

/* ---------- forms ---------- */
const expenseFields = () => [{k: 'name', label: 'Expense', required: true, ph: 'e.g., Trader Joe’s'}, {k: 'amount', label: 'Amount', type: 'money', required: true, validate: v => num(v) <= 0 ? 'Enter an amount above 0' : ''}, {k: 'date', label: 'Date', type: 'date', required: true}, {k: 'category', label: 'Category', type: 'select', options: cats}, {k: 'method', label: 'Payment method', type: 'select', options: METHODS}, {k: 'recurring', label: 'Type', type: 'select', options: [{v: '', l: 'One-time'}, {v: 'monthly', l: 'Recurring (monthly)'}]}, {k: 'notes', label: 'Notes', type: 'textarea', rows: 2}];
LOS.editExpense = (id, preset = {}) => { const e = id ? Store.get('expense', id) : null; LOS.openForm({title: e ? 'Edit expense' : 'Add expense', fields: expenseFields(), values: e || Object.assign({date: D.today(), category: 'Groceries', method: 'Debit card', recurring: ''}, preset), onSave: d => { Store.put('expense', Object.assign({}, e || {}, d)); if (!e) LOS.toast('Expense added'); checkBudget(d.category, D.month(d.date)); }, onDelete: e ? () => Store.del('expense', e.id) : null}); };
const alertCfg = () => Object.assign({on: true, pct: 80, pace: true, total: true}, Store.settings().budgetAlert || {});
/* Budget health for a month: per-category and overall, including a pace projection ("on track to go over") */
Fin.budgetHealth = (m = D.month()) => {
  const cfg = alertCfg(); const spentBy = Object.fromEntries(Fin.byCat(m).map(x => [x.label, x.value]));
  const isCur = m === D.month(); const dim = D.parse(D.monthEnd(m)).getDate(); const day = isCur ? D.parse(D.today()).getDate() : dim;
  const rows = Fin.budgets(m).filter(b => num(b.amount) > 0).map(b => { const spent = spentBy[b.category] || 0; const p = spent / num(b.amount) * 100; const proj = day >= 5 ? spent / day * dim : spent; return {b, cat: b.category, budget: num(b.amount), spent, p, proj, over: p > 100, near: p >= cfg.pct && p <= 100, pace: cfg.pace && isCur && p < cfg.pct && day >= 5 && proj > num(b.amount) * 1.05}; });
  const tb = sum(rows, r => r.budget), ts = Fin.expenses(m); const tp = tb ? ts / tb * 100 : 0; const tproj = day >= 5 ? ts / day * dim : ts;
  return {cfg, rows, total: {budget: tb, spent: ts, p: tp, proj: tproj, over: tb && tp > 100, near: tb && tp >= cfg.pct && tp <= 100, pace: cfg.pace && isCur && tb && tp < cfg.pct && day >= 5 && tproj > tb * 1.05}};
};
function checkBudget(cat, m) {
  const cfg = alertCfg(); if (!cfg.on) return;
  const h = Fin.budgetHealth(m); const r = h.rows.find(x => x.cat === cat);
  if (r && r.over) LOS.toast(`Heads up: ${cat} is over budget (${Math.round(r.p)}%)`, {ms: 5000});
  else if (r && r.near) LOS.toast(`${cat} has reached ${Math.round(r.p)}% of its budget`, {ms: 5000});
  else if (r && r.pace) LOS.toast(`At this pace ${cat} could reach ${$m(r.proj, {whole: true})} — budget is ${$m(r.budget, {whole: true})}`, {ms: 5000});
  else if (cfg.total && h.total.over) LOS.toast(`You’ve gone over your total monthly budget (${Math.round(h.total.p)}%)`, {ms: 5000});
}
LOS.actions['budget-alert'] = el => { const cur = alertCfg(); const v = el.type === 'checkbox' ? el.checked : +el.value; Store.setSettings({budgetAlert: {...cur, [el.dataset.k]: v}}); };
LOS.editIncome = id => { const e = id ? Store.get('income', id) : null; LOS.openForm({title: e ? 'Edit income' : 'Add income', fields: [{k: 'source', label: 'Source', required: true, ph: 'e.g., Salary, Stipend'}, {k: 'amount', label: 'Amount', type: 'money', required: true, validate: v => num(v) <= 0 ? 'Enter an amount above 0' : ''}, {k: 'date', label: 'Date received', type: 'date', required: true}, {k: 'notes', label: 'Notes', type: 'textarea', rows: 2}], values: e || {date: D.today()}, onSave: d => Store.put('income', Object.assign({}, e || {}, d)), onDelete: e ? () => Store.del('income', e.id) : null}); };
LOS.editLoan = id => {
  const l = id ? Store.get('loan', id) : null;
  LOS.openForm({title: l ? 'Edit loan' : 'Add a loan', size: 'wide', fields: [
    {k: 'name', label: 'Loan name', required: true, ph: 'e.g., Education loan'}, {k: 'lender', label: 'Lender'},
    {k: 'original', label: 'Original loan amount', type: 'money', required: true}, {k: 'startBalance', label: 'Outstanding balance today', type: 'money', required: true, hint: 'Payments you record from now on reduce this.', validate: (v, o) => num(v) > num(o.original) * 1.5 ? 'That’s much higher than the original — double-check?' : ''},
    {k: 'rate', label: 'Interest rate (% per year)', type: 'number', min: 0, max: 100, step: .01}, {k: 'minPay', label: 'Minimum monthly payment', type: 'money'},
    {k: 'dueDay', label: 'Payment due day of month', type: 'number', min: 1, max: 31, step: 1}, {k: 'start', label: 'Loan start date', type: 'date'},
    {k: 'payoffExpected', label: 'Expected payoff date', type: 'date'}, {k: 'notes', label: 'Notes', type: 'textarea', rows: 2}],
    values: l || {}, onSave: d => Store.put('loan', Object.assign({payments: []}, l || {}, d)), onDelete: l ? () => Store.del('loan', l.id) : null});
};
LOS.recordPayment = (loanId, payId) => {
  const l = Store.get('loan', loanId); if (!l) return; const p = payId ? (l.payments || []).find(x => x.id === payId) : null;
  const st = Fin.loan(l);
  LOS.openForm({title: p ? 'Edit payment' : 'Record payment · ' + l.name, fields: [
    {k: 'amount', label: 'Amount paid', type: 'money', required: true, validate: v => num(v) <= 0 ? 'Enter an amount above 0' : ''}, {k: 'date', label: 'Date', type: 'date', required: true},
    {k: 'interest', label: 'Interest portion (from your statement)', type: 'money', hint: num(l.rate) ? `Leave blank if unsure — the full amount reduces principal. At ${l.rate}% the interest this month would be about ${$m(st.outstanding * num(l.rate) / 1200)}.` : 'Leave blank if none.', validate: (v, o) => num(v) > num(o.amount) ? 'Can’t exceed the payment' : ''},
    {k: 'extra', label: '', type: 'check', text: 'This was an additional (extra) payment'}, {k: 'logExpense', label: '', type: 'check', text: 'Also record it as an expense (Loan payment)'}, {k: 'note', label: 'Note', full: true}],
    values: p || {date: D.today(), amount: l.minPay || '', logExpense: false},
    onSave: d => {
      const pay = {id: p ? p.id : uid(), date: d.date, amount: d.amount, interest: d.interest || 0, extra: d.extra, note: d.note};
      const payments = p ? l.payments.map(x => x.id === p.id ? pay : x) : [...(l.payments || []), pay];
      Store.put('loan', {...l, payments});
      if (d.logExpense && !p) Store.put('expense', {id: 'loanpay-' + pay.id, name: l.name + ' payment', amount: d.amount, date: d.date, category: 'Loan payment', method: 'Bank transfer', notes: 'From loan tracker'});
      const after = Fin.loan(Store.get('loan', l.id));
      if (after.outstanding <= 0) { LOS.confetti(120); LOS.toast('Loan paid off! What a milestone ✿'); } else LOS.toast('Payment recorded');
    },
    onDelete: p ? () => Store.put('loan', {...l, payments: l.payments.filter(x => x.id !== p.id)}) : null});
};
LOS.editBill = id => {
  const b = id ? Store.get('bill', id) : null;
  LOS.openForm({title: b ? 'Edit bill' : 'Add bill', fields: [{k: 'name', label: 'Bill', required: true, ph: 'e.g., Electricity'}, {k: 'amount', label: 'Amount', type: 'money', required: true}, {k: 'due', label: 'Due date', type: 'date', required: true}, {k: 'recur', label: 'Repeats', type: 'select', options: [{v: 'none', l: 'One-time'}, {v: 'weekly', l: 'Weekly'}, {v: 'monthly', l: 'Monthly'}, {v: 'quarterly', l: 'Quarterly'}, {v: 'yearly', l: 'Yearly'}]}, {k: 'category', label: 'Category', type: 'select', options: cats}, {k: 'remindDays', label: 'Remind me (days before)', type: 'number', min: 0, max: 60, step: 1}, {k: 'notes', label: 'Notes', type: 'textarea', rows: 2}],
    values: b || {due: D.today(), recur: 'monthly', category: 'Utilities', remindDays: 3}, onSave: d => Store.put('bill', Object.assign({paid: false}, b || {}, d)), onDelete: b ? () => Store.del('bill', b.id) : null});
};
LOS.payBill = id => {
  const b = Store.get('bill', id); if (!b) return;
  LOS.openForm({title: 'Mark as paid · ' + b.name, size: 'narrow', saveLabel: 'Mark paid', fields: [{k: 'paidDate', label: 'Paid on', type: 'date', required: true}, {k: 'amount', label: 'Amount paid', type: 'money', required: true}, {k: 'logExpense', label: '', type: 'check', text: 'Record as an expense'}],
    values: {paidDate: D.today(), amount: b.amount, logExpense: true},
    onSave: d => {
      Store.put('bill', {...b, paid: true, paidDate: d.paidDate, paidAmount: d.amount});
      if (d.logExpense) Store.put('expense', {id: 'bill-' + b.id, name: b.name, amount: d.amount, date: d.paidDate, category: b.category || 'Utilities', method: 'Bank transfer', notes: 'Bill payment'});
      if (b.recur && b.recur !== 'none') {
        const step = {weekly: [0, 7], monthly: [1], quarterly: [3], yearly: [12]}[b.recur];
        const next = step.length === 2 ? D.add(b.due, 7) : D.addMonths(b.due, step[0], b.anchorDay || D.parse(b.due).getDate());
        const series = b.seriesId || b.id; const nid = series + '~' + next;
        if (!Store.get('bill', nid)) Store.put('bill', {...b, id: nid, seriesId: series, anchorDay: b.anchorDay || D.parse(b.due).getDate(), due: next, paid: false, paidDate: null, paidAmount: null, createdAt: null});
      }
      LOS.cheer();
    }});
};
LOS.actions['add-expense'] = () => LOS.editExpense(); LOS.actions['edit-expense'] = el => LOS.editExpense(el.dataset.id);
LOS.actions['add-income'] = () => LOS.editIncome(); LOS.actions['edit-income'] = el => LOS.editIncome(el.dataset.id);
LOS.actions['add-loan'] = () => LOS.editLoan(); LOS.actions['edit-loan'] = el => LOS.editLoan(el.dataset.id);
LOS.actions['pay-loan'] = el => LOS.recordPayment(el.dataset.id, el.dataset.pay);
LOS.actions['del-pay'] = async (el, e) => { e && e.stopPropagation(); if (!(await LOS.confirm('Delete this payment? The loan balance will go back up by its principal.'))) return; const l = Store.get('loan', el.dataset.id); Store.put('loan', {...l, payments: (l.payments || []).filter(p => p.id !== el.dataset.pay)}); LOS.toast('Payment deleted'); };
LOS.actions['clear-budgets'] = async () => { const m = curMonth(); const bs = Fin.budgets(m); if (!bs.length) return; if (!(await LOS.confirm(`Remove all ${bs.length} budgets for ${D.mname(m)}?`))) return; bs.forEach(b => Store.del('budget', b.id)); };
LOS.actions['add-bill'] = () => LOS.editBill(); LOS.actions['edit-bill'] = el => LOS.editBill(el.dataset.id);
LOS.actions['pay-bill'] = el => LOS.payBill(el.dataset.id);
LOS.actions['unpay-bill'] = el => { const b = Store.get('bill', el.dataset.id); Store.put('bill', {...b, paid: false, paidDate: null}); };
LOS.actions.fmonth = el => { const d = +el.dataset.d; F().fmonth = d ? D.monthAdd(curMonth(), d) : D.month(); LOS.render(); };
LOS.actions['edit-budget'] = () => {
  const m = curMonth(); const cur = Object.fromEntries(Fin.budgets(m).map(b => [b.category, b.amount]));
  const fields = cats().map(c => ({k: 'c_' + c.replace(/[^a-z0-9]/gi, '_'), label: c, type: 'money', ph: '0'}));
  const vals = Object.fromEntries(cats().map(c => ['c_' + c.replace(/[^a-z0-9]/gi, '_'), cur[c] ?? '']));
  LOS.openForm({title: 'Budgets · ' + D.mname(m), size: 'wide', fields: [{section: 'Leave blank for categories you don’t budget.'}, ...fields], values: vals,
    onSave: d => { cats().forEach(c => { const v = d['c_' + c.replace(/[^a-z0-9]/gi, '_')]; const id = m + '_' + c.replace(/[^a-z0-9]/gi, '_'); if (v == null || v === '') { if (Store.get('budget', id)) Store.del('budget', id); } else Store.put('budget', {id, month: m, category: c, amount: v}, {silent: true}); }); Store.emit(); LOS.toast('Budgets saved'); }});
};
LOS.actions['copy-budget'] = () => {
  const m = curMonth(), prev = D.monthAdd(m, -1); const pb = Fin.budgets(prev);
  if (!pb.length) { LOS.toast('No budgets last month to copy'); return; }
  pb.forEach(b => Store.put('budget', {id: m + '_' + b.category.replace(/[^a-z0-9]/gi, '_'), month: m, category: b.category, amount: b.amount}, {silent: true})); Store.emit(); LOS.toast('Copied ' + plural(pb.length, 'budget'));
};
LOS.actions['copy-recurring'] = async () => {
  const m = curMonth(); const prev = D.monthAdd(m, -1);
  const rec = Store.all('expense').filter(e => e.recurring === 'monthly' && inMonth(e.date, prev));
  const todo = rec.filter(e => !Store.get('expense', (e.srcId || e.id).split('@')[0] + '@' + m));
  if (!todo.length) { LOS.toast('No new recurring expenses to add for this month'); return; }
  if (!(await LOS.confirm(`Add ${plural(todo.length, 'recurring expense')} from ${D.mname(prev, {month: 'long'})} to ${D.mname(m, {month: 'long'})}? You can edit amounts afterwards.`, {ok: 'Add them', danger: false, title: 'Copy recurring expenses'}))) return;
  todo.forEach(e => { const base = (e.srcId || e.id).split('@')[0]; Store.put('expense', {...e, id: base + '@' + m, srcId: base, date: D.addMonths(e.date, 1), createdAt: null}, {silent: true}); }); Store.emit(); LOS.toast('Added');
};
LOS.actions['add-cat'] = () => LOS.openForm({title: 'Expense categories', fields: [{k: 'cats', label: 'Categories', type: 'list', addLabel: 'Add category'}], values: {cats: cats().map(c => ({id: uid(), t: c}))}, onSave: d => Store.setSettings({expenseCats: d.cats.map(x => x.t)})});
LOS.actions['export-expenses'] = () => LOS.exportFile('expenses.csv', LOS.toCSV(Store.all('expense').sort(by(e => e.date)), [['Date', 'date'], ['Expense', 'name'], ['Category', 'category'], ['Amount', 'amount'], ['Method', 'method'], ['Recurring', 'recurring'], ['Notes', 'notes']]), 'text/csv');

/* ---------- page ---------- */
const monthNav = () => LOS.monthPicker('fmonth', curMonth());
LOS.register('finance', {title: 'Finance Hub', icon: 'wallet',
  render() {
    const tab = LOS.tab('finance', 'overview');
    const tabs = [['overview', 'Overview'], ['expenses', 'Expenses'], ['income', 'Income'], ['budget', 'Budget'], ['bills', 'Bills'], ['loans', 'Loans'], ['savings', 'Savings'], ['reports', 'Reports']];
    return LOS.hero('finance', {title: 'Finance Hub', script: 'money, mindfully', tone: 'butter', sub: 'Only what you enter — no guesses. Everything recalculates as you go.', actions: `<button class="btn" data-action="add-income">${I('plus')} Income</button><button class="btn primary" data-action="add-expense">${I('plus')} Expense</button>`}) + LOS.tabsHtml('finance', tabs, tab) + ({overview, expenses, income, budget, bills, loans, savings, reports})[tab]();
  }
});
function overview() {
  const m = curMonth(); const inc = Fin.income(m), exp = Fin.expenses(m), bud = Fin.budgetTotal(m);
  const upcoming = Store.all('bill').filter(b => !b.paid).sort(by(b => b.due)).slice(0, 5);
  const loans = Store.all('loan');
  return `<div class="toolbar">${monthNav()}</div><div class="stats" style="margin-bottom:18px">
    <div class="stat"><span class="l">Income</span><span class="v">${$m(inc)}</span></div><div class="stat"><span class="l">Expenses</span><span class="v">${$m(exp)}</span></div>
    <div class="stat"><span class="l">Remaining balance</span><span class="v" style="color:${inc - exp < 0 ? 'var(--bad)' : 'var(--brown)'}">${$m(inc - exp)}</span></div>
    <div class="stat"><span class="l">${bud ? 'Budget left' : 'Savings rate'}</span><span class="v">${bud ? $m(bud - exp) : (inc ? Math.round((inc - exp) / inc * 100) + '%' : '—')}</span></div>
    <div class="stat"><span class="l">Total loan balance</span><span class="v">${$m(Fin.totalDebt())}</span></div></div>
  <div class="grid g3"><div class="card span2"><div class="card-h"><h3>Where it went</h3></div>${C.donut({items: Fin.byCat(m), fmt: v => $m(v), center: {v: $m(exp, {whole: true}), l: 'spent'}, emptyMsg: 'Add an expense to see your spending by category.'})}</div>
  <div class="card tint-butter"><div class="card-h"><h3>Upcoming bills</h3><button class="btn sm ghost" data-action="add-bill">${I('plus')}</button></div>${upcoming.length ? upcoming.map(billRow).join('') : LOS.empty('No unpaid bills', 'Add rent, phone, subscriptions…')}</div>
  <div class="card span2"><div class="card-h"><h3>Budget vs actual</h3><button class="btn sm ghost" data-action="tab" data-page="finance" data-tab="budget">Manage</button></div>${budgetBars(m, 6)}</div>
  <div class="card"><div class="card-h"><h3>Loans</h3><button class="btn sm ghost" data-action="tab" data-page="finance" data-tab="loans">All</button></div>${loans.length ? loans.map(l => { const s = Fin.loan(l); return `<div style="margin-bottom:12px"><div class="row between small"><span>${esc(l.name)}</span><b>${$m(s.outstanding)}</b></div>${LOS.bar(s.pctRepaid, 'terra', s.pctRepaid + '% repaid')}<div class="tiny muted" style="margin-top:4px">${s.pctRepaid}% repaid${s.nextDue ? ' · next due ' + D.rel(s.nextDue) : ''}</div></div>`; }).join('') : LOS.empty('No loans added', '', `<button class="btn sm" data-action="add-loan">${I('plus')} Add loan</button>`)}</div></div>`;
}
function budgetBars(m, limit) {
  const bs = Fin.budgets(m); if (!bs.length) return LOS.empty('No budgets for this month', 'Set a monthly amount per category.', `<button class="btn sm" data-action="edit-budget">Set budgets</button>${Fin.budgets(D.monthAdd(m, -1)).length ? ` <button class="btn sm ghost" data-action="copy-budget">Copy last month</button>` : ''}`);
  const spentBy = Object.fromEntries(Fin.byCat(m).map(x => [x.label, x.value]));
  return bs.map(b => ({...b, spent: spentBy[b.category] || 0})).sort(by(b => b.spent / (num(b.amount) || 1), -1)).slice(0, limit || 99).map(b => { const p = num(b.amount) ? Math.round(b.spent / num(b.amount) * 100) : 0; return `<div style="margin-bottom:12px"><div class="row between small"><span>${esc(b.category)} ${p > 100 ? '<span class="chip peach">Over</span>' : p >= 80 ? '<span class="chip butter">Close</span>' : ''}</span><span><b>${$m(b.spent)}</b> <span class="muted">of ${$m(b.amount)} · ${p}%</span></span></div>${LOS.bar(Math.min(p, 100), p > 100 ? 'bad' : p >= 80 ? 'warn' : '')}<div class="tiny muted" style="margin-top:3px">${b.spent > num(b.amount) ? $m(b.spent - num(b.amount)) + ' over' : $m(num(b.amount) - b.spent) + ' remaining'}</div></div>`; }).join('');
}
function expenses() {
  const m = curMonth(); const q = (F().eq || '').toLowerCase(); const cat = F().ecat || '';
  const list = Store.all('expense').filter(e => inMonth(e.date, m) && (!cat || e.category === cat) && (!q || LOS.match(q, e.name, e.notes, e.category))).sort(by(e => e.date + e.createdAt, -1));
  const recPrev = Store.all('expense').some(e => e.recurring === 'monthly' && inMonth(e.date, D.monthAdd(m, -1)));
  return `<div class="toolbar">${monthNav()}<span class="spacer"></span><input class="input" type="search" placeholder="Search…" value="${esc(F().eq || '')}" data-change="fset" data-k="eq" aria-label="Search expenses" style="width:150px"><select class="input" data-change="fset" data-k="ecat" aria-label="Category"><option value="">All categories</option>${cats().map(c => `<option ${c === cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><button class="btn sm ghost" data-action="add-cat">Categories</button>${recPrev ? `<button class="btn sm" data-action="copy-recurring">${I('refresh')} Copy recurring</button>` : ''}<button class="btn sm" data-action="export-expenses">${I('download')} CSV</button><button class="btn sm primary" data-action="add-expense">${I('plus')} Expense</button></div>
  <div class="stats" style="margin-bottom:16px"><div class="stat"><span class="l">Shown</span><span class="v">${$m(sum(list, e => e.amount))}</span></div><div class="stat"><span class="l">Entries</span><span class="v">${list.length}</span></div><div class="stat"><span class="l">Recurring</span><span class="v">${$m(sum(list.filter(e => e.recurring), e => e.amount))}</span></div></div>
  ${list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Expense</th><th>Category</th><th>Method</th><th class="num">Amount</th><th></th></tr></thead><tbody>${list.map(e => `<tr class="clickable" data-action="edit-expense" data-id="${e.id}"><td>${D.fmt(e.date)}</td><td class="wrap">${esc(e.name)} ${e.recurring ? `<span class="chip lav">${I('refresh')}monthly</span>` : ''}${e.notes ? `<div class="tiny muted">${esc(e.notes)}</div>` : ''}</td><td>${esc(e.category)}</td><td>${esc(e.method || '')}</td><td class="num"><b>${$m(e.amount)}</b></td><td style="width:40px">${LOS.delBtn('expense', e.id, 'this expense')}</td></tr>`).join('')}</tbody></table></div>` : `<div class="card">${LOS.empty('No expenses this month', 'Log as you go — it takes ten seconds.', `<button class="btn primary sm" data-action="add-expense">${I('plus')} Add expense</button>`)}</div>`}`;
}
LOS.actions.fset = el => { F()[el.dataset.k] = el.value; LOS.render(); };
function income() {
  const m = curMonth(); const list = Store.all('income').filter(x => inMonth(x.date, m)).sort(by(x => x.date, -1));
  return `<div class="toolbar">${monthNav()}<span class="spacer"></span><button class="btn sm primary" data-action="add-income">${I('plus')} Income</button></div>
  <div class="stats" style="margin-bottom:16px"><div class="stat"><span class="l">Income this month</span><span class="v">${$m(Fin.income(m))}</span></div><div class="stat"><span class="l">Expenses</span><span class="v">${$m(Fin.expenses(m))}</span></div><div class="stat"><span class="l">Net (saved)</span><span class="v">${$m(Fin.income(m) - Fin.expenses(m))}</span></div></div>
  <div class="card">${list.length ? list.map(x => `<div class="item clickable" data-action="edit-income" data-id="${x.id}"><span class="chip sage">${D.fmt(x.date)}</span><span class="grow">${esc(x.source)}${x.notes ? `<div class="tiny muted">${esc(x.notes)}</div>` : ''}</span><b>${$m(x.amount)}</b>${LOS.delBtn('income', x.id, 'this income entry')}</div>`).join('') : LOS.empty('No income recorded this month', 'Add paychecks, stipends or any money in.')}</div>`;
}
function alertCard(m) {
  const cfg = alertCfg(); const h = Fin.budgetHealth(m); const warn = [...h.rows.filter(r => r.over || r.near || r.pace)];
  return `<div class="card tint-butter" style="margin-bottom:18px"><div class="card-h">${I('bell')}<h3>Budget alerts</h3><label class="check small"><input type="checkbox" class="cb" ${cfg.on ? 'checked' : ''} data-change="budget-alert" data-k="on"> On</label></div>
  <div class="row wrap small" style="gap:18px;${cfg.on ? '' : 'opacity:.5'}"><label class="row" style="gap:8px">Alert me when a category reaches <select class="input" style="width:auto;height:32px" data-change="budget-alert" data-k="pct">${[50, 60, 70, 75, 80, 90, 100].map(v => `<option value="${v}" ${v === cfg.pct ? 'selected' : ''}>${v}%</option>`).join('')}</select> of its budget</label>
  <label class="check"><input type="checkbox" class="cb" ${cfg.pace ? 'checked' : ''} data-change="budget-alert" data-k="pace"> Warn me early if my spending pace will go over</label>
  <label class="check"><input type="checkbox" class="cb" ${cfg.total ? 'checked' : ''} data-change="budget-alert" data-k="total"> Also watch my total monthly budget</label></div>
  ${cfg.on && (warn.length || h.total.over || h.total.near || h.total.pace) ? `<div class="divider"></div>${warn.map(r => `<div class="row small" style="margin-bottom:6px"><span class="chip ${r.over ? 'peach' : 'butter'}">${r.over ? 'Over' : r.near ? Math.round(r.p) + '%' : 'Pace'}</span><span>${esc(r.cat)}: ${$m(r.spent)} of ${$m(r.budget)}${r.pace && !r.near && !r.over ? ` — projected ${$m(r.proj, {whole: true})} by month end` : ''}</span></div>`).join('')}${h.total.budget && (h.total.over || h.total.near || h.total.pace) ? `<div class="row small"><span class="chip ${h.total.over ? 'peach' : 'butter'}">Total</span><span>${$m(h.total.spent)} of ${$m(h.total.budget)}${h.total.pace ? ' — projected ' + $m(h.total.proj, {whole: true}) : ''}</span></div>` : ''}` : cfg.on ? `<p class="tiny muted" style="margin:10px 0 0">All budgets look healthy. Alerts appear as a pop-up when you add an expense, and in your notification bell.</p>` : ''}</div>`;
}
function budget() {
  const m = curMonth(); const bud = Fin.budgetTotal(m), exp = Fin.expenses(m);
  return `<div class="toolbar">${monthNav()}<span class="spacer"></span><button class="btn sm ghost" data-action="copy-budget">Copy last month</button>${Fin.budgets(m).length ? `<button class="btn sm ghost danger" data-action="clear-budgets">Clear</button>` : ''}<button class="btn sm primary" data-action="edit-budget">${I('edit')} Set budgets</button></div>
  <div class="stats" style="margin-bottom:16px"><div class="stat"><span class="l">Budget allocated</span><span class="v">${$m(bud)}</span></div><div class="stat"><span class="l">Spent</span><span class="v">${$m(exp)}</span></div><div class="stat"><span class="l">Remaining</span><span class="v">${$m(bud - exp)}</span></div><div class="stat"><span class="l">Utilised</span><span class="v">${bud ? Math.round(exp / bud * 100) + '%' : '—'}</span></div></div>
  ${alertCard(m)}<div class="grid g2"><div class="card"><div class="card-h"><h3>By category</h3></div>${budgetBars(m)}</div><div class="card"><div class="card-h"><h3>Budget vs actual</h3></div>${(() => { const bs = Fin.budgets(m); const spent = Object.fromEntries(Fin.byCat(m).map(x => [x.label, x.value])); return C.bar({labels: bs.map(b => b.category), series: [{name: 'Budget', values: bs.map(b => b.amount), color: '#3577C4'}, {name: 'Spent', values: bs.map(b => spent[b.category] || 0), color: '#D0643F'}], fmt: (v, ax) => $m(v, {whole: ax}), emptyMsg: 'Set budgets to compare.'}); })()}</div></div>`;
}
function billRow(b) {
  const s = Fin.billStatus(b);
  return `<div class="item"><div class="grow clickable" data-action="edit-bill" data-id="${b.id}"><div class="t">${esc(b.name)}</div><div class="meta"><span class="chip ${STATUS_CHIP[s]}">${s}</span><span>${b.paid ? 'Paid ' + D.fmt(b.paidDate) : 'Due ' + D.rel(b.due)}</span>${b.recur && b.recur !== 'none' ? `<span>${I('refresh')} ${esc(b.recur)}</span>` : ''}</div></div><b>${$m(b.paidAmount || b.amount)}</b>${b.paid ? `<button class="btn sm ghost" data-action="unpay-bill" data-id="${b.id}">Undo</button>` : `<button class="btn sm" data-action="pay-bill" data-id="${b.id}">${I('check')} Paid</button>`}${LOS.delBtn('bill', b.id, 'this bill')}</div>`;
}
function bills() {
  const all = Store.all('bill'); const f = F().bstat || 'open';
  const list = all.filter(b => f === 'all' || (f === 'open' ? !b.paid : f === 'paid' ? b.paid : Fin.billStatus(b) === f)).sort(by(b => b.paid ? '9' + b.paidDate : b.due, f === 'paid' ? -1 : 1));
  const counts = s => all.filter(b => Fin.billStatus(b) === s).length;
  return `<div class="toolbar">${LOS.seg('bstat', [['open', 'Unpaid'], ['Overdue', `Overdue (${counts('Overdue')})`], ['Due Soon', `Due soon (${counts('Due Soon')})`], ['Upcoming', 'Upcoming'], ['paid', 'Paid'], ['all', 'All']], f)}<span class="spacer"></span><button class="btn sm primary" data-action="add-bill">${I('plus')} Bill</button></div>
  <div class="card">${list.length ? list.map(billRow).join('') : LOS.empty(all.length ? 'Nothing here' : 'No bills yet', 'Recurring bills create their next due date when you mark them paid.')}</div>`;
}
function loans() {
  const ls = Store.all('loan');
  if (!ls.length) return `<div class="card">${LOS.empty('No loans tracked', 'Add each loan once, then record payments as you make them.', `<button class="btn primary sm" data-action="add-loan">${I('plus')} Add loan</button>`)}</div>`;
  const tot = ls.map(Fin.loan);
  return `<div class="stats" style="margin-bottom:18px"><div class="stat"><span class="l">Total outstanding</span><span class="v">${$m(sum(tot, s => s.outstanding))}</span></div><div class="stat"><span class="l">Recorded payments</span><span class="v">${$m(sum(tot, s => s.paid))}</span></div><div class="stat"><span class="l">Principal repaid overall</span><span class="v">${$m(sum(tot, s => s.repaid))}</span></div><div class="stat"><span class="l">Paid this month</span><span class="v">${$m(sum(tot, s => s.paidThisMonth))}</span></div><div class="row" style="justify-content:flex-end;border:0;background:none"><button class="btn primary sm" data-action="add-loan">${I('plus')} Add loan</button></div></div>
  ${ls.map(l => { const s = Fin.loan(l); return `<div class="card" style="margin-bottom:18px"><div class="card-h"><div class="grow"><h3>${esc(l.name)}</h3><div class="small muted">${esc(l.lender || '')}${l.rate ? ' · ' + l.rate + '% APR' : ''}${l.minPay ? ' · min ' + $m(l.minPay) + '/mo' : ''}${l.dueDay ? ' · due on day ' + l.dueDay : ''}</div></div><button class="btn sm" data-action="edit-loan" data-id="${l.id}" aria-label="Edit loan">${I('edit')}</button>${LOS.delBtn('loan', l.id, 'this loan and its payment history')}<button class="btn sm primary" data-action="pay-loan" data-id="${l.id}">${I('plus')} Record payment</button></div>
  <div class="stats flat" style="margin-bottom:14px"><div class="stat"><span class="v">${$m(s.outstanding)}</span><span class="l">Outstanding</span></div><div class="stat"><span class="v">${$m(s.original)}</span><span class="l">Original</span></div><div class="stat"><span class="v">${s.pctRepaid}%</span><span class="l">Repaid</span></div><div class="stat"><span class="v">${$m(s.paid)}</span><span class="l">Recorded paid</span></div><div class="stat"><span class="v" style="font-size:22px">${esc(s.payoff || '—')}</span><span class="l">Estimated payoff${s.monthsLeft ? ` (${plural(s.monthsLeft, 'month')} at ${$m(s.P)}/mo)` : ''}</span></div></div>
  ${LOS.bar(s.pctRepaid, 'terra thick', s.pctRepaid + '% repaid')}
  ${num(l.minPay) ? `<div class="row small" style="margin-top:12px"><span class="muted">This month:</span><b>${$m(s.paidThisMonth)}</b><span class="muted">of ${$m(l.minPay)} minimum</span><div class="grow">${LOS.bar(s.monthPct, s.monthPct >= 100 ? '' : 'warn')}</div>${s.nextDue ? `<span class="chip ${D.diff(D.today(), s.nextDue) < 0 ? 'peach' : 'ghost'}">Next due ${D.rel(s.nextDue)}</span>` : ''}</div>` : ''}
  <div class="grid g2" style="margin-top:18px"><div><div class="eyebrow" style="margin-bottom:8px">Payment history</div>${(() => { const ms = Array.from({length: 12}, (_, i) => D.monthAdd(D.month(), i - 11)); return C.bar({labels: ms.map(x => D.mname(x, {month: 'short'})), series: [{name: 'Principal', values: ms.map(x => sum(s.pays.filter(p => inMonth(p.date, x)), p => num(p.amount) - num(p.interest))), color: '#159C8C'}, {name: 'Interest', values: ms.map(x => sum(s.pays.filter(p => inMonth(p.date, x)), p => p.interest)), color: '#E0A21A'}], stacked: true, fmt: (v, ax) => $m(v, {whole: ax}), h: 180, emptyMsg: 'Record a payment to start the history.'}); })()}</div>
  <div><div class="eyebrow" style="margin-bottom:8px">Outstanding balance</div>${s.trend.length ? C.line({labels: ['Start', ...s.trend.map(t => D.fmt(t.date))], series: [{name: 'Balance', values: [num(l.startBalance ?? l.original), ...s.trend.map(t => t.bal)], color: '#D0643F'}], fmt: (v, ax) => $m(v, {whole: ax}), h: 180}) : C.empty('Your balance trend appears after the first payment.')}</div></div>
  ${s.pays.length ? `<details style="margin-top:12px"><summary class="small" style="cursor:pointer">All payments (${s.pays.length})</summary><div class="table-wrap" style="margin-top:8px"><table class="tbl"><thead><tr><th>Date</th><th class="num">Amount</th><th class="num">Interest</th><th class="num">Principal</th><th>Note</th><th></th></tr></thead><tbody>${s.pays.slice().reverse().map(p => `<tr class="clickable" data-action="pay-loan" data-id="${l.id}" data-pay="${p.id}"><td>${D.fmt(p.date, {month: 'short', day: 'numeric', year: 'numeric'})}${p.extra ? ' <span class="chip sage">extra</span>' : ''}</td><td class="num">${$m(p.amount)}</td><td class="num">${$m(p.interest)}</td><td class="num">${$m(num(p.amount) - num(p.interest))}</td><td>${esc(p.note || '')}</td><td style="width:40px"><button class="icon-btn sm del" data-action="del-pay" data-id="${l.id}" data-pay="${p.id}" aria-label="Delete payment">${I('trash')}</button></td></tr>`).join('')}</tbody></table></div></details>` : ''}</div>`; }).join('')}`;
}
/* ---------- savings ---------- */
Fin.pot = p => { const es = (p.entries || []).slice().sort(by(e => e.date)); const saved = round2(sum(es, e => e.amount)); const target = num(p.target); const left = Math.max(0, round2(target - saved));
  const monthsLeft = p.targetDate ? Math.max(1, (D.parse(p.targetDate).getFullYear() - new Date().getFullYear()) * 12 + D.parse(p.targetDate).getMonth() - new Date().getMonth()) : null;
  return {es, saved, target, left, pct: target ? pct(saved, target) : 0, perMonth: monthsLeft && left ? round2(left / monthsLeft) : 0, thisMonth: sum(es.filter(e => inMonth(e.date, D.month())), e => e.amount)}; };
Fin.totalSaved = () => sum(Store.all('savepot'), p => Fin.pot(p).saved);
LOS.editPot = id => { const p = id ? Store.get('savepot', id) : null;
  LOS.openForm({title: p ? 'Edit savings goal' : 'New savings pot', fields: [{k: 'name', label: 'Name', required: true, ph: 'e.g., Emergency fund, Trip to Japan'}, {k: 'target', label: 'Target amount', type: 'money', hint: 'Leave blank for an open-ended pot'}, {k: 'targetDate', label: 'Target date', type: 'date'}, {k: 'opening', label: p ? 'Starting balance (already saved)' : 'Already saved (optional)', type: 'money', hint: p ? 'Changing this edits the opening entry' : ''}, {k: 'color', label: 'Colour', type: 'color'}, {k: 'notes', label: 'Notes', type: 'textarea', rows: 2}],
    values: p ? {...p, opening: ((p.entries || []).find(e => e.id === 'opening') || {}).amount} : {color: '#8A9A7E'},
    onSave: d => { const entries = (p && p.entries || []).filter(e => e.id !== 'opening'); if (num(d.opening) > 0) entries.unshift({id: 'opening', date: (p && (p.entries || []).find(e => e.id === 'opening') || {}).date || D.today(), amount: d.opening, note: 'Starting balance'}); const {opening, ...rest} = d; Store.put('savepot', {...(p || {}), ...rest, entries}); },
    onDelete: p ? () => Store.del('savepot', p.id) : null}); };
LOS.savingEntry = (potId, withdraw, entryId) => { const p = Store.get('savepot', potId); if (!p) return; const e = entryId ? (p.entries || []).find(x => x.id === entryId) : null;
  LOS.openForm({title: e ? 'Edit entry' : (withdraw ? 'Withdraw from ' : 'Add to ') + p.name, size: 'narrow', fields: [{k: 'amount', label: 'Amount', type: 'money', required: true, validate: v => num(v) <= 0 ? 'Enter an amount above 0' : (withdraw || (e && e.amount < 0)) && num(v) > Fin.pot(p).saved + (e ? Math.abs(e.amount) : 0) ? 'That’s more than is in this pot' : ''}, {k: 'date', label: 'Date', type: 'date', required: true}, {k: 'note', label: 'Note'}],
    values: e ? {...e, amount: Math.abs(e.amount)} : {date: D.today()},
    onSave: d => { const neg = withdraw || (e && e.amount < 0); const entry = {id: e ? e.id : uid(), date: d.date, amount: neg ? -d.amount : d.amount, note: d.note}; const entries = e ? p.entries.map(x => x.id === e.id ? entry : x) : [...(p.entries || []), entry]; const before = Fin.pot(p); Store.put('savepot', {...p, entries}); const after = Fin.pot({...p, entries}); if (after.target && before.saved < after.target && after.saved >= after.target) { LOS.confetti(140); LOS.toast(`${p.name} is fully funded! ✿`); } else LOS.toast(neg ? 'Withdrawal recorded' : 'Saved ✿'); },
    onDelete: e ? () => Store.put('savepot', {...p, entries: p.entries.filter(x => x.id !== e.id)}) : null}); };
LOS.actions['add-pot'] = () => LOS.editPot(); LOS.actions['edit-pot'] = el => LOS.editPot(el.dataset.id);
LOS.actions['pot-add'] = el => LOS.savingEntry(el.dataset.id, false); LOS.actions['pot-withdraw'] = el => LOS.savingEntry(el.dataset.id, true);
LOS.actions['pot-entry'] = el => LOS.savingEntry(el.dataset.id, false, el.dataset.eid);
LOS.actions['del-pot-entry'] = async el => { if (!(await LOS.confirm('Delete this entry? The pot balance will update.'))) return; const p = Store.get('savepot', el.dataset.id); Store.put('savepot', {...p, entries: (p.entries || []).filter(x => x.id !== el.dataset.eid)}); };
function savings() {
  const pots = Store.all('savepot').sort(by(p => p.createdAt)); const m = D.month();
  const all = pots.flatMap(p => (p.entries || []).map(e => ({...e, p})));
  const months = Array.from({length: 12}, (_, i) => D.monthAdd(m, i - 11));
  const net = Fin.income(m) - Fin.expenses(m);
  let run = sum(all.filter(e => e.date < D.monthStart(months[0])), e => e.amount);
  const cum = months.map(x => { run += sum(all.filter(e => inMonth(e.date, x)), e => e.amount); return round2(run); });
  const fmt = (v, ax) => $m(v, {whole: ax});
  return `<div class="stats" style="margin-bottom:18px"><div class="stat"><span class="l">Total saved</span><span class="v">${$m(Fin.totalSaved())}</span></div><div class="stat"><span class="l">Put away this month</span><span class="v">${$m(sum(all.filter(e => inMonth(e.date, m)), e => e.amount))}</span></div><div class="stat"><span class="l">Net this month</span><span class="v" style="color:${net < 0 ? 'var(--bad)' : 'var(--brown)'}">${$m(net)}</span></div><div class="stat"><span class="l">Savings pots</span><span class="v">${pots.length}</span></div><div class="row" style="justify-content:flex-end;border:0;background:none"><button class="btn primary sm" data-action="add-pot">${I('plus')} Savings pot</button></div></div>
  ${pots.length ? `<div class="grid g3" style="margin-bottom:18px">${pots.map(p => { const x = Fin.pot(p); return `<div class="card hover"><div class="card-h"><span style="width:12px;height:12px;border-radius:4px;background:${esc(p.color || '#8A9A7E')}"></span><h3 class="clickable" data-action="edit-pot" data-id="${p.id}">${esc(p.name)}</h3><button class="icon-btn sm" data-action="edit-pot" data-id="${p.id}" aria-label="Edit">${I('edit')}</button>${LOS.delBtn('savepot', p.id, 'this savings pot and its history')}</div>
    <div class="row" style="align-items:baseline;gap:8px"><span style="font:700 28px var(--serif)">${$m(x.saved)}</span>${x.target ? `<span class="muted small">of ${$m(x.target)}</span>` : ''}</div>
    ${x.target ? `<div style="margin:10px 0 6px">${LOS.bar(x.pct, '', x.pct + '%')}</div><div class="tiny muted">${x.pct}%${x.left ? ` · ${$m(x.left)} to go` : ' · fully funded ✿'}${p.targetDate ? ` · by ${D.fmt(p.targetDate, {month: 'short', year: 'numeric'})}` : ''}${x.perMonth ? ` · about ${$m(x.perMonth)}/month` : ''}</div>` : '<div class="tiny muted" style="margin-top:6px">Open-ended pot</div>'}
    <div class="row" style="margin-top:12px"><button class="btn sm primary" data-action="pot-add" data-id="${p.id}">${I('plus')} Add money</button><button class="btn sm" data-action="pot-withdraw" data-id="${p.id}">Withdraw</button></div>
    ${x.es.length ? `<details style="margin-top:10px"><summary class="tiny muted" style="cursor:pointer">History (${x.es.length})</summary>${x.es.slice().reverse().map(e => `<div class="item" style="padding:5px 2px"><span class="grow tiny clickable" data-action="pot-entry" data-id="${p.id}" data-eid="${e.id}">${esc(D.fmt(e.date, {month: 'short', day: 'numeric', year: 'numeric'}))}${e.note ? ' · ' + esc(e.note) : ''}</span><b class="tiny" style="color:${e.amount < 0 ? 'var(--bad)' : 'var(--good)'}">${e.amount < 0 ? '−' : '+'}${$m(Math.abs(e.amount))}</b><button class="icon-btn sm del" data-action="del-pot-entry" data-id="${p.id}" data-eid="${e.id}" aria-label="Delete entry">${I('trash')}</button></div>`).join('')}</details>` : ''}</div>`; }).join('')}</div>
  <div class="grid g2"><div class="card"><div class="card-h"><h3>Total savings over time</h3></div>${C.line({labels: months.map(x => D.mname(x, {month: 'short'})), series: [{name: 'Total saved', values: cum, color: '#5E7F55'}], fmt})}</div>
  <div class="card"><div class="card-h"><h3>Monthly contributions</h3></div>${C.bar({labels: months.map(x => D.mname(x, {month: 'short'})), series: [{name: 'Added', values: months.map(x => sum(all.filter(e => inMonth(e.date, x) && e.amount > 0), e => e.amount)), color: '#5E7F55'}, {name: 'Withdrawn', values: months.map(x => -sum(all.filter(e => inMonth(e.date, x) && e.amount < 0), e => e.amount)), color: '#D0643F'}], fmt})}</div></div>` : `<div class="card">${LOS.empty('Start a savings pot', 'Emergency fund, a trip, a new laptop — give each goal its own pot and add money as you go.', `<button class="btn primary sm" data-action="add-pot">${I('plus')} New savings pot</button>`)}</div>`}`;
}
LOS.notifProviders.push(() => Store.all('savepot').filter(p => p.targetDate && num(p.target)).map(p => ({p, x: Fin.pot(p)})).filter(({p, x}) => x.left > 0 && p.targetDate >= D.today() && p.targetDate <= D.add(D.today(), 30)).map(({p, x}) => ({key: 'pot-' + p.id + p.targetDate, cat: 'bills', icon: 'wallet', tone: 'sage', title: `${p.name}: ${$m(x.left)} to go`, body: `Target date ${D.rel(p.targetDate).toLowerCase()} · ${x.pct}% saved`, route: 'finance', tab: 'savings'})));
LOS.quick.push({label: 'Add to savings', icon: 'wallet', open: () => { const ps = Store.all('savepot'); if (ps.length === 1) LOS.savingEntry(ps[0].id, false); else LOS.go('finance', {tab: 'savings'}); }});
LOS.financeCharts = (months) => {
  const inc = months.map(Fin.income), exp = months.map(Fin.expenses);
  return {inc, exp, labels: months.map(m => D.mname(m, {month: 'short'})), net: months.map((m, i) => round2(inc[i] - exp[i]))};
};
function reports() {
  const m = curMonth(); const months = Array.from({length: 12}, (_, i) => D.monthAdd(m, i - 11)); const six = months.slice(6);
  const fc = LOS.financeCharts(months); const f6 = LOS.financeCharts(six);
  const fmt = (v, ax) => $m(v, {whole: ax});
  const ls = Store.all('loan');
  return `<div class="toolbar">${monthNav()}<span class="spacer"></span><button class="btn sm" data-action="export-expenses">${I('download')} Export expenses</button></div>
  <div class="grid g2"><div class="card"><div class="card-h"><h3>Category breakdown · ${D.mname(m, {month: 'long'})}</h3></div>${C.donut({items: Fin.byCat(m), fmt: v => $m(v), center: {v: $m(Fin.expenses(m), {whole: true}), l: 'total'}})}</div>
  <div class="card"><div class="card-h"><h3>Income vs expenses</h3></div>${C.bar({labels: f6.labels, series: [{name: 'Income', values: f6.inc, color: '#159C8C'}, {name: 'Expenses', values: f6.exp, color: '#D0643F'}], fmt})}</div>
  <div class="card"><div class="card-h"><h3>Monthly spending trend</h3></div>${C.line({labels: fc.labels, series: [{name: 'Spending', values: fc.exp, color: '#D0643F'}], fmt})}</div>
  <div class="card"><div class="card-h"><h3>Savings trend (income − expenses)</h3></div>${C.bar({labels: fc.labels, series: [{name: 'Net saved', values: fc.net.map(v => Math.max(0, v)), color: '#3F8F3F'}], fmt, emptyMsg: 'Add income and expenses to see what you keep each month.'})}${fc.net.some(v => v < 0) ? `<p class="tiny muted">Months where spending exceeded income show as 0 here: ${fc.labels.filter((_, i) => fc.net[i] < 0).join(', ')}.</p>` : ''}</div>
  <div class="card spanall"><div class="card-h"><h3>Loan repayment progress</h3></div>${C.hbar({items: ls.map(l => { const s = Fin.loan(l); return {label: l.name, value: s.repaid, max: s.original, text: `${s.pctRepaid}% · ${$m(s.outstanding)} left`}; }), emptyMsg: 'No loans yet.'})}</div></div>`;
}

/* ---------- widget, calendar, notifications, search, quick add ---------- */
LOS.widgets.finance = {title: 'Money this month', tone: 'butter', link: ['finance', 'Finance'], render() {
  const m = D.month(); const inc = Fin.income(m), exp = Fin.expenses(m), bud = Fin.budgetTotal(m);
  const up = Store.all('bill').filter(b => !b.paid).sort(by(b => b.due)).slice(0, 3);
  return `<div class="stats flat" style="grid-template-columns:1fr 1fr;gap:12px"><div class="stat"><span class="v" style="font-size:24px">${$m(Fin.totalDebt(), {whole: true})}</span><span class="l">Loan balance</span></div><div class="stat"><span class="v" style="font-size:24px">${$m(exp, {whole: true})}</span><span class="l">Spent this month</span></div><div class="stat"><span class="v" style="font-size:24px">${bud ? $m(bud - exp, {whole: true}) : inc ? $m(inc - exp, {whole: true}) : '—'}</span><span class="l">${bud ? 'Budget remaining' : 'Income left'}</span></div><div class="stat"><span class="v" style="font-size:24px">${up.length}</span><span class="l">Unpaid bills</span></div>${Store.all('savepot').length ? `<div class="stat"><span class="v" style="font-size:24px">${$m(Fin.totalSaved(), {whole: true})}</span><span class="l">Total saved</span></div>` : ''}</div>
  ${up.length ? `<div class="divider"></div>${up.map(b => `<div class="row small" style="margin-bottom:6px"><span class="chip ${STATUS_CHIP[Fin.billStatus(b)]}">${D.rel(b.due)}</span><span class="grow">${esc(b.name)}</span><b>${$m(b.amount)}</b></div>`).join('')}` : ''}`;
}};
LOS.calProviders.push((from, to) => Store.all('bill').filter(b => !b.paid && D.inR(b.due, [from, to])).map(b => ({key: 'bill:' + b.id, date: b.due, title: b.name + ' · ' + $m(b.amount), type: 'bill', cls: 'bill', label: 'Bill', open: () => LOS.payBill(b.id)})));
LOS.calProviders.push((from, to) => Store.all('loan').map(l => ({l, s: Fin.loan(l)})).filter(x => x.s.nextDue && D.inR(x.s.nextDue, [from, to])).map(({l, s}) => ({key: 'loan:' + l.id, date: s.nextDue, title: l.name + ' payment', type: 'bill', cls: 'bill', label: 'Loan', open: () => LOS.recordPayment(l.id)})));
LOS.notifProviders.push(() => {
  const out = [];
  Store.all('bill').filter(b => !b.paid).forEach(b => { const s = Fin.billStatus(b); if (s === 'Overdue' || s === 'Due Soon') out.push({key: 'bill-' + b.id + s, cat: 'bills', icon: 'wallet', tone: s === 'Overdue' ? 'peach' : 'butter', title: `${b.name} ${s === 'Overdue' ? 'was due ' + D.rel(b.due).toLowerCase() : 'is due ' + D.rel(b.due).toLowerCase()}`, body: $m(b.amount), open: () => LOS.payBill(b.id)}); });
  Store.all('loan').forEach(l => { const s = Fin.loan(l); if (s.nextDue && D.diff(D.today(), s.nextDue) <= 5 && s.monthPct < 100) out.push({key: 'loan-' + l.id + s.nextDue, cat: 'loans', icon: 'wallet', tone: 'butter', title: `${l.name} payment due ${D.rel(s.nextDue).toLowerCase()}`, body: l.minPay ? `Minimum ${$m(l.minPay)} · ${$m(s.paidThisMonth)} paid so far this month` : '', open: () => LOS.recordPayment(l.id)}); });
  const m = D.month(); const spent = Object.fromEntries(Fin.byCat(m).map(x => [x.label, x.value]));
  const bh = Fin.budgetHealth(m);
  if (bh.cfg.on) {
    bh.rows.forEach(r => { if (r.over || r.near || r.pace) out.push({key: 'budget-' + r.b.id + (r.over ? 'over' : r.near ? 'near' + bh.cfg.pct : 'pace'), cat: 'bills', icon: 'chart', tone: r.over ? 'peach' : 'butter', title: r.over ? `${r.cat} is over budget` : r.near ? `${r.cat} has reached ${Math.round(r.p)}% of its budget` : `${r.cat} is on pace to go over`, body: r.pace && !r.near && !r.over ? `${$m(r.spent)} so far · projected ${$m(r.proj, {whole: true})} vs ${$m(r.budget)} budget` : `${$m(r.spent)} of ${$m(r.budget)} (${Math.round(r.p)}%)`, route: 'finance', tab: 'budget'}); });
    const t = bh.total; if (bh.cfg.total && t.budget && (t.over || t.near || t.pace)) out.push({key: 'budget-total-' + m + (t.over ? 'over' : t.near ? 'near' : 'pace'), cat: 'bills', icon: 'wallet', tone: t.over ? 'peach' : 'butter', title: t.over ? 'Total monthly budget exceeded' : t.near ? `You’ve used ${Math.round(t.p)}% of this month’s budget` : 'This month’s spending is on pace to go over budget', body: `${$m(t.spent)} of ${$m(t.budget)}${t.pace && !t.near && !t.over ? ' · projected ' + $m(t.proj, {whole: true}) : ''}`, route: 'finance', tab: 'budget'});
  }
  return out;
});
LOS.searchProviders.push(q => Store.all('expense').filter(e => LOS.match(q, e.name, e.notes, e.category)).map(e => ({icon: 'wallet', title: e.name, sub: `Expense · ${$m(e.amount)} · ${D.fmt(e.date)}`, open: () => LOS.editExpense(e.id)})));
LOS.searchProviders.push(q => [...Store.all('bill').map(b => ({icon: 'wallet', title: b.name, sub: 'Bill · due ' + D.fmt(b.due), open: () => LOS.editBill(b.id), s: b.name})), ...Store.all('loan').map(l => ({icon: 'wallet', title: l.name, sub: 'Loan · ' + (l.lender || ''), open: () => LOS.go('finance', {tab: 'loans'}), s: l.name + l.lender}))].filter(x => LOS.match(q, x.s)));
LOS.quick.push({label: 'Expense', icon: 'wallet', open: () => LOS.editExpense()});
LOS.quick.push({label: 'Loan payment', icon: 'wallet', open: () => { const ls = Store.all('loan'); if (!ls.length) { LOS.editLoan(); return; } if (ls.length === 1) LOS.recordPayment(ls[0].id); else LOS.go('finance', {tab: 'loans'}); }});
})();
