// SelectQuote Medicare — Recommendation API (v3)
// Thin adapter over the Guided Review slice's deterministic engine, so the API and the on-page
// workflow always return the same recommendation. Optional LLM layer rewrites presentation only —
// it never changes the path, package, products, or numbers.
import { analyze } from '../features/guided-review/domain/engine.js';

// Fields that can contain PHI/PII are never forwarded to the LLM.
const PHI_FIELDS = ['dob', 'doctors', 'meds', 'name', 'phone', 'email', 'mbi', 'notes', 'zip'];

async function llmRationale(profile, out) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const safe = Object.fromEntries(Object.entries(profile).filter(([k]) => !PHI_FIELDS.includes(k)));
  const sys = 'You are a Medicare education assistant for SelectQuote. Explain WHY the given recommendation fits, in plain language. Never change the recommended path, package, or any number; never quote premiums or carrier names. Return JSON only with keys: client_summary (string, 2-3 sentences), agent_talk_track (string[3]), watch_outs (string[]).';
  const user = 'Profile (non-identifying): ' + JSON.stringify(safe) + '\nEngine output: ' + JSON.stringify({ design: out.design, decision: out.decision, portfolio: { tier: out.portfolio.tier, name: out.portfolio.name, products: out.portfolio.products.map((p) => p.name) }, flags: out.flags });
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.3, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] })
    });
    if (!r.ok) return null;
    const data = await r.json();
    return JSON.parse(data.choices?.[0]?.message?.content || '{}');
  } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method not allowed'); }
  let body = '';
  await new Promise((r) => { req.on('data', (c) => (body += c)); req.on('end', r); });
  let p; try { p = JSON.parse(body || '{}'); } catch { p = {}; }
  const out = analyze(p);
  const llm = req.url?.includes('explain=1') ? await llmRationale(p, out) : null;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({
    ...out,
    // v2-compatible summary fields
    recommended_path: out.design.label,
    confidence: out.decision.confidence,
    package: { key: out.portfolio.tier, name: out.portfolio.name, est: `$${out.portfolio.estimate.bundle[0]}-$${out.portfolio.estimate.bundle[1]}/mo` },
    red_flags: out.flags.map((f) => f.text),
    client_summary: llm?.client_summary || out.clientSummary,
    agent_brief: { questions: out.brief.checklist, talk_track: llm?.agent_talk_track || out.brief.talkTrack, watch_outs: llm?.watch_outs || [] }
  }));
}
