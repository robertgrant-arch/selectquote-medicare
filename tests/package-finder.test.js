import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, TOTAL, answeredCount, isComplete, toggleFlag } from '../features/package-finder/content/questions.js';
import { analyze } from '../features/guided-review/domain/engine.js';

const TODAY = new Date('2026-11-05T12:00:00');
const full = () => {
  let p = { partB: 'enrolled', partBEffective: '2026-08-01', medicaid: 'no', doctorsKeep: 'must', travel: 'frequent', visits: '3-6',
    conditions: ['none'], hospitalized: '0', budget: '250-400', surpriseBill: '1k_5k' };
  p = { ...p, ...toggleFlag('q9', [], 'famCancer') };
  p = { ...p, ...toggleFlag('q10', [], 'dental_major') };
  return p;
};

test('exactly 10 numbered questions', () => {
  assert.equal(TOTAL, 10);
  assert.deepEqual(QUESTIONS.map((q) => q.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('recommendation is gated until all 10 are answered', () => {
  assert.equal(answeredCount({}), 0);
  const p = full();
  assert.equal(isComplete(p), true);
  assert.equal(isComplete({ ...p, partBEffective: '' }), false, 'enrolled Part B needs an effective date');
  assert.equal(isComplete({ ...p, hospitalized: undefined }), false, 'health history needs both parts');
  assert.equal(isComplete({ ...p, q9: [] }), false);
});

test('flag questions map to engine fields', () => {
  const a = toggleFlag('q10', ['dental_routine', 'hearing'], 'dental_major');
  assert.deepEqual(a.q10, ['hearing', 'dental_major']);
  assert.equal(a.dental, 'high'); assert.equal(a.hearing, 'yes'); assert.equal(a.vision, 'no');
  const n = toggleFlag('q9', ['famCancer'], 'none');
  assert.deepEqual(n.q9, ['none']); assert.equal(n.famCancer, 'no');
});

test('10 answers alone produce a Supplement Enhanced package (CHS + DVH)', () => {
  const r = analyze(full(), TODAY);
  assert.equal(r.decision.path, 'supp');
  assert.equal(r.portfolio.tier, 'B');
  assert.deepEqual(r.portfolio.products.map((x) => x.id), ['medigap', 'pdp', 'chs', 'dvh']);
});

test('Q10 home-care need moves the package to Complete', () => {
  const p = { ...full(), ...toggleFlag('q10', ['dental_major'], 'homecare') };
  assert.equal(analyze(p, TODAY).portfolio.tier, 'C');
});
