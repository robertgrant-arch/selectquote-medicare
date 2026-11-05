// Guided Review slice — education modules (Stage 1).
// Each module: key points, a link to the deeper page section, a knowledge check, and an agent talk track.
import { REF } from '../domain/reference-2026.js';

const $ = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

export const MODULES = [
  {
    id: 'original',
    icon: 'fa-hospital-user',
    title: 'Original Medicare: Parts A & B',
    deepLink: '#medicare',
    points: [
      `<b>Part A (hospital)</b> is usually premium-free with 40 work quarters. You pay a ${$(REF.partA.deductible)} deductible per benefit period, then ${$(REF.partA.day61to90)}/day for days 61–90 (${REF.year}).`,
      `<b>Part B (medical)</b> costs ${$(REF.partB.premium)}/month standard in ${REF.year}, with a ${$(REF.partB.deductible)} annual deductible.`,
      `After the deductible, Part B pays 80%. <b>You pay 20% with no annual limit</b> — a $500,000 treatment can mean $100,000 out of pocket.`,
      'Higher incomes pay more for Parts B and D (IRMAA), based on the tax return from two years earlier.'
    ],
    check: { q: 'Does Original Medicare (Parts A & B) have an annual out-of-pocket maximum?', options: ['Yes, about $9,250', 'No — the 20% coinsurance has no cap', 'Only for hospital stays'], answer: 1,
      explain: 'Original Medicare has no out-of-pocket cap. That uncapped 20% is the main reason people add a Medigap or Medicare Advantage plan.' },
    talk: 'Anchor everything to the uncapped 20%. Ask: "If you had a $100,000 year, how would you want that handled?"'
  },
  {
    id: 'cd',
    icon: 'fa-pills',
    title: 'Parts C & D: Advantage and drugs',
    deepLink: '#deep-dive',
    points: [
      '<b>Part C (Medicare Advantage)</b> is a private plan that replaces how you receive Parts A and B — usually with a network (HMO or PPO) and copays.',
      `Every MA plan has an out-of-pocket maximum. In ${REF.year}, it can be as high as ${$(REF.ma.moopInNetworkMax)} in-network (${$(REF.ma.moopCombinedMax)} combined for PPOs); the average is about ${$(REF.ma.moopInNetworkAvg)}.`,
      `<b>Part D</b> covers prescriptions. In ${REF.year}, out-of-pocket drug costs are capped at ${$(REF.partD.oopCap)} per year on any Part D or MA drug plan.`,
      'Going without creditable drug coverage triggers a permanent Part D late penalty (1% of the national base premium for each month without coverage).'
    ],
    check: { q: 'If you choose a Medicare Supplement (Medigap), how do you get prescription coverage?', options: ['It is built into Medigap', 'Through a separate Part D plan', 'Medicare Part B covers all drugs'], answer: 1,
      explain: 'Medigap does not include drug coverage — it pairs with a standalone Part D plan. Most Medicare Advantage plans include Part D.' },
    talk: 'Clarify that a "$0 premium" MA plan still requires paying the Part B premium.'
  },
  {
    id: 'gaps',
    icon: 'fa-triangle-exclamation',
    title: 'What Medicare does not cover',
    deepLink: '#not-covered',
    points: [
      `<b>Skilled nursing:</b> days 1–20 are $0, days 21–100 cost ${$(REF.snf.days21to100)}/day (${REF.year}), and from day 101 you pay everything.`,
      '<b>Custodial care</b> (help bathing, dressing, eating) — the majority of long-term care — is not covered by Medicare at all.',
      '<b>Routine dental, eyeglasses, and hearing aids</b> are not covered by Original Medicare. Hearing aids average around $4,700 a pair.',
      '<b>Non-medical costs</b> of a serious diagnosis — travel for treatment, lost income, caregivers, home changes — are never covered by health insurance.'
    ],
    check: { q: 'Who pays for custodial care such as help with bathing and dressing?', options: ['Medicare Part A', 'Medicare Part B', 'Not Medicare — it is out of pocket or other coverage'], answer: 2,
      explain: 'Medicare does not pay for custodial care. That is why short-term home healthcare and other protection products exist.' },
    talk: 'Ask about family history and caregiving situation here — it sets up the protection conversation later.'
  },
  {
    id: 'paths',
    icon: 'fa-code-branch',
    title: 'Your two main paths',
    deepLink: '#coverage',
    points: [
      '<b>Path 1 — Original Medicare + Medigap + Part D:</b> any doctor that accepts Medicare nationwide, no referrals, higher but predictable premiums.',
      `Plan G covers nearly everything after the ${$(REF.partB.deductible)} Part B deductible. Plan N costs less but has small copays and possible excess charges.`,
      '<b>Path 2 — Medicare Advantage:</b> often $0–low premium with extras (dental, vision, hearing, OTC), but networks, prior authorization, and copays up to the out-of-pocket maximum.',
      'Neither path is "best" for everyone. The right one depends on your doctors, travel, health, budget, and tolerance for surprise bills.'
    ],
    check: { q: 'Which path lets you see any doctor in the U.S. who accepts Medicare, with no referrals?', options: ['Medicare Advantage HMO', 'Original Medicare + Medigap', 'Both work the same way'], answer: 1,
      explain: 'Medigap follows Original Medicare — any provider that accepts Medicare. MA plans use networks; HMOs usually require referrals.' },
    talk: 'Stay neutral here. The needs analysis — not the agent — should point to a path.'
  },
  {
    id: 'timing',
    icon: 'fa-calendar-check',
    title: 'Timing, enrollment windows, and health questions',
    deepLink: '#enrollment',
    points: [
      '<b>Initial Enrollment Period:</b> 7 months around your 65th birthday (3 before, your birthday month, 3 after).',
      '<b>Medigap Open Enrollment:</b> 6 months starting when Part B begins at 65+. During it, insurers cannot use health questions. After it, most states allow medical underwriting.',
      '<b>Annual Enrollment (Oct 15 – Dec 7):</b> switch MA or Part D plans for Jan 1. <b>MA Open Enrollment (Jan 1 – Mar 31):</b> one change for MA members.',
      'Still working? With an employer of 20+ employees, you can usually delay Part B. Stop HSA contributions up to 6 months before Part A starts.'
    ],
    check: { q: 'When can you buy a Medigap policy without answering health questions?', options: ['Any time during Annual Enrollment', 'During your 6-month Medigap Open Enrollment', 'Only after age 70'], answer: 1,
      explain: 'Annual Enrollment applies to MA and Part D, not Medigap. Medigap guaranteed issue is tied to your Medigap Open Enrollment or a specific qualifying event.' },
    talk: 'This is the most misunderstood rule. Missing Medigap Open Enrollment can make switching back from MA hard later.'
  },
  {
    id: 'protection',
    icon: 'fa-umbrella',
    title: 'Filling the remaining gaps',
    deepLink: '#packages',
    points: [
      '<b>Cancer / Heart Attack / Stroke</b> pays a lump-sum cash benefit at diagnosis — use it for anything, including travel, experimental care, or bills.',
      '<b>Hospital Indemnity</b> pays cash per hospital stay — designed to offset Medicare Advantage inpatient copays.',
      '<b>Dental / Vision / Hearing</b> covers the routine care Original Medicare excludes.',
      '<b>Short-Term Home Healthcare</b> helps pay for recovery and custodial care at home — care Medicare largely does not cover.'
    ],
    check: { q: 'How does a hospital indemnity plan pay?', options: ['It replaces your Medicare coverage', 'It pays a cash benefit when you are hospitalized', 'It only pays your doctor directly'], answer: 1,
      explain: 'These products pay in addition to your health coverage — they do not replace Medicare, Medigap, or MA.' },
    talk: 'Position protection products as filling specific identified gaps, not as add-ons. The needs analysis will show which gaps apply.'
  }
];
