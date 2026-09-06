import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { atomicWriteFile } from '../adapters/atomic-filesystem.js';
import { GhGithubPort } from '../adapters/github.js';
import { canonicalJson, digestCanonical } from '../domain/canonicalize.js';
import {
  applyGithubPlan,
  createGithubPlan,
  desiredGithubPolicy,
  type GithubPlan,
} from '../engine/github-policy.js';
import type { CommandOptions, CommandResult } from './types.js';

interface PersistedGithubPlan {
  readonly schemaVersion: '1.0';
  readonly digest: string;
  readonly plan: GithubPlan;
}

const defaultPlan = '.threadlabs/plans/github.json';

export function githubCommand(options: CommandOptions): CommandResult {
  const repository = String(options.values.repository ?? '');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) {
    throw new Error('--repository must be an owner/name pair.');
  }
  const action = String(options.values.action ?? 'audit');
  const port = new GhGithubPort(repository, options.root);
  if (action === 'apply') {
    const planFile = String(options.values.plan ?? defaultPlan);
    const persisted = JSON.parse(
      readFileSync(join(options.root, planFile), 'utf8'),
    ) as PersistedGithubPlan;
    const approvedDigest = String(options.values.digest ?? '');
    const result = applyGithubPlan(
      persisted.plan,
      approvedDigest,
      port,
      options.values['remote-approve'] === true,
    );
    return {
      command: 'github',
      status: 'success',
      exitClass: 'success',
      summary: `GitHub settings ${result.state}.`,
      data: result,
    };
  }
  const observed = port.observe();
  const planned = createGithubPlan(
    observed,
    desiredGithubPolicy(options.values.collaborative === true),
  );
  const conformant = planned.plan.observedDigest === digestCanonical(planned.plan.desired);
  if (action === 'plan') {
    atomicWriteFile(
      options.root,
      defaultPlan,
      canonicalJson({ schemaVersion: '1.0', digest: planned.digest, plan: planned.plan }),
    );
  } else if (action !== 'audit') {
    throw new Error(`Unknown GitHub action: ${action}`);
  }
  return {
    command: 'github',
    status: conformant ? 'success' : 'findings',
    exitClass: conformant ? 'success' : 'findings',
    summary: conformant
      ? 'GitHub repository settings match the standard.'
      : action === 'plan'
        ? 'A separately approvable GitHub settings plan is ready.'
        : 'GitHub repository settings differ from the standard.',
    data: {
      digest: planned.digest,
      planFile: action === 'plan' ? defaultPlan : null,
      plan: planned.plan,
    },
  };
}
