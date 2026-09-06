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
  if (plan.remoteEffects.length > 0) {
    throw new Error('Remote effects require a separately approved remote operation.');
  }

  const journal = readJournal(root, approvedDigest);
  const succeeded = new Set(
    journal.filter((event) => event.state === 'succeeded').map((event) => event.effectId),
  );
  let allSatisfied = true;
  for (const effect of plan.localEffects) {
    const current = currentDigest(root, effect);
    if (succeeded.has(effect.id)) {
      if (current !== effect.postconditionDigest) {
        throw new Error(`Completed effect postcondition drifted: ${effect.path}`);
      }
      continue;
    }
    if (current === effect.postconditionDigest) continue;
    allSatisfied = false;
    if (current !== effect.expectedPreimage) {
      throw new Error(`Expected preimage changed before apply: ${effect.path}`);
    }
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
