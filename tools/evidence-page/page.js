// Browser script for the parity evidence page. tools/build-reports.mjs inlines it after `const DATA = {…}`;
// every figure it shows comes from DATA, which the build derives from the CI run's own reports.
const S = [
  { id: 'core', label: 'Core', how: 'Domain engine, in-process' },
  { id: 'api', label: 'API', how: 'Node.js REST service over HTTP' },
  { id: 'angular', label: 'Angular', how: 'Angular SPA in Chromium' },
  { id: 'nextjs', label: 'Next.js', how: 'Next.js BFF in Chromium' },
];
const FOLDERS = [['all', 'All'], ['domain-rules', 'Domain rules'], ['workflows', 'Workflows'], ['ui-only', 'UI only']];
const REPORT = (s) => `${s}/index.html`;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const $ = (id) => document.getElementById(id);

// Status and provenance
const pass = DATA.meta.parity === 'PASS';
$('verdict').className = `pill ${pass ? 'pass' : 'fail'}`;
$('verdict').textContent = `PARITY ${DATA.meta.parity}`;
const execs = DATA.rows.reduce((n, r) => n + Object.keys(r.res).length, 0);
const passed = DATA.rows.reduce((n, r) => n + Object.values(r.res).filter((v) => v === 'PASSED').length, 0);
$('tally').textContent = `${DATA.rows.length} scenarios · ${execs} executions · ${passed} passed · ${execs - passed} not passed`;
$('provenance').innerHTML = [
  DATA.meta.sha ? `commit <a href="https://github.com/${esc(DATA.meta.repo)}/commit/${esc(DATA.meta.sha)}">${esc(DATA.meta.sha.slice(0, 7))}</a>` : 'local build',
  DATA.meta.runId ? `<a href="https://github.com/${esc(DATA.meta.repo)}/actions/runs/${esc(DATA.meta.runId)}">run ${esc(DATA.meta.runId)}</a>` : null,
  esc(DATA.meta.generated),
].filter(Boolean).join(' · ');

// Hero bench
const folderOf = ['domain-rules', 'workflows', 'ui-only'];
$('bench').innerHTML = S.map((s) => {
  const run = DATA.rows.filter((r) => r.res[s.id]);
  const ok = run.filter((r) => r.res[s.id] === 'PASSED').length;
  const bars = folderOf.map((f) => {
    const n = DATA.rows.filter((r) => r.folder === f).length;
    const on = run.some((r) => r.folder === f);
    return `<span class="${on ? '' : 'off'}" style="flex:${n}" title="${f}: ${on ? 'runs' : 'outside reach'}"></span>`;
  }).join('');
  return `<div class="lane lane-${s.id}"><span class="label">${s.label}</span><span class="how">${s.how}</span>
    <span class="count num">${ok}<small> / ${run.length} passed</small></span><div class="reach" aria-hidden="true">${bars}</div></div>`;
}).join('');

