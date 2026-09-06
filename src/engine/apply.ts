import { existsSync, readFileSync } from 'node:fs';

import { atomicWriteFile } from '../adapters/atomic-filesystem.js';
import { digestCanonical } from '../domain/canonicalize.js';
import type { LocalWriteEffect, OperationPlan } from '../domain/operation.js';
import { fingerprintRoot, hashContent } from './fingerprint.js';
import { appendJournal, readJournal } from './journal.js';
import { assertSafeTarget } from './ownership.js';

export interface ApplyOptions {
  readonly afterEffect?: (effect: LocalWriteEffect, completed: number) => void;
}

export interface ApplyResult {
  readonly state: 'succeeded' | 'no-op';
  readonly appliedEffects: number;
  readonly resumedEffects: number;
}

function currentDigest(root: string, effect: LocalWriteEffect): string | null {
  const target = assertSafeTarget(root, effect.path);
  return existsSync(target) ? hashContent(readFileSync(target)) : null;
}

function readJsonDigest(root: string, path: string): string | null {
  const target = assertSafeTarget(root, path);
  if (!existsSync(target)) return null;
  try {
    return digestCanonical(JSON.parse(readFileSync(target, 'utf8')));
  } catch {
    throw new Error(`Bound ${path} is not valid JSON.`);
  }
}

function assertPlanBindings(root: string, plan: OperationPlan): void {
  const manifestEffect = plan.localEffects.find(({ path }) => path === 'threadlabs.config.json');
  const manifestTarget = assertSafeTarget(root, 'threadlabs.config.json');
  const manifestFileDigest = existsSync(manifestTarget)
    ? hashContent(readFileSync(manifestTarget))
    : null;
  const manifestDigest = readJsonDigest(root, 'threadlabs.config.json');
  const effectMatchesBinding =
    manifestEffect !== undefined &&
    digestCanonical(JSON.parse(manifestEffect.content)) === plan.manifestDigest;
  if (manifestDigest === null) {
    if (!effectMatchesBinding) {
      throw new Error('Bound manifest is unavailable or changed after preview.');
    }
  } else if (
    manifestDigest !== plan.manifestDigest &&
    (!effectMatchesBinding || manifestFileDigest !== manifestEffect?.expectedPreimage)
  ) {
    throw new Error('Bound manifest changed after preview.');
  }

  const lockEffect = plan.localEffects.find(({ path }) => path === '.threadlabs.lock.json');
  const lockTarget = assertSafeTarget(root, '.threadlabs.lock.json');
  const lockFileDigest = existsSync(lockTarget) ? hashContent(readFileSync(lockTarget)) : null;
  const priorLockDigest = readJsonDigest(root, '.threadlabs.lock.json');
  const isPlannedPostcondition =
    lockEffect !== undefined && lockFileDigest === lockEffect.postconditionDigest;
  if (plan.lockDigest === null) {
    if (priorLockDigest !== null && !isPlannedPostcondition) {
      throw new Error('Bound lock changed after preview.');
    }
  } else if (priorLockDigest !== plan.lockDigest && !isPlannedPostcondition) {
    throw new Error('Bound lock changed after preview.');
  }
}

export function applyOperationPlan(
  root: string,
  plan: OperationPlan,
  approvedDigest: string,
  options: ApplyOptions = {},
): ApplyResult {
  const actualPlanDigest = digestCanonical(plan);
  if (actualPlanDigest !== approvedDigest) throw new Error('Approved plan digest does not match.');
  if (fingerprintRoot(root) !== plan.targetFingerprint)
    throw new Error('Target root fingerprint changed.');
  assertPlanBindings(root, plan);
  if (plan.remoteEffects.length > 0) {
    throw new Error('Remote effects require a separately approved remote operation.');
  }

  const journal = readJournal(root, approvedDigest);
  const succeeded = new Set(
    journal
      .filter((event) => event.state === 'succeeded' || event.state === 'skipped')
      .map((event) => event.effectId),
  );
  const journaled = new Set(journal.map((event) => event.effectId));
  const recoverableSkips: LocalWriteEffect[] = [];
  let allSatisfied = true;
  for (const effect of plan.localEffects) {
    const current = currentDigest(root, effect);
    if (succeeded.has(effect.id)) {
      if (current !== effect.postconditionDigest) {
        throw new Error(`Completed effect postcondition drifted: ${effect.path}`);
      }
      continue;
    }
    if (current === effect.postconditionDigest) {
      if (journaled.has(effect.id)) recoverableSkips.push(effect);
      continue;
    }
    allSatisfied = false;
    if (current !== effect.expectedPreimage) {
      appendJournal(root, {
        runId: crypto.randomUUID(),
        planDigest: approvedDigest,
        effectId: effect.id,
        state: 'blocked',
        recordedAt: new Date().toISOString(),
        responseClass: 'preimage-drift',
      });
      throw new Error(`Expected preimage changed before apply: ${effect.path}`);
    }
  }
  for (const effect of recoverableSkips) {
    appendJournal(root, {
      runId: crypto.randomUUID(),
      planDigest: approvedDigest,
      effectId: effect.id,
      state: 'skipped',
      recordedAt: new Date().toISOString(),
      responseClass: 'postcondition-already-satisfied',
      postcondition: effect.postconditionDigest,
    });
    succeeded.add(effect.id);
  }
  if (allSatisfied) {
    return { state: 'no-op', appliedEffects: 0, resumedEffects: succeeded.size };
  }

  const runId = crypto.randomUUID();
  let appliedEffects = 0;
  for (const effect of plan.localEffects) {
    if (succeeded.has(effect.id) || currentDigest(root, effect) === effect.postconditionDigest)
      continue;
    if (fingerprintRoot(root) !== plan.targetFingerprint)
      throw new Error('Target root fingerprint changed.');
    if (currentDigest(root, effect) !== effect.expectedPreimage) {
      throw new Error(`Expected preimage changed during apply: ${effect.path}`);
    }
    if (!journaled.has(effect.id)) {
      appendJournal(root, {
        runId,
        planDigest: approvedDigest,
        effectId: effect.id,
        state: 'pending',
        recordedAt: new Date().toISOString(),
        requestFingerprint: effect.postconditionDigest,
      });
    }
    appendJournal(root, {
      runId,
      planDigest: approvedDigest,
      effectId: effect.id,
      state: 'running',
      recordedAt: new Date().toISOString(),
      requestFingerprint: effect.postconditionDigest,
    });
    try {
      atomicWriteFile(root, effect.path, effect.content);
      if (currentDigest(root, effect) !== effect.postconditionDigest) {
        throw new Error(`Postcondition failed: ${effect.path}`);
      }
      appendJournal(root, {
        runId,
        planDigest: approvedDigest,
        effectId: effect.id,
        state: 'succeeded',
        recordedAt: new Date().toISOString(),
        postcondition: effect.postconditionDigest,
      });
      appliedEffects += 1;
    } catch (error) {
      appendJournal(root, {
        runId,
        planDigest: approvedDigest,
        effectId: effect.id,
        state: 'failed',
        recordedAt: new Date().toISOString(),
        responseClass: error instanceof Error ? error.name : 'unknown',
      });
      throw error;
    }
    options.afterEffect?.(effect, appliedEffects);
  }
  return { state: 'succeeded', appliedEffects, resumedEffects: succeeded.size };
}
