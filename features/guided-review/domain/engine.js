// Guided Review slice — deterministic Medicare needs-analysis engine.
// Pure functions only: no DOM, no network, no storage. Used by the browser UI and by /api/recommend.
// Every recommendation carries the reasons that produced it so agents can explain and audit it.

import { REF, PRODUCTS, PACKAGES } from './reference-2026.js';

const SERIOUS = ['cancer_history', 'heart', 'copd', 'kidney'];
const CSNP_CONDITIONS = ['diabetes', 'heart', 'copd', 'kidney'];
const BUDGET_MAX = { lt50: 50, '50-150': 150, '150-250': 250, '250-400': 400, '400+': Infinity };

const arr = (v) => (Array.isArray(v) ? v : []);
const has = (list, k) => arr(list).includes(k);
const num = (v, d = null) => { const x = Number(v); return v === '' || v == null || !Number.isFinite(x) ? d : x; };

function parseDate(s) {
  if (!s) return null;
  const d = new Date(String(s).length === 10 ? s + 'T12:00:00' : s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function addMonths(d, m) { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; }
function monthStart(d) { return new Date(d.getFullYear(), d.getMonth(), 1, 12); }
function monthEnd(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12); }
const fmt = (d) => d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

export function ageOn(dob, today) {
  const b = parseDate(dob); if (!b) return null;
  let a = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) a--;
  return a;
}