// Parity matrix
let folder = 'all', query = '';
const openFeat = new Set(['authorisation-enforcement']);
$('folders').innerHTML = FOLDERS.map(([k, l]) => {
  const n = k === 'all' ? DATA.rows.length : DATA.rows.filter((r) => r.folder === k).length;
  return `<button type="button" data-f="${k}" aria-pressed="${k === 'all'}">${l} <span class="num">${n}</span></button>`;
}).join('');
$('folders').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  folder = b.dataset.f;
  $('folders').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  renderMatrix();
});
$('q').addEventListener('input', (e) => { query = e.target.value.trim().toLowerCase(); renderMatrix(); });
function markFor(v) {
  if (!v) return '<i class="mark n" aria-label="outside reach">·</i>';
  return v === 'PASSED' ? '<i class="mark p" aria-label="passed">✓</i>' : `<i class="mark f" aria-label="${esc(v)}">✗</i>`;
}
const stepHtml = (s) => esc(s).replace(/^(Given|When|Then|And|But)\b/, '<b>$1</b>');
function renderMatrix() {
  const rows = DATA.rows.filter((r) => (folder === 'all' || r.folder === folder) &&
    (!query || (r.name + ' ' + r.steps.join(' ') + ' ' + DATA.titles[r.feature]).toLowerCase().includes(query)));
  const feats = [...new Set(rows.map((r) => r.feature))];
  let html = '';
  feats.forEach((f) => {
    const fr = rows.filter((r) => r.feature === f);
    const open = openFeat.has(f) || !!query;
    html += `<tr class="feat" data-f="${f}" data-open="${open}"><td><button class="fname" type="button" aria-expanded="${open}">${esc(DATA.titles[f] || f)} <span class="num" style="color:var(--muted);font-weight:400">(${fr.length})</span></button><span class="folder">${fr[0].folder}</span></td>` +
      S.map((s) => {
        const run = fr.filter((r) => r.res[s.id]);
        const ok = run.filter((r) => r.res[s.id] === 'PASSED').length;
        if (!run.length) return '<td class="cell na" title="outside reach">·</td>';
        return `<td class="cell num${ok < run.length ? ' bad' : ''}" title="${ok} of ${run.length} passed">${ok}/${run.length} ${ok === run.length ? '✓' : '✗'}</td>`;
      }).join('') + '</tr>';
    if (!open) return;
    fr.forEach((r) => {
      html += `<tr class="sc" data-i="${DATA.rows.indexOf(r)}" data-open="false"><td><button class="name" type="button" aria-expanded="false">${esc(r.name)}</button></td>` +
        S.map((s) => `<td class="cell">${markFor(r.res[s.id])}</td>`).join('') + '</tr>';
    });
  });
  if (!rows.length) html = '<tr><td colspan="5" style="padding:1rem .75rem;color:var(--muted)">No scenarios match that filter.</td></tr>';
  document.querySelector('#mtable tbody').innerHTML = html;
  $('mcount').textContent = `${rows.length} of ${DATA.rows.length} scenarios in ${feats.length} features`;
  $('expall').textContent = feats.length && feats.every((f) => openFeat.has(f)) ? 'Collapse all' : 'Expand all';
}
$('expall').addEventListener('click', () => {
  const feats = [...new Set(DATA.rows.filter((r) => folder === 'all' || r.folder === folder).map((r) => r.feature))];
  const all = feats.every((f) => openFeat.has(f));
  feats.forEach((f) => (all ? openFeat.delete(f) : openFeat.add(f)));
  renderMatrix();
});
document.querySelector('#mtable tbody').addEventListener('click', (e) => {
  const fb = e.target.closest('button.fname');
  if (fb) {
    const f = fb.closest('tr.feat').dataset.f;
    openFeat.has(f) ? openFeat.delete(f) : openFeat.add(f);
    renderMatrix();
    return;
  }
  const btn = e.target.closest('button.name'); if (!btn) return;
  const tr = btn.closest('tr.sc'); const r = DATA.rows[+tr.dataset.i];
  const open = tr.dataset.open === 'true';
  if (open) { if (tr.nextElementSibling?.classList.contains('detail')) tr.nextElementSibling.remove(); }
  else {
    const d = document.createElement('tr'); d.className = 'detail';
    const links = S.filter((s) => r.res[s.id] && DATA.reports[s.id]).map((s) => `<a href="${REPORT(s.id)}">${s.label} report</a>`).join('');
    d.innerHTML = `<td colspan="5"><div class="gherkin">${r.steps.map(stepHtml).join('\n')}</div>
      <div class="detail-links"><span>${esc(r.folder)}/${esc(r.feature)}.feature</span>${links}</div></td>`;
    tr.after(d);
  }
  tr.dataset.open = String(!open); btn.setAttribute('aria-expanded', String(!open));
});
renderMatrix();

// Same step, four surfaces: prose here, code extracted from the harness source at build time
const IMPL_TEXT = {
  core: 'Calls the engine in the same process. A domain refusal is re-thrown as the same Refusal the API would return, so outcome steps cannot tell the difference.',
  api: 'Sends the command over HTTP to the Node.js service, signed in as that member of staff.',
  angular: 'Opens the application in the SPA, requires the Approve button to be on offer, clicks it, and waits for the API call it triggers.',
  nextjs: 'The same browser ability on the server-rendered BFF. The click submits a Server Action, and the outcome arrives in the post/redirect/get target (DR-017).',
};
let cur = 'core';
$('impltabs').innerHTML = S.map((s) => `<button type="button" role="tab" class="lane-${s.id}" data-s="${s.id}" aria-selected="${s.id === cur}">${s.label}</button>`).join('');
function renderImpl() {
  const s = S.find((x) => x.id === cur), m = DATA.impl[cur];
  const p = $('implpanel'); p.className = `panel impl lane-${cur}`;
  p.innerHTML = `<span class="eyebrow">${esc(s.label)} ability</span><p>${esc(IMPL_TEXT[cur])}</p><pre class="code">${esc(m.code)}</pre><span class="where mono">${esc(m.where)}</span>`;
}
$('impltabs').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return; cur = b.dataset.s;
  $('impltabs').querySelectorAll('button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  renderImpl();
});
renderImpl();

// Authorisation
const reasons = [...new Set(DATA.forced.map((f) => f.reason))];
let reason = null;
$('reasons').innerHTML = `<button type="button" data-r="" aria-pressed="true">All ${DATA.forced.length}</button>` +
  reasons.map((r) => `<button type="button" data-r="${esc(r)}" aria-pressed="false">${esc(r)} ${DATA.forced.filter((f) => f.reason === r).length}</button>`).join('');
$('reasons').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return; reason = b.dataset.r || null;
  $('reasons').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  renderForced();
});
function renderForced() {
  const rows = DATA.forced.filter((f) => !reason || f.reason === reason);
  document.querySelector('#ftable tbody').innerHTML = rows.map((f) =>
    `<tr><td>${esc(f.name)}<span class="role">${esc(DATA.titles[f.feature] || f.feature)}</span></td>
      <td>${esc(f.who)}<span class="role">${esc(f.role)}</span></td><td class="mono">${esc(f.command)}</td>
      <td><span class="code-pill">${esc(f.reason)}</span></td>` +
    ['api', 'angular', 'nextjs'].map((s) => `<td class="c">${markFor(f.res[s])}</td>`).join('') + '</tr>').join('');
  const n = rows.reduce((k, f) => k + Object.keys(f.res).length, 0);
  const ok = rows.reduce((k, f) => k + Object.values(f.res).filter((v) => v === 'PASSED').length, 0);
  $('fcount').textContent = `${rows.length} forced-command scenarios · ${ok} of ${n} executions refused correctly`;
}
renderForced();

