// Package Finder slice — the 10 required questions behind every package recommendation.
// Pure data + pure helpers (no DOM). Each question writes only to engine profile fields, so the
// recommendation engine (guided-review/domain/engine.js) is the single source of truth.
//
// Coverage map — every engine input that changes the path or the package tier is asked here:
//   Path (Supplement vs Advantage): Q1 Part B timing (guaranteed issue), Q2 Medicaid, Q3 doctors, Q4 travel,
//                                   Q5 care use, Q6 health history (underwriting), Q7 budget, Q8 surprise bill
//   Tier / products:  Cancer-Heart-Stroke ← Q9 (+Q8)   Dental-Vision-Hearing ← Q10
//                     Hospital Indemnity   ← Q6, Q8    Short-Term Home Healthcare ← Q10 (+age)

export const QUESTIONS = [
  {
    id: 'partB', n: 1, title: 'When does your Medicare Part B start?',
    why: 'Sets your Medigap guaranteed-issue window — inside it, a Supplement cannot turn you down for health.',
    affects: 'Path',
    type: 'chips', field: 'partB',
    options: [['enrolled', 'Already enrolled'], ['not_yet', 'Not enrolled yet'], ['delayed', 'Delaying (still working)']],
    followUp: { when: (p) => p.partB === 'enrolled', field: 'partBEffective', type: 'date', label: 'Part B effective date (on your Medicare card)' },
    answered: (p) => !!p.partB && (p.partB !== 'enrolled' || !!p.partBEffective)
  },
  {
    id: 'medicaid', n: 2, title: 'Do you have Medicaid?',
    why: 'People with Medicare and Medicaid usually qualify for a Dual Special Needs Plan with extra benefits.',
    affects: 'Path',
    type: 'chips', field: 'medicaid', options: [['no', 'No'], ['yes', 'Yes'], ['unsure', 'Not sure']],
    answered: (p) => !!p.medicaid
  },
  {
    id: 'doctors', n: 3, title: 'How important is keeping your current doctors?',
    why: 'Supplements work with any doctor who takes Medicare; Advantage plans use a network.',
    affects: 'Path',
    type: 'chips', field: 'doctorsKeep', options: [['must', 'Must keep them'], ['prefer', 'Prefer to'], ['flexible', 'Open to new doctors']],
    answered: (p) => !!p.doctorsKeep
  },
  {
    id: 'travel', n: 4, title: 'How often are you out of state?',
    why: 'Frequent travelers and snowbirds need coverage that works nationwide.',
    affects: 'Path',
    type: 'chips', field: 'travel', options: [['frequent', 'Often / part of the year'], ['some', 'A few trips a year'], ['rare', 'Rarely']],
    answered: (p) => !!p.travel
  },
  {
    id: 'visits', n: 5, title: 'How many doctor visits do you have in a typical year?',
    why: 'Copays add up under Advantage for frequent users; Supplements keep costs flat.',
    affects: 'Path',
    type: 'chips', field: 'visits', options: [['0-2', '0–2'], ['3-6', '3–6'], ['7+', '7 or more']],
    answered: (p) => !!p.visits
  },
  {
    id: 'health', n: 6, title: 'What is your health history?',
    why: 'Drives Medigap underwriting outside guaranteed issue, and whether hospital-stay protection is needed.',
    affects: 'Path · Hospital Indemnity',
    type: 'multiChips', field: 'conditions', label: 'Ongoing conditions (select all)',
    options: [['none', 'None'], ['diabetes', 'Diabetes'], ['heart', 'Heart disease'], ['copd', 'COPD / lung'], ['cancer_history', 'Cancer (current or past)'], ['kidney', 'Kidney disease'], ['autoimmune', 'Autoimmune']],
    second: { field: 'hospitalized', label: 'Hospital stays in the last 2 years', options: [['0', 'None'], ['1', 'One'], ['2+', 'Two or more']] },
    answered: (p) => Array.isArray(p.conditions) && p.conditions.length > 0 && !!p.hospitalized
  },
  {
    id: 'budget', n: 7, title: 'What monthly budget works for coverage, beyond the Part B premium?',
    why: 'Decides between a low-premium Advantage plan and a Supplement, and how much protection fits.',
    affects: 'Path · Tier',
    type: 'chips', field: 'budget', options: [['lt50', 'Under $50'], ['50-150', '$50–150'], ['150-250', '$150–250'], ['250-400', '$250–400'], ['400+', '$400+']],
    answered: (p) => !!p.budget
  },
  {
    id: 'surprise', n: 8, title: 'Could you pay a surprise $5,000 medical bill from savings?',
    why: 'Shows how much out-of-pocket risk you can carry — and whether cash-benefit protection is needed.',
    affects: 'Path · Hospital Indemnity · Cancer/Heart/Stroke',
    type: 'chips', field: 'surpriseBill', options: [['under_1k', 'No — it would be a hardship'], ['1k_5k', 'Possibly, with difficulty'], ['5k_plus', 'Yes, comfortably']],
    answered: (p) => !!p.surpriseBill
  },
  {
    id: 'critical', n: 9, title: 'Which of these apply to you?',
    why: 'Determines whether a lump-sum Cancer / Heart Attack / Stroke policy belongs in your package.',
    affects: 'Cancer/Heart/Stroke',
    type: 'flags', key: 'q9',
    options: [
      { v: 'famCancer', label: 'Family history of cancer' },
      { v: 'famHeart', label: 'Family history of heart attack or stroke' },
      { v: 'cancerWorry', label: 'Worried about the cost of a cancer diagnosis' },
      { v: 'none', label: 'None of these' }
    ],
    answered: (p) => Array.isArray(p.q9) && p.q9.length > 0
  },
  {
    id: 'everyday', n: 10, title: 'Which of these do you need or expect?',
    why: 'Decides on Dental / Vision / Hearing coverage and Short-Term Home Healthcare for recovery.',
    affects: 'Dental/Vision/Hearing · Home Healthcare',
    type: 'flags', key: 'q10',
    options: [
      { v: 'dental_major', label: 'Major dental work (crowns, dentures, implants)' },
      { v: 'dental_routine', label: 'Routine dental cleanings' },
      { v: 'hearing', label: 'Hearing aids' },
      { v: 'vision', label: 'Glasses or contacts' },
      { v: 'alone', label: 'I live alone' },
      { v: 'homecare', label: 'Help paying for care at home after an illness' },
      { v: 'none', label: 'None of these' }
    ],
    answered: (p) => Array.isArray(p.q10) && p.q10.length > 0
  }
];