// ---------- Stage 2: eligibility, enrollment windows, guaranteed issue ----------
export function evaluateEligibility(p = {}, today = new Date()) {
  const windows = [];
  const flags = [];
  const age = num(p.age) ?? ageOn(p.dob, today);
  const dob = parseDate(p.dob);

  // Initial Enrollment Period: 3 months before birth month → 3 months after.
  if (dob) {
    const b65 = new Date(dob); b65.setFullYear(dob.getFullYear() + 65);
    const start = monthStart(addMonths(b65, -3));
    const end = monthEnd(addMonths(b65, 3));
    const status = today < start ? 'upcoming' : today <= end ? 'open' : 'closed';
    windows.push({ id: 'iep', label: 'Initial Enrollment Period (IEP)', status, range: `${fmt(start)} – ${fmt(end)}`,
      note: 'Seven-month window around your 65th birthday to enroll in Parts A, B, C, and D.' });
  }

  // Medigap Open Enrollment: 6 months starting the month Part B is effective (and age 65+).
  let gi = { status: 'unknown', reason: 'Add Part B effective date to determine Medigap guaranteed-issue rights.' };
  const pb = parseDate(p.partBEffective);
  if (p.partB === 'not_yet' || p.partB === 'delayed') {
    gi = { status: 'upcoming', reason: 'Medigap Open Enrollment starts when Part B begins (age 65+). Buying then avoids health questions.' };
    windows.push({ id: 'mgoep', label: 'Medigap Open Enrollment', status: 'upcoming', range: 'Starts with Part B effective date', note: '6 months of guaranteed issue — no health underwriting.' });
  } else if (pb) {
    const start = monthStart(pb);
    const startAt65 = dob ? new Date(Math.max(start, monthStart(new Date(dob.getFullYear() + 65, dob.getMonth(), 1)))) : start;
    const end = monthEnd(addMonths(startAt65, 5));
    const status = today < startAt65 ? 'upcoming' : today <= end ? 'open' : 'closed';
    windows.push({ id: 'mgoep', label: 'Medigap Open Enrollment', status, range: `${fmt(startAt65)} – ${fmt(end)}`, note: '6 months of guaranteed issue — no health underwriting.' });
    gi = status === 'closed'
      ? { status: 'closed', reason: 'Medigap Open Enrollment has ended. Most Medigap applications will require health underwriting unless a guaranteed-issue right applies.' }
      : { status: status === 'open' ? 'open' : 'upcoming', reason: status === 'open' ? `Guaranteed issue is open now through ${fmt(end)} — the best time to buy Medigap.` : `Guaranteed issue begins ${fmt(startAt65)}.` };
  }
  if (gi.status !== 'open' && gi.status !== 'upcoming') {
    if (p.lostCoverage === 'yes') gi = { status: 'possible', reason: 'Recently lost employer/retiree or other coverage — a federal guaranteed-issue right (generally 63 days) may apply. Verify the qualifying event.' };
    else if (p.currentCoverage === 'ma' && p.maFirstYear === 'yes') gi = { status: 'possible', reason: 'Within the first 12 months of a first Medicare Advantage plan — "trial right" may allow a guaranteed-issue return to Medigap.' };
  }

  // Annual windows relative to today.
  const y = today.getFullYear();
  const aepStart = new Date(y, 9, 15, 0), aepEnd = new Date(y, 11, 7, 23, 59);
  const aepStatus = today < aepStart ? 'upcoming' : today <= aepEnd ? 'open' : 'closed';
  windows.push({ id: 'aep', label: 'Annual Enrollment Period (AEP)', status: aepStatus,
    range: aepStatus === 'closed' ? `Oct 15 – Dec 7, ${y + 1}` : `Oct 15 – Dec 7, ${y}`,
    note: `Join, switch, or drop Medicare Advantage or Part D. Changes take effect Jan 1, ${aepStatus === 'closed' ? y + 2 : y + 1}.` });
  if (p.currentCoverage === 'ma') {
    const oS = new Date(y, 0, 1), oE = new Date(y, 2, 31, 23, 59);
    const st = today < oS ? 'upcoming' : today <= oE ? 'open' : 'closed';
    windows.push({ id: 'maoep', label: 'Medicare Advantage Open Enrollment', status: st === 'closed' ? 'upcoming' : st,
      range: st === 'closed' ? `Jan 1 – Mar 31, ${y + 1}` : `Jan 1 – Mar 31, ${y}`, note: 'Current MA members can make one plan switch or return to Original Medicare.' });
  }
  if (p.working === 'self' || p.working === 'spouse' || p.lostCoverage === 'yes') {
    windows.push({ id: 'sep', label: 'Special Enrollment Period (employer coverage)', status: p.lostCoverage === 'yes' ? 'open' : 'upcoming',
      range: 'Part B: up to 8 months after employment/coverage ends', note: 'Part C/D SEP is shorter (generally 2 months). Confirm dates before coverage ends.' });
  }

  // Red flags.
  if (p.hsa === 'yes') flags.push({ level: 'high', text: 'HSA contributions must stop up to 6 months before Part A starts (Part A can be backdated up to 6 months). Excess contributions face a 6% IRS excise tax.' });
  if ((p.working === 'self' || p.working === 'spouse') && p.employerSize === 'lt20') flags.push({ level: 'high', text: 'Employer has fewer than 20 employees — Medicare is generally primary at 65. Delaying Part B could leave a coverage gap and a late penalty.' });
  if ((p.working === 'self' || p.working === 'spouse') && p.employerSize === '20plus') flags.push({ level: 'info', text: 'Employer has 20+ employees — group plan is primary; Part B can usually be delayed without penalty. Get a creditable coverage letter.' });
  if (p.partB === 'delayed' && !(p.working === 'self' || p.working === 'spouse')) flags.push({ level: 'high', text: 'Part B delayed without active employer coverage — late enrollment penalty (10% per full 12 months) may apply. Review General Enrollment Period.' });
  if (p.medicaid === 'yes') flags.push({ level: 'high', text: 'Medicaid / dual-eligible — review Dual Special Needs Plans (D-SNP) and Extra Help. A Medigap policy is generally not appropriate for full duals.' });
  if (p.medicaid === 'unsure' || p.lis === 'unsure') flags.push({ level: 'info', text: 'Screen for Medicare Savings Programs and Extra Help (LIS) — may lower Part B and drug costs.' });
  if (p.va === 'va') flags.push({ level: 'info', text: 'VA benefits — VA drug coverage is creditable. Coordinate Part B/Part D decisions with VA care usage.' });
  if (p.va === 'tricare') flags.push({ level: 'high', text: 'TRICARE For Life requires Part B and works like a supplement — Medigap is usually unnecessary. Confirm before selling Medigap.' });
  if (p.esrd === 'yes') flags.push({ level: 'info', text: 'ESRD — eligible for Medicare Advantage; Medigap availability under 65 varies by state.' });
  if (age != null && age < 65 && p.esrd !== 'yes' && p.disability !== 'yes') flags.push({ level: 'info', text: `Client is ${age}. Confirm Medicare eligibility timing (age 65, SSDI 24 months, ESRD, or ALS).` });
  if (has(['MO'], p.state)) flags.push({ level: 'info', text: 'Missouri has a Medigap anniversary switching window — verify current state rules before replacing a policy.' });

  return { age, windows, gi, flags };
}

