import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { runBoundedCommand, type BoundedCommandResult } from '../adapters/command-runner.js';
import { compareText, digestCanonical } from '../domain/canonicalize.js';
import type { VerificationCheckResult, VerificationLane } from '../domain/control.js';
import type { VerificationEvidence } from '../domain/evidence.js';
import { budgetFinding } from './durations.js';

export interface VerificationCheck {
  readonly id: string;
  readonly script: string;
  readonly lane: VerificationLane;
  readonly module?: string;
}

const checks: readonly VerificationCheck[] = [
  { id: 'lint', script: 'lint', lane: 'inner' },
  { id: 'typecheck', script: 'typecheck', lane: 'inner' },
  { id: 'test', script: 'test', lane: 'inner' },
  { id: 'build', script: 'build', lane: 'inner' },
  { id: 'package', script: 'test:package', lane: 'pr', module: 'public-api' },
  { id: 'browser', script: 'test:browser', lane: 'extended', module: 'browser' },
  {
    id: 'cross-platform',
    script: 'test:cross-platform',
    lane: 'extended',
    module: 'cross-platform',
  },
  { id: 'performance', script: 'test:performance', lane: 'extended', module: 'performance' },
  { id: 'long-running', script: 'test:long', lane: 'scheduled', module: 'long-running' },
  { id: 'package-dry-run', script: 'verify:release', lane: 'release', module: 'npm-publish' },
];

const laneRank: Readonly<Record<VerificationLane, number>> = {
  inner: 0,
  pr: 1,
  extended: 2,
  scheduled: 3,
  release: 4,
};

export function selectVerificationChecks(
  moduleIds: readonly string[],
  lane: VerificationLane,
): readonly VerificationCheck[] {
  const selected = new Set(moduleIds);
  return checks
    .filter((check) => {
      if (check.module !== undefined && !selected.has(check.module)) return false;
      if (check.lane === 'scheduled') return lane === 'scheduled';
      if (check.lane === 'release') return lane === 'release';
      return laneRank[check.lane] <= laneRank[lane];
    })
    .toSorted((left, right) => compareText(left.id, right.id));
}

export interface VerificationDependencies {
  readonly run: (
    check: VerificationCheck,
  ) => Pick<BoundedCommandResult, 'state' | 'durationMs'> & Partial<BoundedCommandResult>;
  readonly revision: () => { readonly revision: string; readonly dirtyFingerprint: string };
  readonly now: () => string;
}

function defaultRevision(root: string): { revision: string; dirtyFingerprint: string } {
  const revision = runBoundedCommand('git', ['rev-parse', 'HEAD'], root, { timeoutMs: 10_000 });
  const dirty = runBoundedCommand('git', ['status', '--porcelain=v1'], root, { timeoutMs: 10_000 });
  return {
    revision: revision.state === 'passed' ? revision.stdout.trim() : 'unknown',
    dirtyFingerprint: digestCanonical(dirty.stdout),
  };
}

function defaultRun(root: string, check: VerificationCheck): BoundedCommandResult {
  const manifestPath = join(root, 'package.json');
  if (!existsSync(manifestPath)) {
    return {
      state: 'unknown',
      status: null,
      stdout: '',
      stderr: 'package.json is unavailable.',
      durationMs: 0,
      truncated: false,
    };
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    scripts?: Readonly<Record<string, string>>;
  };
  if (manifest.scripts?.[check.script] === undefined) {
    return {
      state: check.module === undefined ? 'unknown' : 'skipped',
      status: null,
      stdout: '',
      stderr: `Script is unavailable: ${check.script}`,
      durationMs: 0,
      truncated: false,
    };
  }
  return runBoundedCommand('pnpm', [check.script], root);
}

export function verifyRepository(
  root: string,
  moduleIds: readonly string[],
  lane: VerificationLane,
  dependencies?: VerificationDependencies,
): VerificationEvidence {
  const revision = dependencies?.revision() ?? defaultRevision(root);
  const results: VerificationCheckResult[] = selectVerificationChecks(moduleIds, lane).map(
    (check) => {
      const result = dependencies?.run(check) ?? defaultRun(root, check);
      return {
        controlId: `verification.${check.id}`,
        command: ['pnpm', check.script],
        state: result.state,
        durationMs: result.durationMs,
        ...('stderr' in result && typeof result.stderr === 'string' && result.stderr.length > 0
          ? { details: result.stderr }
          : {}),
      };
    },
  );
  const states = new Set(results.map((result) => result.state));
  const state = states.has('failed')
    ? 'failed'
    : states.has('canceled')
      ? 'canceled'
      : states.has('unknown') || states.has('skipped')
        ? 'partial'
        : 'passed';
  const totalDuration = results.reduce((sum, result) => sum + (result.durationMs ?? 0), 0);
  const overBudget = budgetFinding(lane, totalDuration);
  return {
    schemaVersion: '1.0',
    standardVersion: '1.0.0',
    revision: revision.revision,
    dirtyFingerprint: revision.dirtyFingerprint,
    lane,
    state,
    observedAt: dependencies?.now() ?? new Date().toISOString(),
    checks: results,
    externalEvidence: [],
    skippedControls: results
      .filter((result) => result.state === 'skipped')
      .map((result) => result.controlId),
    remainingHumanJudgment: overBudget === undefined ? [] : [overBudget],
  };
}
