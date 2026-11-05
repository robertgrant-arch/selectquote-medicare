// Guided Review slice — UI. Education → Eligibility → Needs analysis → Recommended portfolio → Next steps.
// State lives only in this browser (localStorage). Nothing containing client health data is sent to a server.
import { analyze, evaluateEligibility, scorePaths } from '../domain/engine.js';
import { REF, PRODUCTS, PACKAGES, TPMO_DISCLAIMER } from '../domain/reference-2026.js';
import { MODULES } from '../content/modules.js';

const STORE_KEY = 'sq_guided_review_v1';
const STAGES = [
  { id: 'start', label: 'Start', icon: 'fa-flag' },
  { id: 'learn', label: 'Learn', icon: 'fa-book-open' },
  { id: 'eligibility', label: 'Eligibility', icon: 'fa-id-card' },
  { id: 'needs', label: 'Needs Analysis', icon: 'fa-clipboard-list' },
  { id: 'recommend', label: 'Recommendation', icon: 'fa-star' },
  { id: 'next', label: 'Next Steps', icon: 'fa-paper-plane' }
];
const AGENT = { name: 'Brandon Hardy', phone: '913-349-7801', email: 'brandon@greenlightbenefits.com' };

const blank = () => ({ stage: 0, mode: 'agent', agentName: AGENT.name, clientName: '', eduIdx: 0, edu: {}, eduSkipped: false,
  profile: { priorities: [], conditions: [] }, client: {}, checklist: {}, startedAt: new Date().toISOString() });

let S = load();
const root = () => document.getElementById('guided-review-root');

function load() {
  try { const s = JSON.parse(localStorage.getItem(STORE_KEY)); if (s && s.profile) return { ...blank(), ...s }; } catch {}
  const s = blank();
  try { const z = JSON.parse(localStorage.getItem('sq_zip_state')); if (z) { s.profile.zip = z.zip; s.profile.state = z.state; } } catch {}
  return s;
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch {} }
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const agent = () => S.mode === 'agent';
const P = () => S.profile;
const result = () => analyze({ ...P(), irmaaTier: P().irmaaTier ?? 0 });

// ---------- form primitives ----------
function chips(field, opts, { multi = false, max = 0 } = {}) {
  const cur = P()[field];
  return `<div class="gr-chips" role="group">${opts.map(([v, l]) => {
    const on = multi ? (cur || []).includes(v) : cur === v;
    return `<button type="button" class="gr-chip${on ? ' on' : ''}" data-set="${field}" data-val="${v}"${multi ? ` data-multi="${max}"` : ''} aria-pressed="${on}">${l}</button>`;
  }).join('')}</div>`;
}
function q(label, control, hint = '') {
  return `<div class="gr-q"><div class="gr-q-label">${label}</div>${hint ? `<div class="gr-q-hint">${hint}</div>` : ''}${control}</div>`;
}
function input(field, type = 'text', ph = '', src = 'profile') {
  const val = (src === 'client' ? S.client : P())[field] ?? '';
  return `<input class="gr-input" type="${type}" data-field="${field}" data-src="${src}" value="${esc(val)}" placeholder="${esc(ph)}">`;
}
function textarea(field, ph, src = 'client') {
  return `<textarea class="gr-input" data-field="${field}" data-src="${src}" rows="3" placeholder="${esc(ph)}">${esc((src === 'client' ? S.client : P())[field] ?? '')}</textarea>`;
}
const yn = (field) => chips(field, [['yes', 'Yes'], ['no', 'No']]);
const card = (title, icon, body) => `<div class="gr-card"><div class="gr-card-h"><i class="fa-solid ${icon}"></i>${title}</div>${body}</div>`;
const agentNote = (html) => agent() ? `<div class="gr-agent-note"><i class="fa-solid fa-headset"></i><div>${html}</div></div>` : '';

// ---------- stage renderers ----------
function stageStart() {
  const resumed = S.stage > 0 || Object.keys(S.edu).length;
  return `
  <div class="gr-start">
    <h3 class="gr-h3">How are we doing this review?</h3>
    <p class="gr-lede">This guided review walks through Medicare education, confirms eligibility and timing, analyzes your needs, and builds a recommended coverage portfolio. It takes about 15–20 minutes.</p>
    <div class="gr-mode-grid">
      <button type="button" class="gr-mode${agent() ? ' on' : ''}" data-mode="agent">
        <i class="fa-solid fa-user-tie"></i><b>Agent-assisted session</b>
        <span>A licensed agent leads the conversation. Shows talk tracks, compliance reminders, and a verification checklist.</span>
      </button>
      <button type="button" class="gr-mode${!agent() ? ' on' : ''}" data-mode="self">
        <i class="fa-solid fa-user"></i><b>On my own</b>
        <span>Learn at your own pace and get a personalized recommendation to review with ${AGENT.name.split(' ')[0]}.</span>
      </button>
    </div>
    <div class="gr-row2">
      ${agent() ? q('Agent name', `<input class="gr-input" data-root="agentName" value="${esc(S.agentName)}">`) : ''}
      ${q(agent() ? 'Client name' : 'Your first name', `<input class="gr-input" data-root="clientName" value="${esc(S.clientName)}" placeholder="e.g. Jane">`)}
    </div>
    ${agentNote('Open with purpose and permission: <i>"Today I\'ll explain how Medicare works, ask some questions about your health, doctors, and budget, and then show you what fits. Nothing is purchased today unless you decide to. Is that okay?"</i> Confirm a Scope of Appointment before discussing MA or Part D products.')}
    <div class="gr-nav">
      ${resumed ? '<button type="button" class="gr-btn ghost" data-act="reset"><i class="fa-solid fa-rotate-left"></i> Start a new session</button>' : '<span></span>'}
      <button type="button" class="gr-btn primary" data-go="${Math.max(1, S.maxStage || 1)}">${resumed ? 'Continue session' : 'Begin education'} <i class="fa-solid fa-arrow-right"></i></button>
    </div>
  </div>`;
}