// ---------- Stage 3: underwriting feasibility ----------
export function underwritingRisk(p = {}) {
  const c = arr(p.conditions);
  const serious = c.filter((x) => SERIOUS.includes(x));
  const reasons = [];
  if (serious.length) reasons.push('Reported condition(s): ' + serious.map(labelCondition).join(', '));
  if (p.hospitalized === '2+') reasons.push('Two or more hospital stays in the last 2 years');
  if (p.procedurePlanned === 'yes') reasons.push('Planned surgery or procedure');
  if (has(c, 'diabetes') && p.insulin === 'yes') reasons.push('Insulin-dependent diabetes');
  const level = serious.length || p.hospitalized === '2+' || p.procedurePlanned === 'yes' ? 'high'
    : (has(c, 'diabetes') || p.hospitalized === '1' ? 'moderate' : 'low');
  return { level, reasons };
}

export function labelCondition(k) {
  return ({ diabetes: 'diabetes', heart: 'heart disease', copd: 'COPD / lung disease', cancer_history: 'cancer (current or past)',
    kidney: 'kidney disease', autoimmune: 'autoimmune condition', mental: 'behavioral health' })[k] || k;
}

// ---------- Stage 3: path scoring (Medigap vs Medicare Advantage) ----------
export function scorePaths(p = {}, elig = evaluateEligibility(p)) {
  let mg = 0, ma = 0;
  const r = { medigap: [], advantage: [] };
  const add = (side, pts, why) => { if (side === 'mg') { mg += pts; if (why) r.medigap.push(why); } else { ma += pts; if (why) r.advantage.push(why); } };
  const pri = arr(p.priorities);
  const c = arr(p.conditions);

  if (p.doctorsKeep === 'must') add('mg', 20, 'Must keep specific doctors — Medigap works with any provider that accepts Medicare');
  if (p.doctorsKeep === 'prefer') add('mg', 8, 'Prefers to keep current doctors');
  if (p.doctorsKeep === 'flexible') add('ma', 10, 'Open to using a plan network');
  if (p.travel === 'frequent') add('mg', 15, 'Travels or lives part of the year out of state');
  if (p.travel === 'some') add('mg', 6, 'Travels occasionally');
  if (p.travel === 'rare') add('ma', 4, 'Receives care locally');
  if (p.specialtyCenter === 'yes') add('mg', 12, 'Wants access to specialty centers that may be out of network');
  if (p.visits === '7+') add('mg', 15, 'High expected utilization (7+ visits/year) — copays add up under MA');
  if (p.visits === '3-6') add('mg', 5, null);
  if (p.visits === '0-2') add('ma', 10, 'Low expected utilization');
  if (c.filter((x) => x !== 'none').length >= 2) add('mg', 10, 'Manages multiple chronic conditions');
  else if (c.filter((x) => x !== 'none').length === 1) add('mg', 5, null);
  if (p.procedurePlanned === 'yes') add('mg', 10, 'Procedure planned in the next 12 months');
  if (p.hospitalized === '2+') add('mg', 10, 'Multiple recent hospital stays');
  if (p.hospitalized === '1') add('mg', 5, null);

  if (p.budget === 'lt50') add('ma', 25, 'Budget under $50/mo beyond Part B favors a $0–low premium MA plan');
  if (p.budget === '50-150') add('ma', 12, 'Budget of $50–150/mo favors Medicare Advantage');
  if (p.budget === '150-250') add('mg', 8, 'Budget supports a Medigap premium');
  if (p.budget === '250-400' || p.budget === '400+') add('mg', 15, 'Budget comfortably supports Medigap plus protection products');
  if (p.surpriseBill === 'under_1k') add('mg', 12, 'Could not absorb a large unexpected bill — values first-dollar protection');
  if (p.surpriseBill === '1k_5k') add('mg', 4, null);
  if (p.surpriseBill === '5k_plus') add('ma', 6, 'Can absorb an out-of-pocket maximum in a bad year');

  if (has(pri, 'freedom')) add('mg', 15, 'Top priority: freedom to choose doctors');
  if (has(pri, 'predictable')) add('mg', 15, 'Top priority: predictable costs');
  if (has(pri, 'catastrophic')) add('mg', 8, 'Top priority: protection from catastrophic costs');
  if (has(pri, 'low_premium')) add('ma', 15, 'Top priority: lowest monthly premium');
  if (has(pri, 'extras')) add('ma', 12, 'Top priority: built-in dental, vision, hearing, and OTC extras');
  if (p.dental === 'high' && has(pri, 'extras')) add('ma', 5, null);

  if (p.medicaid === 'yes') add('ma', 40, 'Dual-eligible — D-SNPs coordinate Medicare and Medicaid benefits');

  const uw = underwritingRisk(p);
  let medigapFeasible = 'yes';
  if (elig.gi.status === 'open' || elig.gi.status === 'upcoming') add('mg', 5, 'Guaranteed-issue window available — Medigap can be bought without health questions');
  else if (uw.level === 'high' && (elig.gi.status === 'closed' || elig.gi.status === 'unknown')) {
    medigapFeasible = 'unlikely';
    add('mg', -30, null);
    add('ma', 15, 'Medigap health underwriting may be difficult outside a guaranteed-issue window; MA has no health questions');
  } else if (uw.level === 'moderate' && elig.gi.status === 'closed') medigapFeasible = 'review';

  const total = Math.max(1, Math.abs(mg) + Math.abs(ma));
  const path = mg >= ma ? 'supp' : 'adv';
  const margin = Math.abs(mg - ma);
  const confidence = Math.round(50 + (margin / total) * 50);
  const strength = margin < 10 ? 'Close call' : confidence >= 75 ? 'Strong fit' : 'Good fit';
  return { path, scores: { medigap: mg, advantage: ma }, confidence, strength, closeCall: margin < 10,
    reasons: path === 'supp' ? r.medigap : r.advantage, tradeoffs: path === 'supp' ? r.advantage : r.medigap,
    medigapFeasible, underwriting: uw };
}

