// Package Finder slice — UI for the standalone /review page.
// A focused, package-first version of the guided review: Basics → 10 required questions → Your package → Finish.
// Reuses the Guided Review domain engine (pure functions) so the main site, this page, and /api/recommend
// always agree. State lives only in this browser (localStorage); no client health data leaves the device.
import { analyze, evaluateEligibility, scorePaths } from '../../guided-review/domain/engine.js';
import { REF, PRODUCTS, PACKAGES, TPMO_DISCLAIMER } from '../../guided-review/domain/reference-2026.js';
import { QUESTIONS, TOTAL, answeredCount, isComplete, toggleFlag } from '../content/questions.js';

const STORE_KEY = 'sq_package_finder_v1';
const AGENT = { name: 'Brandon Hardy', phone: '913-349-7801', email: 'brandon@greenlightbenefits.com' };
const STEPS = [
  { id: 'basics', label: 'Basics' },
  { id: 'questions', label: '10 questions' },
  { id: 'package', label: 'Your package' },
  { id: 'finish', label: 'Finish' }
];
const TIERS = ['A', 'B', 'C'];
const TAGLINE = {
  supp: { A: 'Core protection for your biggest gaps', B: 'Comprehensive gap coverage', C: 'Maximum protection package' },
  adv: { A: 'Core supplemental protection', B: 'Double layer of protection', C: 'Full supplemental coverage' }
};
const PATH_NAME = { supp: 'Medicare Supplement', adv: 'Medicare Advantage' };

const blank = () => ({ step: 0, maxStep: 0, mode: 'self', clientName: '', profile: { priorities: [], conditions: [] }, client: {}, checklist: {}, startedAt: new Date().toISOString() });
let S = load();
const root = () => document.getElementById('pf-root');
const P = () => S.profile;
const agent = () => S.mode === 'agent';

function load() {
  let s = blank();
  try { const x = JSON.parse(localStorage.getItem(STORE_KEY)); if (x && x.profile) s = { ...s, ...x }; } catch {}
  try { const z = JSON.parse(localStorage.getItem('sq_zip_state')); if (z && !s.profile.zip) { s.profile.zip = z.zip; s.profile.state = z.state; } } catch {}
  // Deep link from a package card on the main site: review.html?path=supp&tier=B
  const qs = new URLSearchParams(location.search);
  const path = qs.get('path'), tier = qs.get('tier');
  if ((path === 'supp' || path === 'adv') && TIERS.includes(tier)) s.profile.statedInterest = { path, tier };
  if (qs.get('mode') === 'agent' || qs.get('mode') === 'self') s.mode = qs.get('mode');
  return s;
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch {} }
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const range = ([a, b]) => `${money(a)}–${money(b)}`;
const result = (extra = {}) => analyze({ ...P(), irmaaTier: P().irmaaTier ?? 0, ...extra });
const productName = (p, r) => p.id === 'medigap' ? `Medicare Supplement Plan ${r.design.plan}` : p.id === 'mapd' ? r.design.label : p.name;