function eduDone(id) { const e = S.edu[id]; return !!(e && (e.correct || e.confirmed)); }
function stageLearn() {
  const m = MODULES[S.eduIdx] || MODULES[0];
  const e = S.edu[m.id] || {};
  const done = MODULES.filter((x) => eduDone(x.id)).length;
  const answered = e.answer != null;
  return `
  <div class="gr-learn">
    <aside class="gr-mod-list">
      <div class="gr-mod-progress"><span style="width:${(done / MODULES.length) * 100}%"></span></div>
      <div class="gr-mod-count">${done} of ${MODULES.length} topics complete</div>
      ${MODULES.map((x, i) => `<button type="button" class="gr-mod${i === S.eduIdx ? ' on' : ''}${eduDone(x.id) ? ' done' : ''}" data-mod="${i}">
        <span class="gr-mod-ico"><i class="fa-solid ${eduDone(x.id) ? 'fa-check' : x.icon}"></i></span>${x.title}</button>`).join('')}
    </aside>
    <div class="gr-mod-body">
      <div class="gr-eyebrow">Topic ${S.eduIdx + 1} of ${MODULES.length}</div>
      <h3 class="gr-h3">${m.title}</h3>
      <ul class="gr-points">${m.points.map((p) => `<li>${p}</li>`).join('')}</ul>
      <a class="gr-deeplink" href="${m.deepLink}"><i class="fa-solid fa-book"></i> Read the full section on this page</a>
      ${agentNote(m.talk)}
      <div class="gr-check">
        <div class="gr-check-h"><i class="fa-solid fa-circle-question"></i> Quick check</div>
        <div class="gr-check-q">${m.check.q}</div>
        <div class="gr-check-opts">${m.check.options.map((o, i) => {
          const cls = answered ? (i === m.check.answer ? ' right' : i === e.answer ? ' wrong' : '') : '';
          return `<button type="button" class="gr-check-opt${cls}" data-answer="${i}" ${answered && e.correct ? 'disabled' : ''}>${o}</button>`;
        }).join('')}</div>
        ${answered ? `<div class="gr-check-fb ${e.correct ? 'ok' : 'no'}"><b>${e.correct ? 'Correct.' : 'Not quite.'}</b> ${m.check.explain}</div>` : ''}
        <label class="gr-confirm"><input type="checkbox" data-confirm="${m.id}" ${e.confirmed ? 'checked' : ''}>
          ${agent() ? 'Client confirmed they understand this topic' : 'I understand this topic'}</label>
      </div>
      <div class="gr-nav">
        <button type="button" class="gr-btn ghost" data-mod="${Math.max(0, S.eduIdx - 1)}" ${S.eduIdx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-left"></i> Previous</button>
        ${S.eduIdx < MODULES.length - 1
          ? `<button type="button" class="gr-btn primary" data-mod="${S.eduIdx + 1}">Next topic <i class="fa-solid fa-arrow-right"></i></button>`
          : `<button type="button" class="gr-btn primary" data-go="2" ${done < MODULES.length && !agent() ? 'disabled' : ''}>Continue to eligibility <i class="fa-solid fa-arrow-right"></i></button>`}
      </div>
      ${agent() && done < MODULES.length ? `<button type="button" class="gr-skip" data-act="skipEdu">Client is already familiar — skip remaining topics (logged in summary)</button>` : ''}
      ${!agent() && S.eduIdx === MODULES.length - 1 && done < MODULES.length ? '<div class="gr-q-hint" style="text-align:right">Complete each topic (answer the check or confirm) to continue.</div>' : ''}
    </div>
  </div>`;
}

