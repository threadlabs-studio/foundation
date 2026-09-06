---
artifact_contract: "ce-handoff/v1"
created_at: "2026-09-03T21:10:04Z"
title: "Threadlabs project framework after foundation"
summary: "The public-safe framework is fully planned and U1 is locally verified; resume with U2 contracts without repeating the discovery work."
keywords: ["threadlabs", "repository-standards", "cli", "project-framework", "u1-complete"]
resume_focus: "Verify the unchanged U1 boundary, then implement U2 contracts from the implementation-ready plan; do not repeat research or start shipping."
repository: "threadlabs-studio/foundation"
branch: "main"
---

# Project framework pause point

This handoff captures the completed U1 boundary before the Foundation repository was created. It remains the continuation guide after the repository bootstrap is committed to `main`; package publication is still a separate decision.

## Objective and user decisions

Build a public-safe Threadlabs tool that makes reasoned repository standards executable for both new and existing projects. The user explicitly wants more standardization, but not unreasoned maximum strictness: verification should increase confidence in proportion to cost. Prefer maintained LTS runtimes and current stable tools, include a freshness policy, and support optional modules selected interactively or through configuration.

The public product must never identify the private projects, paths, or incidents that motivated the discovery work. Engine-specific project profiles are not part of v1. These are explicit user constraints, not agent inference.

## Authoritative references

- `docs/plans/2026-09-03-1329-feat-threadlabs-project-framework-plan.md` is the implementation-ready plan. It contains 50 requirements, acceptance examples, architectural decisions, ten implementation units, the verification contract, and the definition of done. Do not repeat the prior discovery or planning pass.
- `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `tsconfig.build.json`, `oxlint.json`, `prettier.config.mjs`, and `vitest.config.ts` define the U1 package and toolchain contract.
- `src/index.ts` and `src/cli.ts` are the current U1 runtime surface. The CLI supports only help and stable unknown-command handling; later units add real commands.
- `tests/contract/package.test.ts` is the U1 proof for direct APIs plus pack, install, import, and installed-binary behavior.

## Current state

Completed: U1, foundation and package reproducibility.

- ESM TypeScript package and `threadlabs` binary established for Node >=22.13, with Node 24 as the preferred development LTS.
- Exact versions are pinned: pnpm 11.25.0, TypeScript 7.0.2, Vitest 5.0.0, Oxlint 1.81.0, Prettier 3.9.6, `@types/node` 22.20.1, and `@inquirer/prompts` 8.7.1.
- `pnpm-workspace.yaml` contains an exact-version exception for same-day releases that pnpm's minimum-release-age policy otherwise quarantines. The general safeguard remains enabled.
- Packed artifacts include compiled ESM, declarations, declaration maps, and source maps; development, test, and configuration files are excluded.

Not started: U2 through U10. The next coherent unit is U2, domain contracts and JSON schemas. Do not start with repository mutation or interactive UI before those contracts exist.

## Verification at pause

The orchestrator independently ran the following after the U1 worker finished:

- `git diff --check`: passed.
- `corepack pnpm install --frozen-lockfile`: passed with pnpm 11.25.0.
- `corepack pnpm verify:pr`: passed formatting, Oxlint, strict typecheck, clean build, and all four tests.

The U1 worker also verified the packed package in synthetic Node 24 and Node 22.13.1 consumers: public import and help passed; an unknown command exited 2 with stable diagnostics and no stack trace.

## Fragile local state

At the pause, all implementation and planning changes were untracked on `feat/threadlabs-project-framework`; the branch still pointed at the base commit recorded above. Check current Git state rather than assuming that remains true. Do not clean, reset, stash, or switch branches without preserving the work.

No user-owned dirty file was found before implementation. `node_modules` and `dist` are generated and ignored.

## Resume path

1. Read the implementation plan, especially U2, its cited requirements and key technical decisions, the verification contract, and the definition of done.
2. Inspect `git status --short` and rerun `corepack pnpm verify:pr` if the worktree has changed.
3. Implement U2 only: canonical configuration, lock, plan, evidence, module, control, observation, finding, operation, and error contracts and schemas, with contract fixtures and stable ordering and fingerprints.
4. Continue serially through U3-U10, verifying each unit before the next. The planned order is U2 contracts, U3 module catalog, U4 audit, U5 plan/apply, U6 CLI UX, U7 verification/freshness, U8 GitHub settings, U9 release automation, and U10 docs/dogfood/CI.
5. Stay in implementation and local-verification mode unless the user separately authorizes a commit, push, pull request, publication, or repository visibility change.

The prior implementation workflow used a fresh bounded worker for U1 and performed orchestrator verification afterward. Repeating that pattern is optional; pausing did not authorize automatic continuation.
