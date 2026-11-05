// Guided Review slice — reference data (2026 plan year).
// Every figure here is sourced; update annually when CMS publishes the next year's notice.

export const REF = {
  year: 2026,
  partA: { deductible: 1736, day61to90: 434, lifetimeReserveDay: 868, fullPremium: 565 },
  partB: { premium: 202.9, deductible: 283, coinsurancePct: 20 },
  snf: { days1to20: 0, days21to100: 217 },
  ma: { moopInNetworkMax: 9250, moopCombinedMax: 13900, moopInNetworkAvg: 5421 },
  partD: { oopCap: 2100, deductibleMax: 615 },
  // 2026 IRMAA, based on 2024 MAGI. partB = total monthly Part B premium; partD = monthly surcharge.
  irmaa: [
    { tier: 0, single: '≤ $109,000', joint: '≤ $218,000', partB: 202.9, partD: 0 },
    { tier: 1, single: '$109,001 – $137,000', joint: '$218,001 – $274,000', partB: 284.1, partD: 14.5 },
    { tier: 2, single: '$137,001 – $171,000', joint: '$274,001 – $342,000', partB: 405.8, partD: 37.5 },
    { tier: 3, single: '$171,001 – $205,000', joint: '$342,001 – $410,000', partB: 527.5, partD: 60.4 },
    { tier: 4, single: '$205,001 – $499,999', joint: '$410,001 – $749,999', partB: 649.2, partD: 83.3 },
    { tier: 5, single: '≥ $500,000', joint: '≥ $750,000', partB: 689.9, partD: 91.0 }
  ],
  // Illustrative core-plan premium assumptions (site's published ranges, not quotes).
  illustrative: { medigapG: [125, 200], medigapN: [100, 175], maPremium: [0, 40] },
  sources: [
    { label: 'CMS — 2026 Medicare Parts A & B Premiums and Deductibles', url: 'https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles' },
    { label: 'Medicare.gov — 2026 Medicare Costs', url: 'https://www.medicare.gov/publications/11579-medicare-costs.pdf' },
    { label: 'KFF — Medicare Advantage in 2026 (MOOP, Part D cap)', url: 'https://www.kff.org/medicare/medicare-advantage-in-2026-premiums-out-of-pocket-limits-supplemental-benefits-and-prior-authorization/' }
  ]
};

// Package catalog — mirrors the "Choose Your Bundle" section. Prices are estimated monthly cost
// of the bundle EXCLUDING the Part B premium.
export const PRODUCTS = {
  medigap:  { name: 'Medicare Supplement (Plan G or N)', icon: 'fa-file-shield', desc: 'Covers Original Medicare cost-sharing gaps', href: '#apply-medsup' },
  pdp:      { name: 'Standalone Part D Drug Plan', icon: 'fa-pills', desc: 'Prescription drug coverage', href: '#apply-partd' },
  mapd:     { name: 'Medicare Advantage with Part D', icon: 'fa-shield-heart', desc: 'All-in-one Medicare coverage', href: '#apply-madv' },
  chs:      { name: 'Cancer / Heart Attack / Stroke', icon: 'fa-heart-pulse', desc: 'Lump-sum critical illness benefit', href: '#apply-cancer' },
  dvh:      { name: 'Dental / Vision / Hearing', icon: 'fa-tooth', desc: 'Routine dental, eye, and hearing care', href: '#apply-dvh' },
  hip:      { name: 'Hospital Indemnity Insurance', icon: 'fa-hospital', desc: 'Cash benefit for hospital stays', href: '#apply-hip' },
  sthc:     { name: 'Short-Term Home Healthcare', icon: 'fa-house-medical', desc: 'Recovery and custodial care at home (Heartland National Life)', href: '#apply-sthc' }
};

export const PACKAGES = {
  supp: {
    A: { name: 'Essential', price: [220, 285], core: ['medigap', 'pdp'], ancillary: 1, pool: ['chs', 'dvh'] },
    B: { name: 'Enhanced',  price: [260, 335], core: ['medigap', 'pdp'], ancillary: ['chs', 'dvh'] },
    C: { name: 'Complete',  price: [325, 400], core: ['medigap', 'pdp'], ancillary: ['chs', 'dvh', 'sthc'] }
  },
  adv: {
    A: { name: 'Essential', price: [25, 60],   core: ['mapd'], ancillary: 1, pool: ['hip', 'chs'] },
    B: { name: 'Enhanced',  price: [50, 100],  core: ['mapd'], ancillary: ['hip', 'chs'] },
    C: { name: 'Complete',  price: [115, 165], core: ['mapd'], ancillary: ['hip', 'chs', 'sthc'] }
  }
};

export const TPMO_DISCLAIMER = 'We do not offer every plan available in your area. Any information we provide is limited to those plans we do offer in your area. Please contact Medicare.gov or 1-800-MEDICARE to get information on all of your options.';
