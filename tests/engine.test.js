import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, evaluateEligibility, scorePaths, buildPortfolio, assessNeeds } from '../features/guided-review/domain/engine.js';

const TODAY = new Date('2026-11-05T12:00:00');

test('new-to-Medicare client with doctor freedom priority → Medigap G with guaranteed issue open', () => {
  const r = analyze({ dob: '1961-08-20', partB: 'enrolled', partBEffective: '2026-08-01', doctorsKeep: 'must', travel: 'frequent',
    visits: '3-6', budget: '250-400', priorities: ['freedom', 'predictable'], famCancer: 'yes', dental: 'high' }, TODAY);
  assert.equal(r.decision.path, 'supp');
  assert.equal(r.eligibility.gi.status, 'open');
  assert.equal(r.design.plan, 'G');
  assert.equal(r.portfolio.tier, 'B');
  assert.deepEqual(r.portfolio.products.map(p => p.id), ['medigap', 'pdp', 'chs', 'dvh']);
});

test('low budget, healthy, extras priority → Medicare Advantage HMO Essential', () => {
  const r = analyze({ age: 70, partB: 'enrolled', partBEffective: '2021-03-01', doctorsKeep: 'flexible', travel: 'rare', visits: '0-2',
    budget: 'lt50', priorities: ['low_premium', 'extras'], surpriseBill: '5k_plus' }, TODAY);
  assert.equal(r.decision.path, 'adv');
  assert.equal(r.design.plan, 'HMO');
  assert.equal(r.portfolio.tier, 'A');
  assert.equal(r.portfolio.products[0].id, 'mapd');
});

test('serious health history outside GI penalizes Medigap and flags underwriting', () => {
  const p = { age: 72, partB: 'enrolled', partBEffective: '2019-01-01', conditions: ['heart'], hospitalized: '2+', doctorsKeep: 'prefer', budget: '150-250' };
  const s = scorePaths(p, evaluateEligibility(p, TODAY));
  assert.equal(s.medigapFeasible, 'unlikely');
  assert.equal(s.path, 'adv');
});

test('dual eligible routes to D-SNP with flag', () => {
  const r = analyze({ age: 68, medicaid: 'yes', budget: 'lt50' }, TODAY);
  assert.equal(r.decision.path, 'adv');
  assert.equal(r.design.plan, 'D-SNP');
  assert.ok(r.flags.some(f => /D-SNP/.test(f.text)));
});

test('home-care concern escalates to Complete tier', () => {
  const needs = assessNeeds({ livesAlone: 'yes', homeCare: 'high' }, 'adv', 78);
  const pf = buildPortfolio({}, 'adv', needs, 0);
  assert.equal(pf.tier, 'C');
  assert.ok(pf.products.some(p => p.id === 'sthc'));
});

test('IRMAA tier raises Part B in estimate', () => {
  const pf = buildPortfolio({}, 'supp', {}, 2);
  assert.equal(pf.estimate.partB, 405.8);
  assert.equal(pf.estimate.partDSurcharge, 37.5);
});

test('AEP is open on Nov 5 2026; HSA and small-employer flags fire', () => {
  const e = evaluateEligibility({ hsa: 'yes', working: 'self', employerSize: 'lt20' }, TODAY);
  assert.equal(e.windows.find(w => w.id === 'aep').status, 'open');
  assert.equal(e.flags.filter(f => f.level === 'high').length, 2);
});

test('path override is respected but engine path retained', () => {
  const r = analyze({ budget: 'lt50', priorities: ['low_premium'], pathOverride: 'supp' }, TODAY);
  assert.equal(r.decision.path, 'supp');
  assert.equal(r.decision.enginePath, 'adv');
});

test('API handler returns engine output', async () => {
  const { default: handler } = await import('../api/recommend.js');
  const { EventEmitter } = await import('node:events');
  const req = new EventEmitter(); req.method = 'POST'; req.url = '/api/recommend';
  let sent = ''; const res = { setHeader() {}, end(b) { sent = b; } };
  const p = handler(req, res);
  req.emit('data', JSON.stringify({ budget: 'lt50', priorities: ['low_premium'] })); req.emit('end');
  await p;
  const j = JSON.parse(sent);
  assert.equal(j.version, 'v3');
  assert.equal(j.decision.path, 'adv');
  assert.ok(j.recommended_path);
});
