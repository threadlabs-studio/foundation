# Release flow

Foundation supports five explicit strategies:

- `single-package`: one reviewed package version and changelog.
- `fixed-monorepo`: workspace packages version together; Changesets coordinates the version state.
- `independent-monorepo`: packages version independently; Changesets coordinates dependency updates.
- `prerelease-channel`: Changesets pre-mode and a named prerelease channel.
- `exceptional-multi-artifact`: npm plus other artifact types, with a required repository-specific publication/recovery contract.

Changesets files are generated only for the three strategies that need coordinated versioning. The exceptional strategy generates a document requiring an explicit artifact inventory and recovery design rather than pretending npm rules cover every artifact.

## Preparation

From a clean reviewed checkout, `threadlabs release . --json`:

1. discovers publishable root and `packages/*` manifests;
2. rejects placeholder or invalid versions;
3. confirms `CHANGELOG.md` names every version;
4. runs the clean build;
5. performs JSON `npm pack --dry-run` inspection for each package;
6. rejects files outside each package's declared `files` surface;
7. reports results without publishing.

`pnpm verify:release` adds the full PR verification lane before that dry run. Packed-consumer contract tests must exercise declared imports and bins for package-surface changes.

## Publication and recovery

Publication exists only in `.github/workflows/release.yml`. A maintainer manually dispatches it with approval; the protected `npm` environment owns any additional review rules. The workflow uses GitHub OIDC trusted publishing (`id-token: write`) and no reusable npm token.

For each immutable `name@version`, the generated release runner computes the reviewed pack integrity and observes npm before publishing. If the version exists with the same integrity, it skips publication. A different integrity is a hard conflict. Missing or failed registry evidence blocks rather than guesses. Source releases are observed separately, so a registry success followed by a source-host timeout can resume by creating only the missing source release.

Tags and source releases are traceable to the reviewed workflow state. Publication, visibility changes, credential consent, and ambiguous overwrite decisions remain human-only.