function stageEligibility() {
  const p = P();
  const working = p.working === 'self' || p.working === 'spouse';
  return `
  <div class="gr-form">
    ${card('About you', 'fa-user', `<div class="gr-row3">
      ${q('Date of birth', input('dob', 'date'))}
      ${q('ZIP code', input('zip', 'text', '66208'))}
      ${q('State', input('state', 'text', 'KS'))}
    </div>`)}
    ${card('Medicare status', 'fa-id-card', `
      ${q('Part A', chips('partA', [['enrolled', 'Enrolled'], ['not_yet', 'Not yet']]))}
      ${q('Part B', chips('partB', [['enrolled', 'Enrolled'], ['not_yet', 'Not yet enrolled'], ['delayed', 'Delayed / declined']]))}
      ${p.partB === 'enrolled' ? q('Part B effective date', input('partBEffective', 'date'), 'On the red, white, and blue Medicare card. Determines Medigap guaranteed-issue timing.') : ''}
      ${q('Receiving Social Security benefits?', yn('ss'))}
    `)}
    ${card('Current coverage', 'fa-shield', `
      ${q('What coverage do you have today?', chips('currentCoverage', [['none', 'New to Medicare'], ['employer', 'Employer / group'], ['medigap', 'Medigap'], ['ma', 'Medicare Advantage'], ['retiree', 'Retiree plan'], ['marketplace', 'Marketplace / individual']]))}
      ${p.currentCoverage === 'ma' ? q('Is this your first Medicare Advantage plan, joined within the last 12 months?', yn('maFirstYear')) : ''}
      ${q('Lost or losing other health coverage recently?', yn('lostCoverage'))}
    `)}
    ${card('Work & employer coverage', 'fa-briefcase', `
      ${q('Still working with employer coverage?', chips('working', [['no', 'No'], ['self', 'Yes — my employer'], ['spouse', "Yes — spouse's employer"]]))}
      ${working ? q('Employer size', chips('employerSize', [['lt20', 'Fewer than 20 employees'], ['20plus', '20 or more employees']]), 'Rule of 20: under 20 employees, Medicare is usually primary.') : ''}
      ${q('Contributing to a Health Savings Account (HSA)?', yn('hsa'))}
    `)}
    ${card('Assistance & special situations', 'fa-hand-holding-heart', `
      ${q('Medicaid?', chips('medicaid', [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']]))}
      ${q('Extra Help / Low-Income Subsidy for drugs?', chips('lis', [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']]))}
      ${q('Military benefits', chips('va', [['no', 'None'], ['va', 'VA health care'], ['tricare', 'TRICARE For Life']]))}
      ${q('End-Stage Renal Disease (ESRD)?', yn('esrd'))}
    `)}
    ${agentNote('Confirm Part A/B dates against the Medicare card. If the client is still working, ask for a creditable coverage letter from HR before recommending a Part B delay.')}
    <div class="gr-nav">
      <button type="button" class="gr-btn ghost" data-go="1"><i class="fa-solid fa-arrow-left"></i> Back</button>
      <button type="button" class="gr-btn primary" data-go="3">Continue to needs analysis <i class="fa-solid fa-arrow-right"></i></button>
    </div>
  </div>`;
}

function stageNeeds() {
  const p = P();
  const tierOpts = REF.irmaa.map((t) => [String(t.tier), `${t.single} single / ${t.joint} joint`]);
  return `
  <div class="gr-form">
    ${card('Doctors & access', 'fa-user-doctor', `
      ${q('How important is keeping your current doctors?', chips('doctorsKeep', [['must', 'Must keep specific doctors'], ['prefer', 'Prefer to keep them'], ['flexible', 'Open to new doctors']]))}
      ${q('How often do you travel or spend time out of state?', chips('travel', [['frequent', 'Frequently / snowbird'], ['some', 'A few trips a year'], ['rare', 'Rarely']]))}
      ${q('Would you want access to specialty centers (e.g., major cancer or heart centers) outside your area?', yn('specialtyCenter'))}
      ${q('Doctors and specialists to keep', textarea('doctors', 'Dr. name, specialty, clinic…'), 'Used by your agent to check networks. Stays on this device.')}
    `)}
    ${card('Health & expected care', 'fa-heart-pulse', `
      ${q('Doctor visits in a typical year', chips('visits', [['0-2', '0–2'], ['3-6', '3–6'], ['7+', '7 or more']]))}
      ${q('Ongoing conditions (select all that apply)', chips('conditions', [['none', 'None'], ['diabetes', 'Diabetes'], ['heart', 'Heart disease'], ['copd', 'COPD / lung'], ['cancer_history', 'Cancer (current or past)'], ['kidney', 'Kidney disease'], ['autoimmune', 'Autoimmune']], { multi: true }))}
      ${(p.conditions || []).includes('diabetes') ? q('Using insulin?', yn('insulin')) : ''}
      ${q('Hospital stays in the last 2 years', chips('hospitalized', [['0', 'None'], ['1', 'One'], ['2+', 'Two or more']]))}
      ${q('Surgery or procedure planned in the next 12 months?', yn('procedurePlanned'))}
    `)}
    ${card('Prescriptions', 'fa-prescription-bottle-medical', `
      ${q('Number of regular prescriptions', chips('rxCount', [['0', 'None'], ['2', '1–2'], ['4', '3–5'], ['6', '6 or more']]))}
      ${q('Any specialty, injectable, or high-cost brand drugs?', yn('specialtyRx'))}
      ${q('Medication list', textarea('meds', 'Drug name, dosage, frequency…'), 'Your agent runs this against plan formularies. Stays on this device.')}
    `)}
    ${card('Budget & financial protection', 'fa-wallet', `
      ${q('Comfortable monthly budget for coverage (beyond the Part B premium)', chips('budget', [['lt50', 'Under $50'], ['50-150', '$50–150'], ['150-250', '$150–250'], ['250-400', '$250–400'], ['400+', '$400+']]))}
      ${q('If you had an unexpected $5,000 medical bill, could you pay it from savings?', chips('surpriseBill', [['under_1k', 'No — it would be a hardship'], ['1k_5k', 'Possibly, with difficulty'], ['5k_plus', 'Yes, comfortably']]))}
      ${q(`Household income on your ${REF.year - 2} tax return (for IRMAA)`, `<select class="gr-input" data-field="irmaaTier" data-src="profile">${tierOpts.map(([v, l]) => `<option value="${v}" ${String(p.irmaaTier ?? 0) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`, `Higher incomes pay more for Parts B and D in ${REF.year}.`)}
    `)}
    ${card('Protection concerns', 'fa-umbrella', `
      ${q('Family history of cancer?', yn('famCancer'))}
      ${q('Family history of heart attack or stroke?', yn('famHeart'))}
      ${q('Are you worried about the cost of a cancer diagnosis?', yn('cancerWorry'))}
      ${q('Do you live alone?', yn('livesAlone'))}
      ${q('How concerned are you about paying for care at home after an illness or injury?', chips('homeCare', [['high', 'Very concerned'], ['some', 'Somewhat'], ['low', 'Not concerned']]))}
      ${q('Dental needs', chips('dental', [['high', 'Major work expected'], ['some', 'Routine cleanings'], ['low', 'Minimal']]))}
      ${q('Need or expect hearing aids?', yn('hearing'))}
      ${q('Wear glasses or contacts?', yn('vision'))}
    `)}
    ${card('What matters most', 'fa-ranking-star', `
      ${q('Choose up to 3 priorities', chips('priorities', [['freedom', 'Freedom to choose doctors'], ['predictable', 'Predictable costs'], ['low_premium', 'Lowest monthly premium'], ['extras', 'Dental / vision / hearing extras'], ['rx', 'Lowest drug costs'], ['catastrophic', 'Protection from big bills']], { multi: true, max: 3 }))}
    `)}
    ${agentNote('Use open questions: <i>"Walk me through the last time you were in the hospital."</i> <i>"What would a $5,000 bill do to your plans this year?"</i> Record answers as the client states them — don\'t lead.')}
    <div class="gr-nav">
      <button type="button" class="gr-btn ghost" data-go="2"><i class="fa-solid fa-arrow-left"></i> Back</button>
      <button type="button" class="gr-btn primary" data-go="4">See my recommendation <i class="fa-solid fa-arrow-right"></i></button>
    </div>
  </div>`;
}

const NEED_LABEL = { chs: 'Cancer, heart attack, or stroke costs', dvh: 'Dental, vision, and hearing care', hip: 'Hospital stay copays', sthc: 'Recovery and home care' };
function stageRecommend() {
  const r = result();
  const d = r.decision, pf = r.portfolio, x = r.exposure;
  const pathName = d.path === 'supp' ? 'Medicare Supplement path' : 'Medicare Advantage path';
  const scale = Math.max(x.advantage.sickMax, x.medigap.sick) * 1.05;
  const bar = (label, v, cls) => `<div class="gr-bar"><span class="gr-bar-l">${label}</span><span class="gr-bar-t"><span class="gr-bar-f ${cls}" style="width:${Math.max(3, (v / scale) * 100)}%"></span></span><span class="gr-bar-v">${money(v)}</span></div>`;
  const needs = Object.entries(r.needs).filter(([k]) => (d.path === 'supp' ? k !== 'hip' : k !== 'dvh'));
  const inPf = new Set(pf.products.map((p) => p.id));
  return `
  <div class="gr-rec">
    <div class="gr-rec-hero">
      <div>
        <div class="gr-eyebrow light">${S.clientName ? esc(S.clientName) + "'s " : 'Your '}recommended path ${d.overridden ? '· agent adjusted' : ''}</div>
        <h3>${r.design.label}</h3>
        <p>${r.design.why}</p>
      </div>
      <div class="gr-fit"><span class="gr-fit-n">${d.confidence}%</span><span class="gr-fit-l">${d.strength}</span></div>
    </div>

    <div class="gr-rec-grid">
      ${card('Why this path fits', 'fa-circle-check', d.reasons.length ? `<ul class="gr-list ok">${d.reasons.map((s) => `<li>${s}</li>`).join('')}</ul>` : '<p class="gr-muted">Answer more needs-analysis questions to strengthen this recommendation.</p>')}
      ${card('Trade-offs to understand', 'fa-scale-balanced', d.tradeoffs.length ? `<ul class="gr-list warn">${d.tradeoffs.map((s) => `<li>${s}</li>`).join('')}</ul>` : '<p class="gr-muted">No strong pulls toward the other path.</p>')}
    </div>
    ${d.closeCall ? `<div class="gr-flag info"><i class="fa-solid fa-circle-info"></i> This is a close call — both paths are reasonable. Compare actual quotes for each before deciding.</div>` : ''}
    ${agent() ? `<div class="gr-override">Agent adjustment:
      <button type="button" class="gr-chip${!P().pathOverride ? ' on' : ''}" data-set="pathOverride" data-val="">Use engine result</button>
      <button type="button" class="gr-chip${P().pathOverride === 'supp' ? ' on' : ''}" data-set="pathOverride" data-val="supp">Force Supplement</button>
      <button type="button" class="gr-chip${P().pathOverride === 'adv' ? ' on' : ''}" data-set="pathOverride" data-val="adv">Force Advantage</button>
      <span class="gr-muted">Engine scores — Supplement ${d.scores.medigap} · Advantage ${d.scores.advantage}</span></div>` : ''}

    ${card('Your gap analysis', 'fa-magnifying-glass-chart', (needs.length ? `<div class="gr-gaps">${needs.map(([k, n]) => `
      <div class="gr-gap ${n.level}"><div class="gr-gap-h"><b>${NEED_LABEL[k]}</b><span class="gr-tag ${n.level}">${n.level === 'recommended' ? 'High need' : n.level === 'suggested' ? 'Moderate need' : 'Low need'}</span></div>
      <ul>${n.reasons.map((s) => `<li>${s}</li>`).join('')}</ul>
      <div class="gr-gap-f">${inPf.has(k) ? `<i class="fa-solid fa-check"></i> Covered by ${PRODUCTS[k].name}` : '<i class="fa-regular fa-circle"></i> Not in this package — optional add-on'}</div></div>`).join('')}</div>`
      : '<p class="gr-muted">No additional gaps identified beyond core coverage.</p>')
      + (d.path === 'adv' ? '<p class="gr-q-hint" style="margin-top:12px">Dental, vision, and hearing are often built into MA plans — your agent will confirm the allowances.</p>' : '')
      + (d.path === 'supp' ? '<p class="gr-q-hint" style="margin-top:12px">Hospital indemnity isn\'t needed here — Plan G and Plan N already pay the Part A hospital deductible.</p>' : ''))}

    <div class="gr-portfolio">
      <div class="gr-portfolio-h">
        <div><div class="gr-eyebrow">Recommended portfolio · ${pathName}</div><h3 class="gr-h3">Plan ${pf.tier} — ${pf.name}</h3></div>
        <div class="gr-est"><span>Est. monthly bundle</span><b>${money(pf.estimate.bundle[0])}–${money(pf.estimate.bundle[1])}</b>
          <small>+ Part B ${money(pf.estimate.partB)}${pf.estimate.partDSurcharge ? ` + Part D IRMAA ${money(pf.estimate.partDSurcharge)}` : ''} = ${money(pf.estimate.totalLow)}–${money(pf.estimate.totalHigh)} total</small></div>
      </div>
      ${pf.choiceNote ? `<p class="gr-q-hint">${pf.choiceNote}</p>` : ''}
      <ul class="gr-products">${pf.products.map((p) => `
        <li><span class="gr-p-ico"><i class="fa-solid ${p.icon}"></i></span>
          <div><div class="gr-p-n">${p.id === 'medigap' ? `Medicare Supplement Plan ${r.design.plan}` : p.id === 'mapd' ? r.design.label : p.name}
            <span class="gr-tag ${p.role === 'core' ? 'core' : p.level}">${p.role === 'core' ? 'Core coverage' : 'Protection'}</span></div>
          <div class="gr-p-w">${p.reasons.join(' · ')}</div></div></li>`).join('')}</ul>
      ${pf.overBudget ? '<div class="gr-flag warn"><i class="fa-solid fa-triangle-exclamation"></i> This package is above the stated budget. Start with core coverage plus the highest-need protection product, then add others over time.</div>' : ''}
    </div>

    ${card('Illustrative yearly medical costs (excluding Part B premium)', 'fa-chart-column', `
      <div class="gr-bars">
        ${bar(x.medigap.label + ' — healthy year', x.medigap.healthy, 'mg')}
        ${bar(x.medigap.label + ' — high-cost year', x.medigap.sick, 'mg')}
        ${bar('Medicare Advantage — healthy year', x.advantage.healthy, 'ma')}
        ${bar('Medicare Advantage — high-cost year (avg. limit)', x.advantage.sickAvg, 'ma')}
        ${bar('Medicare Advantage — high-cost year (max. limit)', x.advantage.sickMax, 'ma')}
      </div><p class="gr-q-hint">${x.note}</p>`)}

    ${r.flags.length ? card('Items to review', 'fa-flag', r.flags.map((f) => `<div class="gr-flag ${f.level === 'high' ? 'warn' : 'info'}"><i class="fa-solid ${f.level === 'high' ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i> ${f.text}</div>`).join('')) : ''}

    ${agent() ? card('Agent brief', 'fa-headset', `
      <div class="gr-sub">Talk track</div><ul class="gr-list">${r.brief.talkTrack.map((s) => `<li>${s}</li>`).join('')}</ul>
      <div class="gr-sub">Verification checklist</div>
      ${r.brief.checklist.map((c, i) => `<label class="gr-confirm"><input type="checkbox" data-check="${i}" ${S.checklist[i] ? 'checked' : ''}> ${c}</label>`).join('')}`) : `<div class="gr-callout"><i class="fa-solid fa-user-shield"></i> ${r.clientSummary}</div>`}

    <div class="gr-nav">
      <button type="button" class="gr-btn ghost" data-go="3"><i class="fa-solid fa-arrow-left"></i> Adjust answers</button>
      <button type="button" class="gr-btn primary" data-go="5">Next steps <i class="fa-solid fa-arrow-right"></i></button>
    </div>
  </div>`;
}

function stageNext() {
  const r = result();
  return `
  <div class="gr-form">
    ${card('Contact details', 'fa-address-card', `<div class="gr-row2">
      ${q('Full name', input('name', 'text', 'Jane Smith', 'client'))}
      ${q('Phone', input('phone', 'tel', '(913) 555-0100', 'client'))}
      ${q('Email', input('email', 'email', 'jane@example.com', 'client'))}
      ${q('Medicare number (optional)', input('mbi', 'text', '1EG4-TE5-MK72', 'client'))}
    </div>${q(agent() ? 'Agent notes' : 'Questions for your agent', textarea('notes', agent() ? 'Objections, follow-ups, carrier preferences…' : 'Anything you want to ask…'))}`)}
    ${card('Start applications', 'fa-pen-to-square', `<ul class="gr-products">${r.portfolio.products.map((p) => `
      <li><span class="gr-p-ico"><i class="fa-solid ${p.icon}"></i></span><div><div class="gr-p-n">${p.id === 'medigap' ? `Medicare Supplement Plan ${r.design.plan}` : p.id === 'mapd' ? r.design.label : p.name}</div><div class="gr-p-w">${p.desc}</div></div>
      <a class="gr-btn sm" href="${p.href}"><i class="fa-solid fa-pen-to-square"></i> Start</a></li>`).join('')}</ul>`)}
    <div class="gr-actions">
      <button type="button" class="gr-btn primary" data-act="print"><i class="fa-solid fa-print"></i> Print / save summary</button>
      <a class="gr-btn secondary" href="${mailto(r)}"><i class="fa-solid fa-envelope"></i> ${agent() ? 'Email summary' : `Send to ${AGENT.name.split(' ')[0]}`}</a>
      ${agent() ? '<button type="button" class="gr-btn secondary" data-act="copy"><i class="fa-solid fa-copy"></i> Copy agent brief</button>' : `<a class="gr-btn secondary" href="tel:${AGENT.phone.replace(/\D/g, '')}"><i class="fa-solid fa-phone"></i> Call ${AGENT.phone}</a>`}
    </div>
    <div class="gr-disclaimer"><b>Important:</b> ${TPMO_DISCLAIMER} This review is educational and does not guarantee eligibility, pricing, or approval. Estimates use ${REF.year} Medicare figures from <a href="${REF.sources[0].url}" target="_blank" rel="noopener">CMS</a>; final premiums depend on age, ZIP, carrier, and health questions where applicable. Answers are saved only in this browser.</div>
    <div class="gr-nav">
      <button type="button" class="gr-btn ghost" data-go="4"><i class="fa-solid fa-arrow-left"></i> Back to recommendation</button>
      <button type="button" class="gr-btn ghost" data-act="reset"><i class="fa-solid fa-rotate-left"></i> New session</button>
    </div>
  </div>`;
}

// ---------- live sidebar ----------
function sidebar() {
  const p = P();
  const elig = evaluateEligibility(p);
  const s = scorePaths(p, elig);
  const tot = Math.max(1, Math.max(0, s.scores.medigap) + Math.max(0, s.scores.advantage));
  const mgPct = Math.round((Math.max(0, s.scores.medigap) / tot) * 100);
  const answered = ['doctorsKeep', 'travel', 'visits', 'budget', 'surpriseBill', 'hospitalized'].filter((k) => p[k]).length + ((p.priorities || []).length ? 1 : 0);
  const giTxt = { open: 'Open now', upcoming: 'Upcoming', possible: 'Possible', closed: 'Closed', unknown: 'Unknown' }[elig.gi.status];
  const edu = MODULES.filter((x) => eduDone(x.id)).length;
  return `
    <div class="gr-side-card">
      <div class="gr-side-h">Session</div>
      <div class="gr-kv"><span>Mode</span><b>${agent() ? 'Agent-assisted' : 'Self-guided'}</b></div>
      ${S.clientName ? `<div class="gr-kv"><span>Client</span><b>${esc(S.clientName)}</b></div>` : ''}
      <div class="gr-kv"><span>Education</span><b>${S.eduSkipped && edu < MODULES.length ? 'Skipped by agent' : `${edu}/${MODULES.length} topics`}</b></div>
      ${p.zip ? `<div class="gr-kv"><span>ZIP</span><b>${esc(p.zip)} ${esc(p.state || '')}</b></div>` : ''}
    </div>
    <div class="gr-side-card">
      <div class="gr-side-h">Medigap guaranteed issue</div>
      <div class="gr-gi ${elig.gi.status}">${giTxt}</div>
      <p class="gr-side-p">${elig.gi.reason}</p>
      ${elig.windows.filter((w) => w.status === 'open').map((w) => `<div class="gr-win"><i class="fa-solid fa-door-open"></i> <b>${w.label}</b> open · ${w.range}</div>`).join('')}
    </div>
    <div class="gr-side-card">
      <div class="gr-side-h">Path lean ${answered < 3 ? '<span class="gr-muted">(answer more)</span>' : ''}</div>
      <div class="gr-lean"><span class="mg" style="width:${mgPct}%"></span><span class="ma" style="width:${100 - mgPct}%"></span></div>
      <div class="gr-lean-l"><span>Supplement ${mgPct}%</span><span>Advantage ${100 - mgPct}%</span></div>
    </div>
    ${elig.flags.length ? `<div class="gr-side-card"><div class="gr-side-h">Flags (${elig.flags.length})</div>${elig.flags.slice(0, 4).map((f) => `<div class="gr-side-flag ${f.level}">${f.text}</div>`).join('')}</div>` : ''}`;
}

// ---------- shell ----------
function render() {
  const el = root(); if (!el) return;
  const body = [stageStart, stageLearn, stageEligibility, stageNeeds, stageRecommend, stageNext][S.stage]();
  el.innerHTML = `
    <div class="gr-stepper">${STAGES.map((st, i) => `<button type="button" class="gr-step${i === S.stage ? ' on' : ''}${i < S.stage ? ' done' : ''}" data-go="${i}" ${i > S.stage + 1 && !reachable(i) ? 'disabled' : ''}>
      <span class="gr-step-n">${i < S.stage ? '<i class="fa-solid fa-check"></i>' : i + 1}</span><span class="gr-step-l">${st.label}</span></button>`).join('')}</div>
    <div class="gr-shell${S.stage === 0 ? ' solo' : ''}">
      <div class="gr-main">${body}</div>
      ${S.stage === 0 ? '' : `<aside class="gr-side" id="gr-side">${sidebar()}</aside>`}
    </div>`;
}
function reachable(i) { return S.maxStage != null && i <= S.maxStage; }
function refreshSide() { const s = document.getElementById('gr-side'); if (s) s.innerHTML = sidebar(); }
function go(n) {
  S.stage = Math.max(0, Math.min(STAGES.length - 1, n));
  S.maxStage = Math.max(S.maxStage ?? 0, S.stage);
  save(); render();
  const sec = document.getElementById('get-started');
  if (sec) window.scrollTo({ top: sec.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
}

function mailto(r) {
  const lines = summaryLines(r);
  const subj = `Medicare Guided Review — ${S.client.name || S.clientName || 'Client'}`;
  return `mailto:${AGENT.email}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(lines.join('\n'))}`;
}
function summaryLines(r) {
  const pf = r.portfolio;
  return [
    `Client: ${S.client.name || S.clientName || '—'}  ·  ZIP ${P().zip || '—'}`,
    `Session: ${agent() ? 'Agent-assisted (' + S.agentName + ')' : 'Self-guided'}  ·  ${new Date().toLocaleDateString()}`,
    `Education: ${MODULES.filter((x) => eduDone(x.id)).length}/${MODULES.length} topics${S.eduSkipped ? ' (remaining skipped by agent)' : ''}`,
    '',
    `Recommended path: ${r.design.label} (${r.decision.strength}, ${r.decision.confidence}%)${r.decision.overridden ? ' — agent override' : ''}`,
    ...r.decision.reasons.map((s) => `  + ${s}`),
    ...r.decision.tradeoffs.map((s) => `  – ${s}`),
    '',
    `Portfolio: Plan ${pf.tier} — ${pf.name}  (est. ${money(pf.estimate.bundle[0])}–${money(pf.estimate.bundle[1])}/mo + Part B ${money(pf.estimate.partB)})`,
    ...pf.products.map((p) => `  • ${p.name}: ${p.reasons.join('; ')}`),
    '',
    `Medigap guaranteed issue: ${r.eligibility.gi.status} — ${r.eligibility.gi.reason}`,
    ...r.flags.map((f) => `  ! ${f.text}`),
    '',
    S.client.notes ? `Notes: ${S.client.notes}` : ''
  ].filter((l, i, a) => !(l === '' && a[i - 1] === ''));
}

function printSummary() {
  const r = result();
  let sheet = document.getElementById('gr-print-sheet');
  if (!sheet) { sheet = document.createElement('div'); sheet.id = 'gr-print-sheet'; document.body.appendChild(sheet); }
  sheet.innerHTML = `<h1>Medicare Guided Review</h1><p class="ps-sub">SelectQuote · ${AGENT.name} · ${AGENT.phone} · ${new Date().toLocaleDateString()}</p>
    <h2>${r.design.label}</h2><p>${r.clientSummary}</p>
    <h3>Recommended portfolio — Plan ${r.portfolio.tier}: ${r.portfolio.name}</h3>
    <ul>${r.portfolio.products.map((p) => `<li><b>${p.name}</b> — ${p.reasons.join('; ')}</li>`).join('')}</ul>
    <p>Estimated bundle ${money(r.portfolio.estimate.bundle[0])}–${money(r.portfolio.estimate.bundle[1])}/month, plus Part B premium ${money(r.portfolio.estimate.partB)}.</p>
    ${r.flags.length ? `<h3>Items to review</h3><ul>${r.flags.map((f) => `<li>${f.text}</li>`).join('')}</ul>` : ''}
    ${S.client.doctors ? `<h3>Doctors</h3><p>${esc(S.client.doctors)}</p>` : ''}
    ${S.client.meds ? `<h3>Medications</h3><p>${esc(S.client.meds)}</p>` : ''}
    <p class="ps-disc">${TPMO_DISCLAIMER} Educational summary — not a quote or guarantee of coverage. ${REF.year} figures: CMS.</p>`;
  document.body.classList.add('gr-printing');
  const done = () => { document.body.classList.remove('gr-printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
  setTimeout(done, 1500);
}

// ---------- events ----------
function onClick(e) {
  const t = e.target.closest('button, [data-go]');
  if (!t || !root()?.contains(t)) return;
  if (t.dataset.go != null) return go(+t.dataset.go);
  if (t.dataset.mode) { S.mode = t.dataset.mode; save(); return render(); }
  if (t.dataset.mod != null) { S.eduIdx = +t.dataset.mod; save(); return render(); }
  if (t.dataset.answer != null) {
    const m = MODULES[S.eduIdx]; const a = +t.dataset.answer;
    S.edu[m.id] = { ...(S.edu[m.id] || {}), answer: a, correct: a === m.check.answer };
    save(); return render();
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
    } else P()[f] = P()[f] === v && f !== 'pathOverride' ? undefined : v;
    save(); return render();
  }
  const act = t.dataset.act;
  if (act === 'reset') { if (confirm('Start a new session? Current answers on this device will be cleared.')) { localStorage.removeItem(STORE_KEY); S = load(); render(); } return; }
  if (act === 'skipEdu') { S.eduSkipped = true; save(); return go(2); }
  if (act === 'print') return printSummary();
  if (act === 'copy') {
    const r = result();
    const txt = [...summaryLines(r), '', 'Verification checklist:', ...r.brief.checklist.map((c) => '  [ ] ' + c)].join('\n');
    navigator.clipboard?.writeText(txt).then(() => { t.innerHTML = '<i class="fa-solid fa-check"></i> Copied'; });
  }
}
function onInput(e) {
  const t = e.target;
  if (!root()?.contains(t)) return;
  if (t.dataset.root) { S[t.dataset.root] = t.value; save(); return refreshSide(); }
  if (t.dataset.confirm) { const id = t.dataset.confirm; S.edu[id] = { ...(S.edu[id] || {}), confirmed: t.checked }; save(); return e.type === 'change' && render(); }
  if (t.dataset.check != null) { S.checklist[t.dataset.check] = t.checked; return save(); }
  if (t.dataset.field) {
    const tgt = t.dataset.src === 'client' ? S.client : P();
    tgt[t.dataset.field] = t.dataset.field === 'irmaaTier' ? +t.value : t.value;
    save(); refreshSide();
  }
}

// ---------- page integration ----------
function setInterest(path, tier) {
  P().statedInterest = { path, tier };
  save();
  if (S.stage === 0) S.stage = 1;
  go(S.stage);
}
function mountLauncher() {
  const slot = document.getElementById('sq-recommend-mount');
  if (!slot) return;
  slot.innerHTML = `<div class="gr-launch">
    <div class="gr-launch-eb">Guided Medicare Review</div>
    <h3>Learn, analyze, and get your recommended coverage — in one guided session.</h3>
    <ol>${STAGES.slice(1).map((s) => `<li><i class="fa-solid ${s.icon}"></i>${s.label}</li>`).join('')}</ol>
    <a href="#get-started" class="gr-btn primary" data-launch>Start Guided Review <i class="fa-solid fa-arrow-right"></i></a>
    <small>Free · About 15–20 minutes · Answers stay on your device</small></div>`;
}
function mountFab() {
  if (document.getElementById('gr-fab')) return;
  const b = document.createElement('a');
  b.id = 'gr-fab'; b.href = '#get-started'; b.className = 'gr-fab';
  b.innerHTML = '<i class="fa-solid fa-route"></i> Guided Review';
  document.body.appendChild(b);
  const sec = document.getElementById('get-started');
  if (sec && 'IntersectionObserver' in window) new IntersectionObserver(([en]) => b.classList.toggle('hide', en.isIntersecting), { threshold: 0.05 }).observe(sec);
}

function init() {
  if (!root()) return;
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onInput);
  window.selectPackage = setInterest; // package cards → guided flow
  window.SQGuidedReview = { analyze: result, state: () => S, go };
  mountLauncher();
  mountFab();
  render();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