// ---------- Plan design within the chosen path ----------
export function planDesign(p, path) {
  const c = arr(p.conditions);
  if (path === 'supp') {
    const leanN = (p.budget === '50-150' || p.budget === '150-250' || p.budget === 'lt50') && p.visits === '0-2' && p.surpriseBill !== 'under_1k';
    return {
      label: leanN ? 'Medigap Plan N + Part D' : 'Medigap Plan G + Part D',
      plan: leanN ? 'N' : 'G',
      why: leanN
        ? 'Plan N trades a lower premium for small copays (up to $20 office / $50 ER) and possible Part B excess charges — a fit for light users on a budget.'
        : `Plan G covers nearly everything after the $${REF.partB.deductible} Part B deductible (2026) — the most predictable option.`
    };
  }
  if (p.medicaid === 'yes') return { label: 'Dual Special Needs Plan (D-SNP)', plan: 'D-SNP', why: 'Built for people with both Medicare and Medicaid; coordinates benefits and often adds extras.' };
  const csnp = c.some((x) => CSNP_CONDITIONS.includes(x));
  const ppo = p.doctorsKeep === 'must' || p.travel === 'frequent' || p.travel === 'some' || p.specialtyCenter === 'yes';
  return {
    label: ppo ? 'Medicare Advantage PPO (with Part D)' : 'Medicare Advantage HMO (with Part D)',
    plan: ppo ? 'PPO' : 'HMO',
    csnp,
    why: (ppo ? 'A PPO keeps some out-of-network flexibility for doctors and travel, at a higher combined out-of-pocket limit.'
      : 'An HMO typically offers the lowest premiums and copays in exchange for using network doctors and referrals.')
      + (csnp ? ' Also check Chronic Condition SNPs (C-SNP) for the reported condition.' : '')
  };
}