// ---------- form primitives ----------
function chips(field, opts, { multi = false, max = 0 } = {}) {
  const cur = P()[field];
  return `<div class="pf-chips" role="group">${opts.map(([v, l]) => {
    const on = multi ? (cur || []).includes(v) : cur === v;
    return `<button type="button" class="pf-chip${on ? ' on' : ''}" data-set="${field}" data-val="${v}"${multi ? ` data-multi="${max}"` : ''} aria-pressed="${on}">${l}</button>`;
  }).join('')}</div>`;
}
const yn = (f) => chips(f, [['yes', 'Yes'], ['no', 'No']]);
const q = (label, control, hint = '') => `<div class="pf-q"><div class="pf-q-l">${label}</div>${control}${hint ? `<div class="pf-hint">${hint}</div>` : ''}</div>`;
function input(field, type = 'text', ph = '', src = 'profile') {
  const v = (src === 'client' ? S.client : P())[field] ?? '';
  return `<input class="pf-input" type="${type}" data-field="${field}" data-src="${src}" value="${esc(v)}" placeholder="${esc(ph)}">`;
}
const textarea = (field, ph, src = 'client') => `<textarea class="pf-input" rows="2" data-field="${field}" data-src="${src}" placeholder="${esc(ph)}">${esc((src === 'client' ? S.client : P())[field] ?? '')}</textarea>`;
const group = (title, body) => `<section class="pf-group"><h3 class="pf-group-h">${title}</h3>${body}</section>`;
const more = (label, body) => `<details class="pf-more"><summary><i class="fa-solid fa-plus"></i> ${label}</summary><div class="pf-more-b">${body}</div></details>`;
const tip = (html) => agent() ? `<div class="pf-tip"><i class="fa-solid fa-headset"></i><span>${html}</span></div>` : '';
const nav = (back, nextLabel, nextStep) => `<div class="pf-nav">
  ${back != null ? `<button type="button" class="pf-btn ghost" data-go="${back}"><i class="fa-solid fa-arrow-left"></i> Back</button>` : '<span></span>'}
  <button type="button" class="pf-btn primary" data-go="${nextStep}">${nextLabel} <i class="fa-solid fa-arrow-right"></i></button></div>`;

