# Repository guidance

## Authority

- `README.md` defines the shipped product and onboarding contract.
- `docs/standard.md`, `docs/configuration.md`, `docs/controls.md`, and `docs/release.md` own the detailed standard.
- `threadlabs.config.json` and `.threadlabs.lock.json` declare this repository's modules and managed artifacts.
- Public TypeScript and JSON contracts live in `src/domain/` and `schemas/`; tests are authoritative examples.
- Ask the owner when requirements conflict, a public contract needs an incompatible change, or a destructive/remote action is required.

## Safe work

- Preserve unrelated work and never rewrite shared Git history without explicit approval.
- Audit and preview before applying Foundation changes. Apply only a reviewed plan with its exact digest.
- Check `threadlabs.config.json` for each path's ownership mode before editing. For managed paths, use `.threadlabs.lock.json` to confirm the last-applied content and change the owning Foundation template; purpose-built local paths may be edited directly, and ambiguous ownership blocks change.
- Never put credentials, machine-local paths, private provenance, or private project examples in this public repository.
- Do not publish from a local process. Publication requires the protected, human-dispatched release workflow.
- Use Oxlint for JavaScript and TypeScript linting. Do not add Prettier or another repository-wide formatter.
- Do not add Tailwind. Use project-owned CSS, CSS Modules, or an explicitly selected non-Tailwind styling approach.

## Verification

- During implementation: run the owning test, then `corepack pnpm verify:inner`.
- Before handoff: run `corepack pnpm verify:pr`.
- For filesystem/process/platform changes: also run `corepack pnpm verify:extended`.
- For release, package-surface, workflow, or version changes: also run `corepack pnpm verify:release` from a clean checkout.
- Dogfood must remain clean: `corepack pnpm threadlabs audit . --json` and `corepack pnpm threadlabs plan . --check --json` must both exit successfully.

Report the revision and dirty state, lanes run, checks and durations, skipped or unavailable evidence, and any remaining human judgment. Passing focused tests alone is partial verification when a broader applicable lane was not run.