// ---------- Risk-to-product mapping (gap analysis) ----------
export function assessNeeds(p, path, age) {
  const c = arr(p.conditions);
  const pri = arr(p.priorities);
  const needs = {};
  const add = (k, pts, why) => { needs[k] = needs[k] || { score: 0, reasons: [] }; needs[k].score += pts; if (why) needs[k].reasons.push(why); };

  // Critical illness (cancer / heart attack / stroke)
  if (p.famCancer === 'yes') add('chs', 2, 'Family history of cancer');
  if (p.famHeart === 'yes') add('chs', 2, 'Family history of heart attack or stroke');
  if (has(c, 'heart')) add('chs', 1, 'Existing heart condition — confirm eligibility/waiting periods');
  if (has(pri, 'catastrophic')) add('chs', 1, 'Wants protection from catastrophic costs');
  if (p.surpriseBill === 'under_1k') add('chs', 1, 'Limited savings for non-medical costs (travel, lost income, caregiving)');
  if (path === 'adv') add('chs', 1, 'Lump sum offsets MA out-of-pocket maximum exposure');
  if (p.cancerWorry === 'yes') add('chs', 2, 'Client is concerned about the cost of a cancer diagnosis');

  // Dental / Vision / Hearing (Medigap path only — MA usually embeds limited DVH)
  if (p.dental === 'high') add('dvh', 3, 'Expects major dental work (crowns, dentures, implants)');
  if (p.dental === 'some') add('dvh', 2, 'Wants routine dental cleanings and exams');
  if (p.hearing === 'yes') add('dvh', 1, 'Needs or expects hearing aids (avg. ~$4,700/pair, not covered by Original Medicare)');
  if (p.vision === 'yes') add('dvh', 1, 'Wears glasses or contacts');

  // Hospital indemnity (MA path — Medigap G/N already covers Part A deductible)
  if (path === 'adv') {
    if (p.hospitalized === '1' || p.hospitalized === '2+') add('hip', 2, 'Recent hospital stay(s) — MA inpatient copays apply per stay');
    if (c.filter((x) => x !== 'none').length) add('hip', 1, 'Chronic condition raises admission risk');
    if (p.procedurePlanned === 'yes') add('hip', 2, 'Planned procedure — cash benefit offsets copays');
    if (p.surpriseBill === 'under_1k' || p.surpriseBill === '1k_5k') add('hip', 2, `Cannot comfortably absorb an MA out-of-pocket max (up to $${REF.ma.moopInNetworkMax.toLocaleString()} in-network in 2026)`);
  }

  // Short-term home healthcare
  if (p.livesAlone === 'yes') add('sthc', 2, 'Lives alone — no in-home caregiver for recovery');
  if (p.homeCare === 'high') add('sthc', 3, 'Concerned about paying for in-home or custodial care');
  if (p.homeCare === 'some') add('sthc', 1, null);
  if (age != null && age >= 75) add('sthc', 1, 'Age 75+ — higher likelihood of needing recovery care');
  if (p.procedurePlanned === 'yes') add('sthc', 1, 'Recovery support after a planned procedure');

  Object.values(needs).forEach((n) => { n.level = n.score >= 3 ? 'recommended' : n.score >= 2 ? 'suggested' : 'optional'; });
  return needs;
}

