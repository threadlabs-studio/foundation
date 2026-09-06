# Threadlabs Foundation

Threadlabs Foundation turns an evidence-based repository standard into a starter and maintenance CLI. It can create a new project, audit an existing one without changing it, preview an immutable adoption plan, and apply only the plan you approved.

The standard aims toward strong outcomes without pretending every control is free. Each module states the failure it prevents, when it applies, which verification lane owns it, and its expected cost. Projects can keep purpose-built files locally owned and record reviewed exceptions instead of silently drifting.

## Start a TypeScript library

Foundation is not published to npm yet. Run the public repository directly with pnpm and Corepack:

```sh
corepack pnpm dlx github:threadlabs-studio/foundation init ./my-library \
  --bundle typescript-library \
  --name my-library \
  --description "A useful library" \
  --owner "Project Contributors" \
  --json
```

`init` writes only `.threadlabs/plans/latest.json`. Review its paths and digest, then apply that exact plan:

```sh
corepack pnpm dlx github:threadlabs-studio/foundation apply ./my-library \
  --plan .threadlabs/plans/latest.json \
  --digest <digest-from-init>
```

In an interactive terminal you may omit the bundle and module flags. The guided flow recommends the TypeScript library bundle and lets you select optional modules. A checked-in config and non-interactive flags resolve through the same engine.

## Adopt it in an existing repository

Start read-only. Foundation deliberately refuses to treat existing custom files as template-owned:

```sh
corepack pnpm dlx github:threadlabs-studio/foundation audit . --json
```

Create `threadlabs.config.json` after deciding which files Foundation may manage, then preview and apply:

```sh
corepack pnpm dlx github:threadlabs-studio/foundation plan . --check --json
corepack pnpm dlx github:threadlabs-studio/foundation plan . --json
corepack pnpm dlx github:threadlabs-studio/foundation apply . \
  --plan .threadlabs/plans/latest.json \
  --digest <reviewed-digest>
```

Local and GitHub mutations have separate plans and approvals. Package publication is never available from the local CLI; it is generated as a protected, human-dispatched OIDC workflow.

## What the recommended bundle installs

The `typescript-library` bundle composes core repository policy, strict ESM TypeScript on maintained Node LTS lines, stable CI, dependency freshness, coding-agent guidance, public package contracts, generated-artifact ownership, and safe npm release controls. Optional modules add browser, cross-platform, documentation-site, performance, or long-running verification only when those risks apply.

The important distinction is not “strict” versus “relaxed.” It is:

- fast deterministic checks belong in the inner and pull-request lanes;
- costly or noisy checks move to extended or scheduled lanes;
- package and provenance checks belong in the release lane;
- a control can be excepted only with a reason, owner, scope, and review date.

See [the standard](docs/standard.md), [configuration](docs/configuration.md), [control economics](docs/controls.md), and [release flow](docs/release.md).

## Commands

`init`, `audit`, `plan`, `apply`, `status`, `resume`, `upgrade`, `explain`, `clean`, `verify`, `freshness`, `github`, and `release` all support `--json`. Exit codes distinguish findings, invalid input, stale plans, unavailable evidence, cancellation, and mutation failure.

```sh
corepack pnpm dlx github:threadlabs-studio/foundation --help
```

## Develop Foundation

Foundation supports Node.js 22.13+ and Node 24 and pins pnpm through Corepack.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm verify:pr
corepack pnpm threadlabs audit . --json
corepack pnpm threadlabs plan . --check --json
```

Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing public contracts. Security reports follow [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