// Timings: this run beside the Phase 4 medians
const METRICS = [['suite', 'Suite time', 0, 's'], ['p50', 'Scenario p50', 1, 'ms'], ['p95', 'Scenario p95', 2, 'ms']];
let metric = 'suite';
$('metric').innerHTML = METRICS.map(([k, l]) => `<button type="button" data-m="${k}" aria-pressed="${k === metric}">${l}</button>`).join('');
$('metric').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return; metric = b.dataset.m;
  $('metric').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  renderChart();
});
function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p; return 10 * p; }
function renderChart() {
  const [, label, col, unit] = METRICS.find((m) => m[0] === metric);
  const series = S.map((s) => ({ s, run: DATA.runTimings[s.id]?.[col] ?? null, med: DATA.medians[s.id][col] }));
  const max = niceMax(Math.max(...series.flatMap((x) => [x.run ?? 0, x.med])));
  const W = 560, rowH = 56, left = 78, right = 74, top = 8, H = top + rowH * S.length + 26;
  const x = (v) => left + (v / max) * (W - left - right);
  const fmt = (v) => `${v.toLocaleString('en-GB')} ${unit}`;
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i, xx = x(v);
    g += `<line class="grid" x1="${xx}" x2="${xx}" y1="${top}" y2="${top + rowH * S.length}"/><text x="${xx}" y="${H - 6}" text-anchor="middle">${+v.toFixed(1)}${unit === 's' ? ' s' : ''}</text>`;
  }
  series.forEach(({ s, run, med }, i) => {
    const y = top + i * rowH + 8;
    g += `<text class="lab" x="0" y="${y + 17}">${s.label}</text>`;
    if (run !== null) g += `<rect x="${left}" y="${y}" width="${Math.max(2, x(run) - left)}" height="18" rx="3" fill="var(--s-${s.id})"/><text class="val" x="${x(run) + 6}" y="${y + 13}">${fmt(run)}</text>`;
    g += `<rect x="${left}" y="${y + 22}" width="${Math.max(2, x(med) - left)}" height="10" rx="2" fill="var(--na)"/><text x="${x(med) + 6}" y="${y + 31}">${fmt(med)} median</text>`;
  });
  $('chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label} by surface: this run and the ten-run median">${g}</svg>
    <p style="font-size:.8rem;color:var(--muted);margin-top:.4rem">Coloured bar: this run. Grey bar: median of the ten Phase 4 runs.</p>`;
}
renderChart();
$('evcommit').textContent = DATA.evidenceCommit.slice(0, 7);
$('runstrip').innerHTML = DATA.runs.map((r) => `<a href="https://github.com/${esc(DATA.meta.repo)}/actions/runs/${r.id}" title="Run ${r.run}: ${r.wallS} s, attempt ${r.attempt}, ${r.parity}">${r.run}</a>`).join('');
$('tt').innerHTML = `<thead><tr><th>Surface</th><th>Suite</th><th>p50</th><th>p95</th><th>Set-up p95</th></tr></thead><tbody>` +
  S.map((s) => { const m = DATA.medians[s.id]; return `<tr><td>${s.label}</td><td>${m[0]} s</td><td>${m[1]} ms</td><td>${m[2]} ms</td><td>${m[5] === null ? '—' : m[5] + ' ms'}</td></tr>`; }).join('') + '</tbody>';

// The gate fails when it should: this build's own negative check
const neg = DATA.negative;
if (neg) {
  $('diff').innerHTML = `<span class="del">- ${esc(neg.before)}</span>\n<span class="add">+ ${esc(neg.after)}</span>`;
  $('negnote').textContent = `Planted in a copy of the ${neg.surfaceLabel} report, in "${neg.scenario}". The published reports are untouched. Gate exit codes: ${neg.exitTampered} with the change, ${neg.exitClean} without.`;
  $('replay').addEventListener('click', () => {
    const t = $('term'); t.innerHTML = ''; let i = 0;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const step = () => {
      if (i >= neg.lines.length) return;
      const [c, s] = neg.lines[i++];
      t.insertAdjacentHTML('beforeend', (i > 1 ? '\n' : '') + (c ? `<span class="${c}">${esc(s)}</span>` : esc(s)));
      reduce ? step() : setTimeout(step, 90);
    };
    step();
  });
} else {
  $('gate').hidden = true;
  document.querySelector('nav.toc a[href="#gate"]').hidden = true;
}

// Links to reports that were built
document.querySelectorAll('[data-report]').forEach((a) => {
  const s = a.dataset.report, n = DATA.rows.filter((r) => r.res[s]).length;
  if (!DATA.reports[s]) a.hidden = true;
  else a.querySelector('span').textContent = `Serenity BDD, ${n} scenarios`;
});