// ---------- Stage 4: portfolio — smallest package that covers every identified need ----------
export function buildPortfolio(p, path, needs, irmaaTier = 0) {
  const lvl = (k) => needs[k]?.level;
  const wants = (k) => lvl(k) === 'recommended' || lvl(k) === 'suggested';
  let tier;
  if (path === 'supp') tier = wants('sthc') ? 'C' : (wants('chs') && wants('dvh') ? 'B' : 'A');
  else tier = wants('sthc') ? 'C' : (wants('hip') && wants('chs') ? 'B' : 'A');
  const pkg = PACKAGES[path][tier];

  let ancillary = Array.isArray(pkg.ancillary) ? pkg.ancillary.slice() : null;
  let choiceNote = null;
  if (!ancillary) {
    // Essential tier: pick the single highest-scoring ancillary from the pool.
    const [a, b] = pkg.pool;
    const pick = (needs[b]?.score || 0) > (needs[a]?.score || 0) ? b : a;
    ancillary = [pick];
    choiceNote = `Essential includes one of ${PRODUCTS[a].name} or ${PRODUCTS[b].name}; ${PRODUCTS[pick].name} scored higher for this client.`;
  }
  const products = [...pkg.core, ...ancillary].map((k) => ({
    id: k, ...PRODUCTS[k],
    role: pkg.core.includes(k) ? 'core' : 'protection',
    level: pkg.core.includes(k) ? 'core' : (lvl(k) || 'included'),
    reasons: pkg.core.includes(k) ? coreReason(k) : (needs[k]?.reasons?.length ? needs[k].reasons : ['Included in the ' + pkg.name + ' package'])
  }));

  const irmaa = REF.irmaa[irmaaTier] || REF.irmaa[0];
  const bundle = pkg.price;
  const partD = irmaa.partD;
  const totalLow = +(bundle[0] + irmaa.partB + partD).toFixed(2);
  const totalHigh = +(bundle[1] + irmaa.partB + partD).toFixed(2);
  const bmax = BUDGET_MAX[p.budget];
  const overBudget = bmax != null && bundle[0] > bmax;
  return { path, tier, name: pkg.name, products, choiceNote, estimate: { bundle, partB: irmaa.partB, partDSurcharge: partD, totalLow, totalHigh }, overBudget };
}

function coreReason(k) {
  if (k === 'medigap') return ['Pays Original Medicare deductibles and 20% coinsurance — Original Medicare has no out-of-pocket cap'];
  if (k === 'pdp') return [`Required for drug coverage with Medigap; avoids the Part D late penalty. 2026 out-of-pocket drug costs cap at $${REF.partD.oopCap.toLocaleString()}`];
  if (k === 'mapd') return ['Combines hospital, medical, and drug coverage with an annual out-of-pocket maximum'];
  return [];
}

// ---------- Illustrative annual exposure (medical only, excludes Part B premium) ----------
export function exposure(path, design) {
  const i = REF.illustrative;
  const g = design?.plan === 'N' ? i.medigapN : i.medigapG;
  const mgPrem = Math.round((g[0] + g[1]) / 2) * 12;
  return {
    medigap: { label: design?.plan === 'N' ? 'Medigap Plan N' : 'Medigap Plan G', healthy: mgPrem + (design?.plan === 'N' ? REF.partB.deductible + 100 : REF.partB.deductible), sick: mgPrem + REF.partB.deductible + (design?.plan === 'N' ? 600 : 0) },
    advantage: { label: 'Medicare Advantage', healthy: Math.round((i.maPremium[0] + i.maPremium[1]) / 2) * 12 + 300, sickAvg: REF.ma.moopInNetworkAvg, sickMax: REF.ma.moopInNetworkMax },
    note: `Illustrative only. Medigap uses an assumed premium midpoint; MA uses the 2026 average ($${REF.ma.moopInNetworkAvg.toLocaleString()}) and federal maximum ($${REF.ma.moopInNetworkMax.toLocaleString()}) in-network out-of-pocket limits. Part D costs cap at $${REF.partD.oopCap.toLocaleString()} on either path.`
  };
}

