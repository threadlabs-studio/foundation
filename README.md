# Threadlabs Foundation

Threadlabs Foundation is an executable, evidence-based standard for starting and maintaining open-source repositories.

The goal is not to force every project through the strictest possible machinery. Foundation makes each control explicit, explains what confidence it buys and what it costs, and lets maintainers adopt stronger verification where the project warrants it.

## What it will provide

- A guided `threadlabs` CLI for new and existing repositories
- Composable standards for tooling, CI, publishing, dependency freshness, and agent guidance
- Read-only audits and reviewable adoption plans before repository changes
- Verification lanes that scale from fast local feedback to release confidence
- Machine-readable configuration, evidence, and intentional exceptions

Foundation is in active development. The reproducible package and CLI foundation is complete; the contracts, module catalog, audit engine, safe application flow, and integrations are tracked in the [implementation plan](docs/plans/2026-09-03-1329-feat-threadlabs-project-framework-plan.md).

## Principles

1. Prefer maintained LTS runtimes and stable tooling.
2. Treat strictness as a reasoned, visible choice rather than a universal maximum.
3. Preview changes before applying them and make repeated application safe.
4. Keep local repository work useful when optional hosted-service integrations are unavailable.
5. Produce evidence that both maintainers and coding agents can use to judge completion.

## Development

Foundation requires Node.js 22.13 or later and pins pnpm through Corepack.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm verify:pr
corepack pnpm threadlabs --help
```

## License

[MIT](LICENSE)
