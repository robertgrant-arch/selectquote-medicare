const SYSTEM_PROMPT = `You are a Medicare education assistant for SelectQuote. You explain Medicare options and help users understand which type of coverage may fit their situation. You are NOT a licensed insurance agent and you do NOT recommend specific carriers, plan names, or premiums. You explain plan TYPES (Original Medicare, Medicare Advantage, Medigap/Supplement, Part D) and tradeoffs.

Always:
- Be concise, plain-language, no jargon dumps.
- Tailor to the user's age, ZIP region, current coverage, prescriptions, doctor preferences, budget, and health priorities.
- Flag any obvious red flags (e.g., HSA contributions while enrolling in Part A, missing Part B enrollment window, working past 65 with employer coverage and the Rule of 20).
- Always end with: "Talk to a licensed SelectQuote agent for plan-specific quotes."

Return a JSON object with exactly these keys:
{
  "recommended_path": string,         // e.g., "Medicare Advantage" | "Original Medicare + Medigap + Part D" | "Stay on employer coverage for now"
  "why": string,                       // 2-4 sentences
  "key_questions_for_agent": string[], // 3-5 short questions
  "red_flags": string[],               // 0-3 items, empty array if none
  "next_steps": string[]               // 3 short actionable steps
}
Do not include any prose outside the JSON.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method not allowed');
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'OPENAI_API_KEY not set' }));
  }

  let body = '';
  await new Promise((r) => { req.on('data', c => body += c); req.on('end', r); });
  let input;
  try { input = JSON.parse(body || '{}'); } catch { input = {}; }

  const userMsg = `User profile:
- Age: ${input.age || 'unknown'}
- ZIP: ${input.zip || 'unknown'}
- Current coverage: ${input.current_coverage || 'unknown'}
- Still working past 65: ${input.still_working || 'unknown'}
- Employer size: ${input.employer_size || 'n/a'}
- HSA contributions: ${input.hsa || 'unknown'}
- Prescriptions: ${input.prescriptions || 'none listed'}
- Doctors must keep: ${input.doctors || 'none listed'}
- Monthly budget comfort: ${input.budget || 'unknown'}
- Health priorities: ${input.priorities || 'none listed'}
- Travel frequency: ${input.travel || 'unknown'}

Give your recommendation as JSON only.`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMsg }
        ]
      })
    });
    if (!r.ok) {
      const text = await r.text();
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'OpenAI error', detail: text.slice(0, 500) }));
    }
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    let parsed;
    try { parsed = JSON.parse(content); } catch { parsed = { recommended_path: 'Could not parse AI response', why: content, key_questions_for_agent: [], red_flags: [], next_steps: [] }; }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify(parsed));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: String(e) }));
  }
}