// ---------- Agent brief ----------
export function agentBrief(p, decision, design, portfolio, elig) {
  const checklist = [];
  if (decision.path === 'adv' || portfolio.products.some((x) => x.id === 'pdp')) checklist.push('Confirm a Scope of Appointment is documented before discussing MA or Part D plans.');
  checklist.push('Read the TPMO disclaimer and confirm the call is recorded per your compliance policy.');
  checklist.push('Confirm ZIP, county, Part A/B effective dates, and Medicare number.');
  if (decision.path === 'supp') {
    checklist.push(elig.gi.status === 'open' || elig.gi.status === 'upcoming' ? 'Guaranteed issue applies — submit Medigap within the open enrollment window.' : 'Run carrier health questions before quoting Medigap; have an MA fallback ready.');
    checklist.push('Quote Plan G vs. Plan N across carriers; check household/discounts and rate-increase history.');
  } else {
    checklist.push('Verify every listed doctor and hospital is in-network for shortlisted plans.');
    checklist.push('Compare MOOP, inpatient copays per day, and prior-authorization rules.');
    checklist.push('Review embedded dental/vision/hearing allowances vs. client needs.');
  }
  if (num(p.rxCount, 0) > 0 || p.specialtyRx === 'yes') checklist.push('Run the full drug list and preferred pharmacy against formularies (tiers, prior auth, step therapy).');
  if (portfolio.products.some((x) => x.id === 'chs' || x.id === 'hip' || x.id === 'sthc')) checklist.push('Ancillary products: confirm health questions, waiting periods, and benefit amounts; explain these pay cash in addition to health coverage.');
  if (portfolio.overBudget) checklist.push('Bundle exceeds the stated budget — prioritize the highest-scoring protection product first.');

  const talkTrack = [
    `"Based on what you've shared, ${design.label} lines up best with what matters most to you."`,
    decision.reasons[0] ? `"The biggest reason: ${decision.reasons[0].charAt(0).toLowerCase() + decision.reasons[0].slice(1)}."` : null,
    decision.tradeoffs[0] ? `"The trade-off to be aware of: ${decision.tradeoffs[0].charAt(0).toLowerCase() + decision.tradeoffs[0].slice(1)} — that is what the other path does better."` : null,
    `"The ${portfolio.name} package fills the gaps we identified, so a single diagnosis or hospital stay doesn't become a financial setback."`
  ].filter(Boolean);
  return { checklist, talkTrack };
}

// ---------- Orchestrator ----------
export function analyze(profile = {}, today = new Date()) {
  const p = profile || {};
  const elig = evaluateEligibility(p, today);
  let decision = scorePaths(p, elig);
  if (p.pathOverride === 'supp' || p.pathOverride === 'adv') decision = { ...decision, overridden: true, enginePath: decision.path, path: p.pathOverride };
  const design = planDesign(p, decision.path);
  const needs = assessNeeds(p, decision.path, elig.age);
  const portfolio = buildPortfolio(p, decision.path, needs, num(p.irmaaTier, 0));
  const brief = agentBrief(p, decision, design, portfolio, elig);
  const flags = [...elig.flags];
  if (decision.path === 'supp' && decision.medigapFeasible === 'unlikely') flags.unshift({ level: 'high', text: 'Medigap is recommended on preferences, but reported health history may not pass underwriting outside a guaranteed-issue window. Pre-screen before applying.' });
  if (decision.path === 'supp' && decision.medigapFeasible === 'review') flags.push({ level: 'info', text: 'Moderate underwriting exposure — pre-screen carrier health questions before submitting Medigap.' });
  if (p.statedInterest && p.statedInterest.path && p.statedInterest.path !== decision.path) flags.push({ level: 'info', text: `Client initially showed interest in the ${p.statedInterest.path === 'supp' ? 'Medicare Supplement' : 'Medicare Advantage'} packages — discuss why the analysis points the other way.` });

  const clientSummary = `Based on your answers, ${design.label} is the ${decision.closeCall ? 'slightly better' : 'stronger'} fit for you`
    + (decision.reasons.length ? `, mainly because: ${decision.reasons.slice(0, 2).map((s) => s.charAt(0).toLowerCase() + s.slice(1)).join('; ')}.` : '.')
    + ` The ${portfolio.name} package adds protection for the gaps Medicare leaves open. Final pricing and eligibility depend on age, ZIP, and (for some products) health questions — a licensed agent will confirm everything with you.`;

  return { version: 'v3', referenceYear: REF.year, eligibility: elig, decision, design, needs, portfolio, exposure: exposure(decision.path, design), flags, brief, clientSummary };
}