// ---------- steps ----------
function stepBasics() {
  const p = P();
  const working = p.working === 'self' || p.working === 'spouse';
  return `
    <div class="pf-step-h"><h2>Let's start with you</h2><p>Three quick details, then the 10 questions that build your package.</p></div>
    ${group('About you', `<div class="pf-row">
      ${q(agent() ? 'Client first name' : 'First name', `<input class="pf-input" data-root="clientName" value="${esc(S.clientName)}" placeholder="Jane">`)}
      ${q('Date of birth', input('dob', 'date'))}
      ${q('ZIP code', input('zip', 'text', '66208'))}
    </div>`)}
    ${more('Current coverage & special situations (optional)', `
      ${q('Coverage today', chips('currentCoverage', [['none', 'New to Medicare'], ['employer', 'Employer / group'], ['medigap', 'Medigap'], ['ma', 'Medicare Advantage'], ['retiree', 'Retiree plan'], ['marketplace', 'Marketplace']]))}
      ${p.currentCoverage === 'ma' ? q('First Medicare Advantage plan, joined in the last 12 months?', yn('maFirstYear')) : ''}
      ${q('Still working with employer coverage?', chips('working', [['no', 'No'], ['self', 'Yes — mine'], ['spouse', "Yes — spouse's"]]))}
      ${working ? q('Employer size', chips('employerSize', [['lt20', 'Under 20 employees'], ['20plus', '20 or more']])) : ''}
      ${q('Part A', chips('partA', [['enrolled', 'Enrolled'], ['not_yet', 'Not yet']]))}
      ${q('Receiving Social Security?', yn('ss'))}
      ${q('Lost or losing other coverage recently?', yn('lostCoverage'))}
      ${q('Contributing to an HSA?', yn('hsa'))}
      ${q('Extra Help / LIS for drugs?', chips('lis', [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']]))}
      ${q('Military benefits', chips('va', [['no', 'None'], ['va', 'VA health care'], ['tricare', 'TRICARE For Life']]))}
      ${q('End-Stage Renal Disease (ESRD)?', yn('esrd'))}
    `)}
    ${tip('Confirm Scope of Appointment before discussing MA or Part D. Verify Part A/B dates against the Medicare card.')}
    ${nav(null, 'Start the 10 questions', 1)}`;
}

function questionCard(qd) {
  const p = P();
  const done = qd.answered(p);
  let control = '';
  if (qd.type === 'chips') control = chips(qd.field, qd.options);
  if (qd.type === 'multiChips') control = `<div class="pf-q-l sub">${qd.label}</div>${chips(qd.field, qd.options, { multi: true })}
    <div class="pf-q-l sub">${qd.second.label}</div>${chips(qd.second.field, qd.second.options)}`;
  if (qd.type === 'flags') {
    const cur = p[qd.key] || [];
    control = `<div class="pf-chips" role="group">${qd.options.map((o) => `<button type="button" class="pf-chip${cur.includes(o.v) ? ' on' : ''}" data-flag="${qd.key}" data-val="${o.v}" aria-pressed="${cur.includes(o.v)}">${o.label}</button>`).join('')}</div>`;
  }
  if (qd.followUp && qd.followUp.when(p)) control += `<div class="pf-q-l sub">${qd.followUp.label}</div>${input(qd.followUp.field, qd.followUp.type)}`;
  return `<section class="pf-qcard${done ? ' done' : ''}" id="pf-q-${qd.id}">
    <div class="pf-qn">${done ? '<i class="fa-solid fa-check"></i>' : qd.n}</div>
    <div class="pf-qb">
      <h3>${qd.title}</h3>
      <p class="pf-qwhy"><span class="pf-aff">${qd.affects}</span>${qd.why}</p>
      ${control}
    </div></section>`;
}

function stepNeeds() {
  const p = P();
  const n = answeredCount(p);
  const tierOpts = REF.irmaa.map((t) => [String(t.tier), `${t.single} single / ${t.joint} joint`]);
  return `
    <div class="pf-step-h"><h2>10 questions that build your package</h2>
      <p>All 10 are needed for an accurate recommendation. Each one shows what it changes.</p></div>
    <div class="pf-qprog"><div class="pf-qbar"><span style="width:${(n / TOTAL) * 100}%"></span></div><b>${n} of ${TOTAL} answered</b></div>
    ${QUESTIONS.map(questionCard).join('')}
    ${more('Fine-tune (optional)', `
      ${q('Top priorities (up to 3)', chips('priorities', [['freedom', 'Any doctor'], ['predictable', 'Predictable costs'], ['low_premium', 'Lowest premium'], ['extras', 'Dental / vision / hearing'], ['rx', 'Lowest drug costs'], ['catastrophic', 'Protection from big bills']], { multi: true, max: 3 }))}
      ${q('Surgery or procedure planned in the next 12 months?', yn('procedurePlanned'))}
      ${q('Regular prescriptions', chips('rxCount', [['0', 'None'], ['2', '1–2'], ['4', '3–5'], ['6', '6+']]))}
      ${q('Any specialty or high-cost brand drugs?', yn('specialtyRx'))}
      ${(p.conditions || []).includes('diabetes') ? q('Using insulin?', yn('insulin')) : ''}
      ${q('Want access to out-of-area specialty centers?', yn('specialtyCenter'))}
      ${q(`Household income on ${REF.year - 2} tax return (IRMAA)`, `<select class="pf-input" data-field="irmaaTier" data-src="profile">${tierOpts.map(([v, l]) => `<option value="${v}" ${String(p.irmaaTier ?? 0) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
      ${q('Doctors to keep', textarea('doctors', 'Name, specialty, clinic…'), 'Stays on this device.')}
      ${q('Medications', textarea('meds', 'Drug, dose, frequency…'), 'Stays on this device.')}
    `)}
    ${tip('Read each question as written and record the client\'s answer — don\'t lead. <i>"What would a $5,000 bill do to your plans this year?"</i>')}
    <div class="pf-nav">
      <button type="button" class="pf-btn ghost" data-go="0"><i class="fa-solid fa-arrow-left"></i> Back</button>
      ${n === TOTAL
        ? '<button type="button" class="pf-btn primary" data-go="2">See my package <i class="fa-solid fa-arrow-right"></i></button>'
        : `<button type="button" class="pf-btn primary" data-act="nextq">Answer ${TOTAL - n} more to see your package <i class="fa-solid fa-arrow-down"></i></button>`}
    </div>`;
}

function tierCard(path, tier, rec, r) {
  const pkg = PACKAGES[path][tier];
  const pf = r.portfolio;
  const isRec = tier === rec;
  const isSel = tier === (P().tierChoice || rec);
  const ids = pf.products.map((x) => x.id);
  const alt = !Array.isArray(pkg.ancillary) ? pkg.pool.find((k) => !ids.includes(k)) : null;
  return `<article class="pf-tier${isRec ? ' rec' : ''}${isSel ? ' sel' : ''}">
    ${isRec ? '<div class="pf-badge"><i class="fa-solid fa-star"></i> Recommended for you</div>' : ''}
    <div class="pf-tier-k">Plan ${tier}</div>
    <h3>${pkg.name}</h3>
    <p class="pf-tier-t">${TAGLINE[path][tier]}</p>
    <div class="pf-price"><b>${range(pkg.price)}</b><span>est. per month</span></div>
    <ul class="pf-incl">${pf.products.map((x) => `<li><i class="fa-solid ${x.icon}"></i>${productName(x, r)}</li>`).join('')}
      ${alt ? `<li class="alt"><i class="fa-solid ${PRODUCTS[alt].icon}"></i>or ${PRODUCTS[alt].name}</li>` : ''}</ul>
    <button type="button" class="pf-btn ${isSel ? 'primary' : 'outline'} block" data-tier="${tier}">${isSel ? '<i class="fa-solid fa-check"></i> Selected' : `Choose ${pkg.name}`}</button>
  </article>`;
}

function stepPackage() {
  const base = result({ tierChoice: undefined });
  const d = base.decision;
  const path = d.path;
  const rec = base.portfolio.recommendedTier;
  if (P().tierChoice && !PACKAGES[path][P().tierChoice]) P().tierChoice = undefined;
  const r = result();
  const pf = r.portfolio;
  const engineName = PATH_NAME[d.overridden ? d.enginePath : path];
  const stated = P().statedInterest;
  return `
    <div class="pf-step-h"><h2>${S.clientName ? esc(S.clientName) + ', here is' : 'Here is'} your recommended package</h2>
      <p>Built from your answers. Compare all three tiers and choose the one that fits.</p></div>

    <div class="pf-pathbar">
      <div class="pf-seg" role="tablist">
        ${['supp', 'adv'].map((k) => `<button type="button" class="pf-seg-b${path === k ? ' on' : ''}" data-path="${k}" role="tab" aria-selected="${path === k}">
          ${PATH_NAME[k]}${(d.overridden ? d.enginePath : d.path) === k ? ' <span class="pf-fit">Best fit</span>' : ''}</button>`).join('')}
      </div>
      <div class="pf-design"><span class="pf-ok"><i class="fa-solid fa-circle-check"></i> Based on all ${TOTAL} answers</span> <b>${r.design.label}</b> · ${d.strength}${d.overridden ? ` · engine recommends ${engineName}` : ''}</div>
    </div>

    <div class="pf-tiers">${TIERS.map((t) => tierCard(path, t, rec, result({ tierChoice: t }))).join('')}</div>

    <div class="pf-why">
      <div class="pf-why-h">
        <div><div class="pf-eyebrow">Why Plan ${pf.tier} — ${pf.name}${pf.chosen ? ' (your choice)' : ''}</div>
          <h3>What each product covers for you</h3></div>
        <div class="pf-total"><span>Estimated total</span><b>${money(pf.estimate.totalLow)}–${money(pf.estimate.totalHigh)}<small>/mo</small></b>
          <small>${range(pf.estimate.bundle)} package + ${money(pf.estimate.partB)} Part B${pf.estimate.partDSurcharge ? ` + ${money(pf.estimate.partDSurcharge)} Part D IRMAA` : ''}</small></div>
      </div>
      <ul class="pf-prods">${pf.products.map((x) => `<li><span class="pf-ico"><i class="fa-solid ${x.icon}"></i></span>
        <div><b>${productName(x, r)}</b><span>${x.reasons.join(' · ')}</span></div></li>`).join('')}</ul>
      ${pf.choiceNote ? `<p class="pf-hint">${pf.choiceNote}</p>` : ''}
      ${pf.chosen ? `<div class="pf-note info"><i class="fa-solid fa-circle-info"></i> Your answers point to Plan ${rec} — ${PACKAGES[path][rec].name}. You can keep this choice; your agent will review the difference with you.</div>` : ''}
      ${pf.overBudget ? '<div class="pf-note warn"><i class="fa-solid fa-triangle-exclamation"></i> This package is above the budget you mentioned. Start with core coverage plus the highest-need protection, then add more over time.</div>' : ''}
      ${stated && (stated.path !== path || stated.tier !== pf.tier) ? `<div class="pf-note info"><i class="fa-solid fa-circle-info"></i> You first looked at the ${PATH_NAME[stated.path]} ${PACKAGES[stated.path][stated.tier].name} package. Your answers point here instead.</div>` : ''}
    </div>

    ${details(r)}
    ${nav(1, `Continue with ${pf.name}`, 3)}`;
}

function details(r) {
  const d = r.decision;
  const body = `
    <div class="pf-cols">
      <div><h4>Why ${PATH_NAME[d.path]}</h4>${d.reasons.length ? `<ul class="pf-list ok">${d.reasons.slice(0, 5).map((s) => `<li>${s}</li>`).join('')}</ul>` : '<p class="pf-hint">Answer more questions to strengthen this.</p>'}</div>
      <div><h4>Trade-offs</h4>${d.tradeoffs.length ? `<ul class="pf-list warn">${d.tradeoffs.slice(0, 5).map((s) => `<li>${s}</li>`).join('')}</ul>` : '<p class="pf-hint">No strong pull toward the other path.</p>'}</div>
    </div>
    ${d.closeCall ? '<div class="pf-note info"><i class="fa-solid fa-scale-balanced"></i> Close call — compare real quotes on both paths before deciding.</div>' : ''}
    ${r.flags.length ? `<h4>Items to review</h4>${r.flags.map((f) => `<div class="pf-note ${f.level === 'high' ? 'warn' : 'info'}"><i class="fa-solid ${f.level === 'high' ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i> ${f.text}</div>`).join('')}` : ''}
    ${agent() ? `<h4>Talk track</h4><ul class="pf-list">${r.brief.talkTrack.map((s) => `<li>${s}</li>`).join('')}</ul>
      <h4>Verification checklist</h4>${r.brief.checklist.map((c, i) => `<label class="pf-check"><input type="checkbox" data-check="${i}" ${S.checklist[i] ? 'checked' : ''}> ${c}</label>`).join('')}` : ''}`;
  return `<details class="pf-more pf-analysis"${agent() ? ' open' : ''}><summary><i class="fa-solid fa-plus"></i> ${agent() ? 'Agent brief & full analysis' : 'See the full analysis'}</summary><div class="pf-more-b">${body}</div></details>`;
}

function stepFinish() {
  const r = result();
  const pf = r.portfolio;
  return `
    <div class="pf-step-h"><h2>Lock in your ${pf.name} package</h2><p>Share your details and ${agent() ? 'start the applications' : `${AGENT.name.split(' ')[0]} will confirm pricing and eligibility with you`}.</p></div>
    <div class="pf-summary">
      <div><div class="pf-eyebrow">${PATH_NAME[pf.path]} · Plan ${pf.tier}</div><h3>${pf.name}</h3></div>
      <div class="pf-total"><span>Estimated total</span><b>${money(pf.estimate.totalLow)}–${money(pf.estimate.totalHigh)}<small>/mo</small></b></div>
    </div>
    ${group('Contact details', `<div class="pf-row">
      ${q('Full name', input('name', 'text', 'Jane Smith', 'client'))}
      ${q('Phone', input('phone', 'tel', '(913) 555-0100', 'client'))}
      ${q('Email', input('email', 'email', 'jane@example.com', 'client'))}
    </div>${q(agent() ? 'Agent notes' : 'Questions for your agent', textarea('notes', agent() ? 'Objections, follow-ups, carrier preferences…' : 'Anything you want to ask…'))}`)}
    ${group('Applications in this package', `<ul class="pf-prods">${pf.products.map((x) => `<li><span class="pf-ico"><i class="fa-solid ${x.icon}"></i></span>
      <div><b>${productName(x, r)}</b><span>${x.desc}</span></div><a class="pf-btn sm" href="${x.href}">Start</a></li>`).join('')}</ul>`)}
    <div class="pf-actions">
      <a class="pf-btn primary" href="${mailto(r)}"><i class="fa-solid fa-paper-plane"></i> ${agent() ? 'Email summary' : `Send to ${AGENT.name.split(' ')[0]}`}</a>
      <a class="pf-btn outline" href="tel:${AGENT.phone.replace(/\D/g, '')}"><i class="fa-solid fa-phone"></i> ${AGENT.phone}</a>
      <button type="button" class="pf-btn outline" data-act="print"><i class="fa-solid fa-print"></i> Print</button>
      ${agent() ? '<button type="button" class="pf-btn outline" data-act="copy"><i class="fa-solid fa-copy"></i> Copy brief</button>' : ''}
    </div>
    <div class="pf-nav"><button type="button" class="pf-btn ghost" data-go="2"><i class="fa-solid fa-arrow-left"></i> Back to packages</button>
      <button type="button" class="pf-btn ghost" data-act="reset"><i class="fa-solid fa-rotate-left"></i> New review</button></div>`;
}

// ---------- live package preview (steps 1–2) ----------
function preview() {
  const p = P();
  const s = scorePaths(p, evaluateEligibility(p));
  const tot = Math.max(1, Math.max(0, s.scores.medigap) + Math.max(0, s.scores.advantage));
  const none = s.scores.medigap <= 0 && s.scores.advantage <= 0;
  const mg = none ? 50 : Math.round((Math.max(0, s.scores.medigap) / tot) * 100);
  const r = result({ tierChoice: undefined });
  const pf = r.portfolio;
  const answered = answeredCount(p);
  return `<div class="pf-prev">
    <div class="pf-eyebrow">Your package so far</div>
    <div class="pf-prev-n">${answered ? PATH_NAME[pf.path] : 'Starting point — answer the 10 questions'}</div>
    <div class="pf-prev-t">Plan ${pf.tier} — ${pf.name}</div>
    <div class="pf-prev-p">${range(pf.estimate.bundle)} <span>/mo est.</span></div>
    <ul>${pf.products.map((x) => `<li><i class="fa-solid ${x.icon}"></i>${productName(x, r)}</li>`).join('')}</ul>
    <div class="pf-lean"><span class="mg" style="width:${mg}%"></span><span class="ma" style="width:${100 - mg}%"></span></div>
    <div class="pf-lean-l"><span>Supplement ${mg}%</span><span>Advantage ${100 - mg}%</span></div>
    <div class="pf-prev-c${answered === TOTAL ? ' ok' : ''}">${answered === TOTAL ? '<i class="fa-solid fa-circle-check"></i> All 10 answered — recommendation confirmed' : `<i class="fa-regular fa-circle"></i> ${answered} of ${TOTAL} questions answered — preliminary`}</div>
  </div>`;
}

// ---------- shell ----------
function render() {
  const el = root(); if (!el) return;
  if (S.step >= 2 && !isComplete(P())) S.step = 1;
  const body = [stepBasics, stepNeeds, stepPackage, stepFinish][S.step]();
  const side = S.step < 2;
  el.innerHTML = `
    <div class="pf-top">
      <ol class="pf-steps">${STEPS.map((st, i) => `<li><button type="button" class="${i === S.step ? 'on' : ''}${i < S.step ? ' done' : ''}" data-go="${i}" ${i > (S.maxStep ?? 0) + 1 || (i >= 2 && !isComplete(P())) ? 'disabled' : ''}>
        <span>${i < S.step ? '<i class="fa-solid fa-check"></i>' : i + 1}</span>${st.label}</button></li>`).join('')}</ol>
      <div class="pf-mode" role="group" aria-label="Session mode">
        <button type="button" class="${!agent() ? 'on' : ''}" data-mode="self">On my own</button>
        <button type="button" class="${agent() ? 'on' : ''}" data-mode="agent">With an agent</button>
      </div>
    </div>
    <div class="pf-shell${side ? '' : ' wide'}">
      <div class="pf-main">${body}</div>
      ${side ? `<aside class="pf-side" id="pf-side">${preview()}</aside>` : ''}
    </div>
    <p class="pf-disc">${TPMO_DISCLAIMER} Estimates use ${REF.year} figures from <a href="${REF.sources[0].url}" target="_blank" rel="noopener">CMS</a> and are not quotes; final pricing depends on age, ZIP, carrier, and health questions where applicable. Answers are saved only in this browser.</p>`;
}
// Re-render without losing open <details> panels or scroll position.
function rerender() {
  const open = [...root().querySelectorAll('details[open]')].map((d) => d.querySelector('summary')?.textContent);
  render();
  root().querySelectorAll('details').forEach((d) => { if (open.includes(d.querySelector('summary')?.textContent)) d.open = true; });
}
function refreshSide() { const s = document.getElementById('pf-side'); if (s) s.innerHTML = preview(); }
function go(n) {
  if (n >= 2 && !isComplete(P())) n = 1;
  S.step = Math.max(0, Math.min(STEPS.length - 1, n));
  S.maxStep = Math.max(S.maxStep ?? 0, S.step);
  save(); render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function summaryLines(r) {
  const pf = r.portfolio;
  return [
    `Client: ${S.client.name || S.clientName || '—'}  ·  ZIP ${P().zip || '—'}  ·  ${new Date().toLocaleDateString()}`,
    `Session: ${agent() ? 'Agent-assisted' : 'Self-guided'} (Package Review)`,
    '',
    `Package: ${PATH_NAME[pf.path]} — Plan ${pf.tier} ${pf.name}${pf.chosen ? ` (engine recommended Plan ${pf.recommendedTier})` : ''}`,
    `Core plan: ${r.design.label} (${r.decision.strength}, ${r.decision.confidence}%)${r.decision.overridden ? ' — path changed from engine result' : ''}`,
    `Estimate: ${range(pf.estimate.bundle)}/mo package + ${money(pf.estimate.partB)} Part B = ${money(pf.estimate.totalLow)}–${money(pf.estimate.totalHigh)}/mo`,
    ...pf.products.map((p) => `  • ${productName(p, r)}: ${p.reasons.join('; ')}`),
    '',
    'Recommendation questions:',
    ...QUESTIONS.map((qd) => `  ${qd.n}. ${qd.title} → ${answerText(qd, P())}`),
    '',
    `Medigap guaranteed issue: ${r.eligibility.gi.status} — ${r.eligibility.gi.reason}`,
    ...r.flags.map((f) => `  ! ${f.text}`),
    S.client.doctors ? `\nDoctors: ${S.client.doctors}` : '',
    S.client.meds ? `Medications: ${S.client.meds}` : '',
    S.client.notes ? `Notes: ${S.client.notes}` : ''
  ].filter((l, i, a) => !(l === '' && a[i - 1] === ''));
}
function answerText(qd, p) {
  const lab = (opts, v) => (opts.find(([k]) => k === v) || [, '—'])[1];
  if (qd.type === 'chips') return lab(qd.options, p[qd.field]) + (qd.followUp && qd.followUp.when(p) && p[qd.followUp.field] ? ` (${p[qd.followUp.field]})` : '');
  if (qd.type === 'multiChips') return `${(p[qd.field] || []).map((v) => lab(qd.options, v)).join(', ') || '—'}; hospital stays: ${lab(qd.second.options, p[qd.second.field])}`;
  return (p[qd.key] || []).map((v) => (qd.options.find((o) => o.v === v) || {}).label).join(', ') || '—';
}
function mailto(r) {
  const subj = `Medicare Package Review — ${S.client.name || S.clientName || 'Client'}`;
  return `mailto:${AGENT.email}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(summaryLines(r).join('\n'))}`;
}
function printSummary() {
  const r = result();
  let sheet = document.getElementById('pf-print');
  if (!sheet) { sheet = document.createElement('div'); sheet.id = 'pf-print'; document.body.appendChild(sheet); }
  sheet.innerHTML = `<h1>Medicare Package Review</h1><p class="ps-sub">SelectQuote · ${AGENT.name} · ${AGENT.phone} · ${new Date().toLocaleDateString()}</p>
    <pre>${esc(summaryLines(r).join('\n'))}</pre><p class="ps-sub">${TPMO_DISCLAIMER}</p>`;
  document.body.classList.add('pf-printing');
  const done = () => { document.body.classList.remove('pf-printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
  setTimeout(done, 1500);
}

// ---------- events ----------
function onClick(e) {
  const t = e.target.closest('button');
  if (!t || !root()?.contains(t)) return;
  if (t.dataset.go != null) return go(+t.dataset.go);
  if (t.dataset.mode) { S.mode = t.dataset.mode; save(); return render(); }
  if (t.dataset.tier) { P().tierChoice = t.dataset.tier; save(); return render(); }
  if (t.dataset.path) {
    const engine = result({ pathOverride: undefined }).decision.path;
    P().pathOverride = t.dataset.path === engine ? undefined : t.dataset.path;
    P().tierChoice = undefined;
    save(); return render();
  }
  if (t.dataset.flag) {
    Object.assign(P(), toggleFlag(t.dataset.flag, P()[t.dataset.flag] || [], t.dataset.val));
    P().tierChoice = undefined;
    save(); return rerender();
  }
  if (t.dataset.set) {
    const f = t.dataset.set, v = t.dataset.val;
    if (t.dataset.multi != null) {
      let cur = (P()[f] || []).slice();
      const max = +t.dataset.multi;
      if (cur.includes(v)) cur = cur.filter((x) => x !== v);
      else {
        if (f === 'conditions') cur = v === 'none' ? ['none'] : cur.filter((x) => x !== 'none');
        if (max && cur.length >= max) cur.shift();
        cur.push(v);
      }
      P()[f] = cur;
    } else P()[f] = P()[f] === v ? undefined : v;
    // answers changed → let the engine pick the tier again
    P().tierChoice = undefined;
    save(); return rerender();
  }
  const act = t.dataset.act;
  if (act === 'reset') { if (confirm('Start a new review? Answers on this device will be cleared.')) { localStorage.removeItem(STORE_KEY); history.replaceState(null, '', location.pathname); S = load(); render(); } return; }
  if (act === 'print') return printSummary();
  if (act === 'nextq') {
    const first = QUESTIONS.find((x) => !x.answered(P()));
    const el = first && document.getElementById('pf-q-' + first.id);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('pulse'); setTimeout(() => el.classList.remove('pulse'), 1200); }
    return;
  }
  if (act === 'copy') {
    const r = result();
    const txt = [...summaryLines(r), '', 'Verification checklist:', ...r.brief.checklist.map((c) => '  [ ] ' + c)].join('\n');
    navigator.clipboard?.writeText(txt).then(() => { t.innerHTML = '<i class="fa-solid fa-check"></i> Copied'; });
  }
}
function onInput(e) {
  const t = e.target;
  if (!root()?.contains(t)) return;
  if (t.dataset.root) { S[t.dataset.root] = t.value; return save(); }
  if (t.dataset.check != null) { S.checklist[t.dataset.check] = t.checked; return save(); }
  if (t.dataset.field) {
    const tgt = t.dataset.src === 'client' ? S.client : P();
    tgt[t.dataset.field] = t.dataset.field === 'irmaaTier' ? +t.value : t.value;
    save();
    if (e.type === 'change' && t.dataset.field === 'partBEffective') return rerender();
    refreshSide();
  }
}

export function init() {
  if (!root()) return;
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onInput);
  window.SQPackageFinder = { analyze: result, state: () => S, go };
  render();
}
