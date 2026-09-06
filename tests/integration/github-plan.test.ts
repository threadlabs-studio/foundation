import { describe, expect, it } from 'vitest';

import {
  applyGithubPlan,
  createGithubPlan,
  desiredGithubPolicy,
  type GithubPort,
  type GithubRepositoryState,
} from '../../src/engine/github-policy.js';

const unprotected: GithubRepositoryState = {
  repository: 'example/project',
  authenticatedAs: 'maintainer',
  permission: 'admin',
  settings: {
    defaultBranch: 'main',
    deleteBranchOnMerge: false,
    allowMergeCommit: true,
    allowSquashMerge: true,
    allowRebaseMerge: true,
    requiredCheck: null,
    requiredApprovals: 0,
    requireConversationResolution: false,
    blockForcePushes: false,
    blockDeletions: false,
  },
};

class FakeGithub implements GithubPort {
  public updates = 0;
  public failAfterUpdate = false;

  public constructor(public state: GithubRepositoryState) {}

  public observe(): GithubRepositoryState {
    return structuredClone(this.state);
  }

  public update(desired: GithubRepositoryState['settings']): void {
    this.updates += 1;
    this.state = { ...this.state, settings: structuredClone(desired) };
    if (this.failAfterUpdate) throw new Error('timeout');
  }
}

describe('separately approved GitHub plans', () => {
  it('derives solo and collaborative policy without visibility effects', () => {
    const solo = createGithubPlan(unprotected, desiredGithubPolicy(false));
    const collaborative = createGithubPlan(unprotected, desiredGithubPolicy(true));
    expect(solo.plan.desired.requiredApprovals).toBe(0);
    expect(collaborative.plan.desired.requiredApprovals).toBe(1);
    expect(JSON.stringify(solo.plan)).not.toMatch(/visibility/iu);
  });

  it('rejects local-only approval and remote drift before mutation', () => {
    const planned = createGithubPlan(unprotected, desiredGithubPolicy(false));
    const fake = new FakeGithub(unprotected);
    expect(() => applyGithubPlan(planned.plan, planned.digest, fake, false)).toThrow(
      /remote approval/iu,
    );
    fake.state = {
      ...fake.state,
      settings: { ...fake.state.settings, allowMergeCommit: false },
    };
    expect(() => applyGithubPlan(planned.plan, planned.digest, fake, true)).toThrow(/drift/iu);
    expect(fake.updates).toBe(0);
  });

  it('re-observes a timeout-after-success instead of repeating the effect', () => {
    const planned = createGithubPlan(unprotected, desiredGithubPolicy(false));
    const fake = new FakeGithub(unprotected);
    fake.failAfterUpdate = true;
    expect(applyGithubPlan(planned.plan, planned.digest, fake, true).state).toBe(
      'succeeded-after-reobservation',
    );
    expect(fake.updates).toBe(1);
  });
});
