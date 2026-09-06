import { runBoundedCommand } from './command-runner.js';
import type {
  GithubPort,
  GithubRepositorySettings,
  GithubRepositoryState,
} from '../engine/github-policy.js';
import type { ExternalEvidenceState } from '../domain/observation.js';

export function normalizeGithubFailure(status: number | undefined): ExternalEvidenceState {
  if (status === undefined || status === 401) return 'unavailable';
  if (status === 403) return 'forbidden';
  if (status === 429) return 'rate-limited';
  return 'invalid';
}

interface GithubRepositoryResponse {
  readonly full_name: string;
  readonly default_branch: string;
  readonly delete_branch_on_merge: boolean;
  readonly allow_merge_commit: boolean;
  readonly allow_squash_merge: boolean;
  readonly allow_rebase_merge: boolean;
  readonly permissions?: { readonly admin?: boolean; readonly push?: boolean };
}

interface GithubProtectionResponse {
  readonly required_status_checks?: { readonly contexts?: readonly string[] };
  readonly required_pull_request_reviews?: { readonly required_approving_review_count?: number };
  readonly required_conversation_resolution?: { readonly enabled?: boolean };
  readonly allow_force_pushes?: { readonly enabled?: boolean };
  readonly allow_deletions?: { readonly enabled?: boolean };
}

function jsonRequest<T>(arguments_: readonly string[], cwd: string, input?: string): T {
  const result = runBoundedCommand('gh', arguments_, cwd, {
    timeoutMs: 30_000,
    ...(input === undefined ? {} : { input }),
  });
  if (result.state !== 'passed') throw new Error(`GitHub request failed: ${result.stderr}`);
  return JSON.parse(result.stdout) as T;
}

export class GhGithubPort implements GithubPort {
  public constructor(
    private readonly repository: string,
    private readonly cwd: string,
  ) {}

  public observe(): GithubRepositoryState {
    const user = jsonRequest<{ login: string }>(['api', 'user'], this.cwd);
    const repository = jsonRequest<GithubRepositoryResponse>(
      ['api', `repos/${this.repository}`],
      this.cwd,
    );
    let protection: GithubProtectionResponse = {};
    const protectionResult = runBoundedCommand(
      'gh',
      ['api', `repos/${this.repository}/branches/${repository.default_branch}/protection`],
      this.cwd,
      { timeoutMs: 30_000 },
    );
    if (protectionResult.state === 'passed') {
      protection = JSON.parse(protectionResult.stdout) as GithubProtectionResponse;
    } else if (!/HTTP 404/iu.test(protectionResult.stderr)) {
      throw new Error(`GitHub protection request failed: ${protectionResult.stderr}`);
    }
    return {
      repository: repository.full_name,
      authenticatedAs: user.login,
      permission: repository.permissions?.admin
        ? 'admin'
        : repository.permissions?.push
          ? 'write'
          : 'read',
      settings: {
        defaultBranch: repository.default_branch,
        deleteBranchOnMerge: repository.delete_branch_on_merge,
        allowMergeCommit: repository.allow_merge_commit,
        allowSquashMerge: repository.allow_squash_merge,
        allowRebaseMerge: repository.allow_rebase_merge,
        requiredCheck: protection.required_status_checks?.contexts?.[0] ?? null,
        requiredApprovals:
          protection.required_pull_request_reviews?.required_approving_review_count ?? 0,
        requireConversationResolution:
          protection.required_conversation_resolution?.enabled ?? false,
        blockForcePushes: protection.allow_force_pushes?.enabled === false,
        blockDeletions: protection.allow_deletions?.enabled === false,
      },
    };
  }

  public update(desired: GithubRepositorySettings): void {
    jsonRequest(
      [
        'api',
        '--method',
        'PATCH',
        `repos/${this.repository}`,
        '-F',
        `default_branch=${desired.defaultBranch}`,
        '-F',
        `delete_branch_on_merge=${desired.deleteBranchOnMerge}`,
        '-F',
        `allow_merge_commit=${desired.allowMergeCommit}`,
        '-F',
        `allow_squash_merge=${desired.allowSquashMerge}`,
        '-F',
        `allow_rebase_merge=${desired.allowRebaseMerge}`,
      ],
      this.cwd,
    );
    const payload = JSON.stringify({
      required_status_checks: { strict: true, contexts: [desired.requiredCheck] },
      enforce_admins: true,
      required_pull_request_reviews: {
        required_approving_review_count: desired.requiredApprovals,
      },
      restrictions: null,
      required_conversation_resolution: desired.requireConversationResolution,
      allow_force_pushes: !desired.blockForcePushes,
      allow_deletions: !desired.blockDeletions,
    });
    jsonRequest(
      [
        'api',
        '--method',
        'PUT',
        `repos/${this.repository}/branches/${desired.defaultBranch}/protection`,
        '--input',
        '-',
      ],
      this.cwd,
      payload,
    );
  }
}
