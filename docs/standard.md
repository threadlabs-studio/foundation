# The Threadlabs repository standard

## Decision

Use a maintained LTS-first TypeScript/Node baseline for public libraries, then compose additional controls from observable failure risks. Keep pull-request feedback fast; move expensive evidence to extended, scheduled, or release lanes. Do not weaken a project merely because its infrastructure has not been invested in yet, and do not add machinery whose confidence gain cannot justify its cost.

## Technology baseline

The recommended library baseline is strict ESM TypeScript, pnpm through Corepack, Vitest, Oxlint, and GitHub Actions. Node 24 is the primary maintained LTS line and Node 22.13 through the Node 22 line remains a supported compatibility range. Odd-numbered and EOL lines are not accidentally promised by an open-ended engine range. Exact tool versions and action commits are checked in. CI installs Corepack 0.34.0 explicitly because it is the newest pinned line compatible with the minimum Node 22.13 contract; relying on Node's bundled Corepack would retain stale package-manager signing keys. Dependabot proposes compatible dependency and action updates weekly; major, security, prerelease, held, EOL, stale, and failed-update states stay distinct.

Oxlint is the required JavaScript and TypeScript lint gate and warnings fail CI. Foundation does not install or configure a repository-wide formatter; maintainers keep source readable through normal editing and review without accepting formatting churn as a prerequisite for correctness. New Foundation repositories do not use Prettier or Tailwind. UI projects use project-owned CSS, CSS Modules, or an explicitly selected non-Tailwind styling approach.

Version drift is presumed accidental unless an exception records a reason, owner, scope, and review date. Maintained stable releases are preferred. Prerelease, EOL, or intentionally held tooling needs explicit evidence and periodic review.

The `freshness` command compares the declared Node ranges with the [published Node.js release schedule](https://github.com/nodejs/Release#release-schedule). Unavailable lifecycle data remains unknown; it never silently validates an EOL or non-LTS development line.

## Verification lanes

| Lane         | Normal use             | What belongs here                                                    | Budget target |
| ------------ | ---------------------- | -------------------------------------------------------------------- | ------------- |
| Inner        | Every change           | lint, types, focused contracts, build truth                          | 90 seconds    |
| Pull request | Before review/handoff  | full tests, schemas, package smoke, public safety, dogfood           | 5 minutes     |
| Extended     | Triggered by risk      | platform, browser, performance, fault recovery, larger corpora       | 15 minutes    |
| Scheduled    | Time-based             | noisy or exhaustive checks and freshness observations                | measured      |
| Release      | Reviewed publish state | clean pack, consumer behavior, version/changelog, provenance dry run | measured      |

A budget overrun is a finding, not an excuse to remove a valuable control. First reduce its scope or frequency. Move it to a slower lane when immediate feedback adds little. Make a budget mandatory only when the product contract justifies it.

## GitHub workflow

- The default branch is `main`.
- Branches use `<type>/<short-kebab-description>` with `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `release`, or `experiment`.
- CI uses frozen installs, least-privilege permissions, full-SHA action pins, cancellation for superseded non-release work, and a stable `Required` aggregate check.
- Default protection blocks force pushes and deletion, requires conversations resolved, and requires `Required`. Collaborative repositories add one approving review; solo repositories may use zero approvals while retaining CI and protection.
- Local files/settings and GitHub settings require different digest-bound plans and approvals.

## Ownership and exceptions

Foundation never assumes that an existing file belongs to it. `managed` gives it whole-file ownership; `section-managed` reserves an anchored section; `local` records an intentional hand-maintained implementation; `unmanaged` is outside the standard; `ambiguous` blocks change until a maintainer decides. Existing content without a matching lock preimage is not overwritten.

An exception is not a vague “skip.” It names a control, rationale, owner, scope, and review date. Repeated expensive escaped defects should graduate from prose into a regression test, deterministic check, or narrowly scoped reusable skill.

## Agent-driven development

Every managed repository has a concise root `AGENTS.md` that points to authoritative requirements, safe/destructive boundaries, applicable verification, generated-file hazards, completion evidence, and the owner-decision route. A root `CLAUDE.md` imports and routes Claude to the same contract. Tool-specific files must not compete with `AGENTS.md`. Temporary plans, branch state, measurements, and handoff notes do not belong in durable instructions.
