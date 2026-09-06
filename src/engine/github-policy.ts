import { digestCanonical } from '../domain/canonicalize.js';

export interface GithubRepositorySettings {
  readonly defaultBranch: string;
  readonly deleteBranchOnMerge: boolean;
  readonly allowMergeCommit: boolean;
  readonly allowSquashMerge: boolean;
  readonly allowRebaseMerge: boolean;
  readonly requiredCheck: string | null;
  readonly requiredApprovals: number;
  readonly requireConversationResolution: boolean;
  readonly blockForcePushes: boolean;
  readonly blockDeletions: boolean;
}

export interface GithubRepositoryState {
  readonly repository: string;
  readonly authenticatedAs: string;
  readonly permission: 'read' | 'write' | 'admin';
  readonly settings: GithubRepositorySettings;
}

export interface GithubPort {
  observe(): GithubRepositoryState;
  update(desired: GithubRepositorySettings): void;
}

export interface GithubPlan {
  readonly schemaVersion: '1.0';
  readonly repository: string;
  readonly authenticatedAs: string;
  readonly requiredPermission: 'admin';
  readonly observedDigest: string;
  readonly observed: GithubRepositorySettings;
  readonly desired: GithubRepositorySettings;
  readonly reverse: GithubRepositorySettings;
}

export function desiredGithubPolicy(collaborative: boolean): GithubRepositorySettings {
  return {
    defaultBranch: 'main',
    deleteBranchOnMerge: true,
    allowMergeCommit: true,
    allowSquashMerge: true,
    allowRebaseMerge: false,
    requiredCheck: 'Required',
    requiredApprovals: collaborative ? 1 : 0,
    requireConversationResolution: true,
    blockForcePushes: true,
    blockDeletions: true,
  };
}

export function createGithubPlan(
  observed: GithubRepositoryState,
  desired: GithubRepositorySettings,
): { readonly plan: GithubPlan; readonly digest: string } {
  const plan: GithubPlan = {
    schemaVersion: '1.0',
    repository: observed.repository,
    authenticatedAs: observed.authenticatedAs,
    requiredPermission: 'admin',
    observedDigest: digestCanonical(observed.settings),
    observed: observed.settings,
    desired,
    reverse: observed.settings,
  };
  return { plan, digest: digestCanonical(plan) };
}

function matches(left: GithubRepositorySettings, right: GithubRepositorySettings): boolean {
  return digestCanonical(left) === digestCanonical(right);
}

export function applyGithubPlan(
  plan: GithubPlan,
  approvedDigest: string,
  port: GithubPort,
  remoteApproved: boolean,
): { readonly state: 'succeeded' | 'no-op' | 'succeeded-after-reobservation' } {
  if (digestCanonical(plan) !== approvedDigest)
    throw new Error('GitHub plan digest does not match.');
  if (!remoteApproved) throw new Error('Separate remote approval is required.');
  const before = port.observe();
  if (before.repository !== plan.repository)
    throw new Error('GitHub repository identity mismatch.');
  if (before.authenticatedAs !== plan.authenticatedAs)
    throw new Error('GitHub authenticated identity drift.');
  if (before.permission !== 'admin') throw new Error('GitHub admin permission is required.');
  if (matches(before.settings, plan.desired)) return { state: 'no-op' };
  if (digestCanonical(before.settings) !== plan.observedDigest)
    throw new Error('GitHub settings drifted after preview.');
  try {
    port.update(plan.desired);
  } catch (error) {
    const afterFailure = port.observe();
    if (matches(afterFailure.settings, plan.desired)) {
      return { state: 'succeeded-after-reobservation' };
    }
    throw error;
  }
  const after = port.observe();
  if (!matches(after.settings, plan.desired))
    throw new Error('GitHub settings postcondition failed.');
  return { state: 'succeeded' };
}
