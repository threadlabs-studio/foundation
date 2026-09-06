import { describe, expect, it } from 'vitest';

import { selectVerificationChecks, verifyRepository } from '../../../src/engine/verify.js';

describe('verification lanes', () => {
  it('selects cumulative checks and only risk-triggered optional checks', () => {
    expect(
      selectVerificationChecks(['core', 'typescript-node'], 'inner').map((check) => check.id),
    ).toEqual(['build', 'format', 'lint', 'test', 'typecheck']);
    expect(
      selectVerificationChecks(['core', 'typescript-node'], 'extended').map((check) => check.id),
    ).not.toContain('browser');
    expect(
      selectVerificationChecks(['core', 'typescript-node', 'browser'], 'extended').map(
        (check) => check.id,
      ),
    ).toContain('browser');
    expect(
      selectVerificationChecks(['core', 'typescript-node', 'public-api'], 'pr').map(
        (check) => check.id,
      ),
    ).toContain('package');
    expect(
      selectVerificationChecks(['core', 'typescript-node'], 'pr').map((check) => check.id),
    ).not.toContain('package');
  });

  it('reports missing applicable package evidence as partial', () => {
    const evidence = verifyRepository('.', ['core', 'typescript-node', 'public-api'], 'pr', {
      run: (check) => ({
        state: check.id === 'package' ? 'skipped' : 'passed',
        durationMs: 1,
      }),
      revision: () => ({ revision: 'abc123', dirtyFingerprint: 'dirty' }),
      now: () => '2026-09-06T00:00:00.000Z',
    });
    expect(evidence.state).toBe('partial');
    expect(evidence.skippedControls).toContain('verification.package');
  });

  it('does not claim a passed lane when checks fail, cancel, or are unavailable', () => {
    const states = new Map<string, 'passed' | 'failed' | 'canceled' | 'unknown' | 'skipped'>([
      ['format', 'passed'],
      ['lint', 'failed'],
      ['typecheck', 'canceled'],
      ['test', 'unknown'],
      ['build', 'skipped'],
    ]);
    const evidence = verifyRepository('.', ['core', 'typescript-node'], 'inner', {
      run: (check) => ({ state: states.get(check.id) ?? 'passed', durationMs: 1 }),
      revision: () => ({ revision: 'abc123', dirtyFingerprint: 'dirty' }),
      now: () => '2026-09-06T00:00:00.000Z',
    });
    expect(evidence.state).toBe('failed');
    expect(new Set(evidence.checks.map((check) => check.state))).toEqual(
      new Set(['passed', 'failed', 'canceled', 'unknown', 'skipped']),
    );
  });

  it('reports lane budget overruns without deleting checks', () => {
    const evidence = verifyRepository('.', ['core', 'typescript-node'], 'inner', {
      run: () => ({ state: 'passed', durationMs: 100_000 }),
      revision: () => ({ revision: 'abc123', dirtyFingerprint: 'clean' }),
      now: () => '2026-09-06T00:00:00.000Z',
    });
    expect(evidence.state).toBe('passed');
    expect(evidence.remainingHumanJudgment).toContainEqual(expect.stringMatching(/90s budget/iu));
    expect(evidence.checks.length).toBe(5);
  });
});
