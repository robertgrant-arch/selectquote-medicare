// SelectQuote Medicare — Recommendation API
// Deterministic needs-analysis scoring engine + optional LLM rationale layer.

const PACKAGES = {
  essentials: { name: 'Essentials', est: '$140-$200/mo', tier: 1 },
  complete:   { name: 'Complete',   est: '$200-$320/mo', tier: 2 },
  premier:    { name: 'Premier',    est: '$320-$480/mo', tier: 3 }
};

function n(v, d=0){ const x=Number(v); return Number.isFinite(x)?x:d; }
function has(arr, key){ return Array.isArray(arr) && arr.includes(key); }

function scoreProfile(p) {
  let medigap = 0, advantage = 0;
  const r = { medigap: [], advantage: [] };
  if (p.provider_freedom === 'any')      { medigap += 25; r.medigap.push('Wants any-Medicare-doctor freedom'); }
  if (p.provider_freedom === 'network')  { advantage += 20; r.advantage.push('Comfortable using a plan network'); }
  if (p.provider_freedom === 'mixed')    { medigap += 8; advantage += 8; }
  if (p.travel === 'frequent')           { medigap += 15; r.medigap.push('Travels frequently across states'); }
  if (p.travel === 'some')               { medigap += 6; }
  if (p.utilization === 'high')          { medigap += 20; r.medigap.push('Higher expected utilization'); }
  if (p.utilization === 'low')           { advantage += 12; r.advantage.push('Low expected utilization'); }
  if (has(p.conditions, 'chronic'))      { medigap += 10; r.medigap.push('Manages chronic condition(s)'); }
  if (has(p.conditions, 'upcoming_procedure')) { medigap += 12; r.medigap.push('Procedure planned in next 12 months'); }
  if (p.cost_pref === 'predictable')     { medigap += 18; r.medigap.push('Prefers predictable out-of-pocket costs'); }
  if (p.cost_pref === 'low_premium')     { advantage += 22; r.advantage.push('Prioritizes lowest monthly premium'); }
  const budget = n(p.budget_monthly, 0);
  if (budget && budget < 120)            { advantage += 18; r.advantage.push('Budget under ~$120/mo favors MA'); }
  if (budget >= 180)                     { medigap += 10; r.medigap.push('Budget supports Medigap premium'); }
  if (p.extras_priority === 'high')      { advantage += 14; r.advantage.push('Wants built-in dental/vision/hearing'); }
  if (p.extras_priority === 'addon_ok')  { medigap += 6; }
  const rxCount = n(p.rx_count, 0);
  if (rxCount >= 5)                      { medigap += 4; r.medigap.push('Multiple prescriptions — PDP formulary fit critical'); }
  if (p.specialty_drugs === 'yes')       { medigap += 6; r.medigap.push('Specialty drugs — careful formulary review'); }
  return { medigap, advantage, reasons: r };
}

function recommendPackage(p) {
  let tier = 1;
  if (n(p.budget_monthly,0) >= 250 || p.cost_pref === 'predictable') tier++;
  if (has(p.addons_interest, 'cancer') || has(p.addons_interest, 'hospital_indemnity')) tier++;
  if (p.utilization === 'high') tier++;
  tier = Math.min(3, Math.max(1, tier));
  const key = tier === 1 ? 'essentials' : tier === 2 ? 'complete' : 'premier';
  return { key, ...PACKAGES[key] };
}

function redFlags(p) {
  const flags = [];
  if (p.hsa_contributions === 'yes' && p.enrolling_part_a === 'yes')
    flags.push('HSA contributions conflict with Part A enrollment — review 6-month lookback.');
  if (p.still_working === 'yes' && n(p.employer_size,0) < 20)
    flags.push('Employer <20 employees — Medicare typically becomes primary at 65.');
  if (p.missed_iep === 'yes')
    flags.push('Possible missed Initial Enrollment Period — check GEP and late penalties.');
  if (p.veteran === 'yes')
    flags.push('VA/TRICARE coordination — confirm Part B + Part D interaction.');
  if (p.medicaid === 'yes')
    flags.push('Dual-eligible — consider D-SNP options and LIS.');
  return flags;
}

function agentBrief(p, decision) {
  const qs = [];
  qs.push('Confirm ZIP + effective date and Part A/B status.');
  if (decision.path === 'medigap') qs.push('Verify underwriting health questions; check GI rights window.');
  if (decision.path === 'advantage') qs.push('Verify doctors + hospitals are in-network for shortlisted MA plans.');
  qs.push('Run drug list against PDP/MA-PD formularies; confirm preferred pharmacy.');
  if (has(p.addons_interest, 'dental')) qs.push('Quote standalone DVH if Medigap; otherwise verify MA DVH limits.');
  if (has(p.addons_interest, 'cancer') || has(p.addons_interest, 'hospital_indemnity'))
    qs.push('Discuss critical illness / hospital indemnity riders.');
  return qs;
}

function buildDecision(p) {
  const s = scoreProfile(p);
  const total = s.medigap + s.advantage || 1;
  const path = s.medigap >= s.advantage ? 'medigap' : 'advantage';
  const confidence = Math.round((Math.max(s.medigap, s.advantage) / total) * 100);
  return {
    path,
    label: path === 'medigap' ? 'Original Medicare + Medigap + Part D' : 'Medicare Advantage (Part C)',
    confidence,
    scores: { medigap: s.medigap, advantage: s.advantage },
    reasons: path === 'medigap' ? s.reasons.medigap : s.reasons.advantage,
    alt_reasons: path === 'medigap' ? s.reasons.advantage : s.reasons.medigap
  };
}

async function llmRationale(profile, decision, pkg) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const sys = 'You are a Medicare education assistant for SelectQuote. Explain WHY a path fits — never quote premiums or carrier names. Return JSON only with keys: client_summary (string, 2-3 sentences), agent_talk_track (string[3]), watch_outs (string[]).';
  const user = 'Profile: ' + JSON.stringify(profile) + '\nDecision: ' + JSON.stringify(decision) + '\nPackage: ' + JSON.stringify(pkg);
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.3, response_format: { type: 'json_object' }, messages: [ { role:'system', content: sys }, { role:'user', content: user } ] })
    });
    if (!r.ok) return null;
    const data = await r.json();
    return JSON.parse(data.choices?.[0]?.message?.content || '{}');
  } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method not allowed'); }
  let body = '';
  await new Promise((r) => { req.on('data', c => body += c); req.on('end', r); });
  let p; try { p = JSON.parse(body || '{}'); } catch { p = {}; }
  const decision = buildDecision(p);
  const pkg = recommendPackage(p);
  const flags = redFlags(p);
  const agent_questions = agentBrief(p, decision);
  const llm = await llmRationale(p, decision, pkg);
  const out = {
    version: 'v2',
    recommended_path: decision.label,
    confidence: decision.confidence,
    scores: decision.scores,
    why: decision.reasons,
    tradeoffs: decision.alt_reasons,
    package: pkg,
    red_flags: flags,
    agent_brief: { questions: agent_questions, talk_track: llm?.agent_talk_track || [], watch_outs: llm?.watch_outs || [] },
    client_summary: llm?.client_summary || ('Based on your answers, ' + decision.label + ' appears to be the strongest fit. Final pricing and eligibility depend on age, ZIP, and (for Medigap) health underwriting. A licensed SelectQuote agent will verify.'),
    next_steps: [
      'Confirm ZIP, effective date, and Part A/B status with a licensed agent.',
      'Have prescription list and preferred pharmacy ready for formulary review.',
      'Review carrier options and finalize enrollment during your eligibility window.'
    ]
  };
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(out));
}