export const TOTAL = QUESTIONS.length;
export const answeredCount = (p = {}) => QUESTIONS.filter((q) => q.answered(p)).length;
export const isComplete = (p = {}) => answeredCount(p) === TOTAL;

// Toggle one option of a multi-select "flags" question and return the engine fields it implies.
export function toggleFlag(key, list = [], v) {
  let cur = list.slice();
  if (cur.includes(v)) cur = cur.filter((x) => x !== v);
  else {
    cur = v === 'none' ? ['none'] : cur.filter((x) => x !== 'none');
    if (v === 'dental_major') cur = cur.filter((x) => x !== 'dental_routine');
    if (v === 'dental_routine') cur = cur.filter((x) => x !== 'dental_major');
    if (v !== 'none') cur.push(v);
  }
  return { [key]: cur, ...flagFields(key, cur) };
}

export function flagFields(key, cur = []) {
  const yn = (v) => (cur.includes(v) ? 'yes' : 'no');
  if (key === 'q9') return { famCancer: yn('famCancer'), famHeart: yn('famHeart'), cancerWorry: yn('cancerWorry') };
  if (key === 'q10') return {
    dental: cur.includes('dental_major') ? 'high' : cur.includes('dental_routine') ? 'some' : 'low',
    hearing: yn('hearing'), vision: yn('vision'), livesAlone: yn('alone'), homeCare: cur.includes('homecare') ? 'high' : 'low'
  };
  return {};
}
