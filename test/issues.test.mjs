import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { buildIssues } from '../web/src/issues.js';

const load = (id) => JSON.parse(readFileSync(new URL(`../runs/${id}/report.json`, import.meta.url), 'utf8'));
const recorded = (id) => existsSync(new URL(`../runs/${id}/report.json`, import.meta.url));

const box = (x0, x1) => ({ x0, y0: 0, x1, y1: 100 });
const f = (id, type, region, extra = {}) => ({ id, type, severity: 'high', region, ghosts: ['a'], ...extra });

test('critical findings in the same place are one problem, led by the blocker', () => {
  const r = buildIssues({ findings: [f('F2', 'missed', box(150, 300), { milestone: 'dash' }), f('F1', 'blocker', box(0, 400))], milestones: [{ name: 'dash', reachedBy: [] }] });
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].primary.id, 'F1');
  assert.deepEqual(r.issues[0].related.map((x) => x.id), ['F2']);
});

test('stuck after an objective nobody reached is its consequence; friction is a fair challenge', () => {
  const r = buildIssues({
    findings: [f('F1', 'missed', box(0, 100), { milestone: 'lever' }), f('F2', 'stuck', box(400, 500)), f('F3', 'friction', box(700, 800))],
    milestones: [{ name: 'lever', reachedBy: [] }],
  });
  assert.equal(r.issues.length, 1);
  assert.deepEqual(r.issues[0].consequences.map((x) => x.id), ['F2']);
  assert.deepEqual(r.fair.map((x) => x.id), ['F3']);
});

test('half or more never working out the goal is a problem even with nothing on screen', () => {
  const r = buildIssues({ findings: [], debrief: { asked: 4, goalUnclear: ['a', 'b'], wouldStop: [] } });
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].kind, 'goal');
  assert.equal(buildIssues({ findings: [], debrief: { asked: 4, goalUnclear: ['a'], wouldStop: [] } }).issues.length, 0);
});

const REAL = {
  '2026-11-22T13-27-56-160Z-322d330eb9': { issues: 1, kinds: ['finding'] }, // Read Me: one problem, not two
  '2026-11-22T11-09-05-999Z-d69cc07354': { issues: 1, kinds: ['finding'], consequences: 1 }, // Lever Room
  '2026-11-22T13-33-46-469Z-500801017d': { issues: 1, kinds: ['goal'] }, // SPACETAXI
  '2026-11-21T23-02-44-249Z-e9b3a06a77': { issues: 0, kinds: [], fair: 3 }, // Gap Run after the fix
};
for (const [id, want] of Object.entries(REAL)) {
  test(`recorded report ${id.slice(-10)}`, { skip: !recorded(id) }, () => {
    const r = buildIssues(load(id));
    assert.equal(r.issues.length, want.issues);
    assert.deepEqual(r.issues.map((i) => i.kind), want.kinds);
    if (want.consequences) assert.equal(r.issues[0].consequences.length, want.consequences);
    if (want.fair) assert.equal(r.fair.length, want.fair);
  });
}
