# Contributing

Thank you for improving Foundation. Changes should make repository outcomes more trustworthy without hiding their maintenance or verification cost.

## Workflow

1. Open an issue for a substantial new control, module, schema-major change, or behavior that expands remote mutation.
2. Branch from `main` using `<type>/<short-kebab-description>`. Supported types are `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `release`, and `experiment`.
3. Add the smallest test that proves the behavior. Public contracts require positive and negative contract fixtures.
4. Run `corepack pnpm verify:inner` while working and `corepack pnpm verify:pr` before review. Run extended or release verification when the changed surface requires it.
5. Explain the failure class addressed, evidence gained, CI/runtime cost, migration risk, and any manual judgment left.

Do not commit operation journals, package tarballs, build output, credentials, local paths, or examples derived from private repositories.

## Compatibility

Manifest, lock, plan, evidence, module, and control IDs are versioned public contracts. IDs are never repurposed. A schema-major or CLI removal needs a migration, documentation, and at least one released deprecation cycle.

## Generated files

Check `threadlabs.config.json` before editing. For a `managed` artifact, change the built-in template or module definition and regenerate the artifact so dogfood remains idempotent. Files marked `local` are intentionally maintained directly.
