# Configuration and CLI

`threadlabs.config.json` is the authored manifest. `.threadlabs.lock.json` records resolved module versions and hashes only for Foundation-managed artifacts. Both use schema `1.0`; operation plans and evidence have their own versioned schemas in `schemas/`.

## Minimal manifest

```json
{
  "schemaVersion": "1.0",
  "standardVersion": "1.0.0",
  "bundles": ["typescript-library"],
  "modules": [],
  "exceptions": [],
  "freshness": {
    "holds": [
      {
        "name": "@types/node",
        "reason": "Type declarations target the minimum supported Node line.",
        "owner": "Project Contributors",
        "reviewDate": "2027-01-31"
      }
    ]
  },
  "ownership": [],
  "release": { "strategy": "single-package" },
  "settings": {
    "projectName": "example-library",
    "description": "An example library.",
    "licenseHolder": "Project Contributors",
    "licenseYear": 2026
  }
}
```

The guided `init`, `--config`, and explicit `--bundle`/`--module` paths produce the same manifest and plan. `init` accepts `--name`, `--description`, `--owner`, repeated `--bundle`, and repeated `--module` flags. It only previews; use `apply` with the returned plan path and digest to write project files.

`freshness.holds` records deliberate package-version constraints. Each hold requires a reason, owner, and review date; an expired hold becomes a stale finding. The generated TypeScript library records why `@types/node` follows the minimum supported runtime line rather than the newest line.

## Modules

The recommended `typescript-library` bundle contains `core`, `typescript-node`, `github`, `freshness`, `agents`, `public-api`, `generated-artifacts`, and `npm-publish`.

Optional modules are `browser`, `cross-platform`, `docs`, `performance`, and `long-running`. The built-in catalog uses the same versioned declarative contract exposed for experimental third-party catalogs; external modules declare data and templates and do not execute package code in the maintainer process.

Use `threadlabs explain` to list modules and `threadlabs explain <module>` to inspect its controls, applicability, lane, cost, dependencies, artifacts, and stages.

## Ownership

Each entry has a portable repository-relative `path` and one mode:

- `managed`: Foundation owns the whole file and requires a matching lock preimage before replacement.
- `section-managed`: Foundation owns a section delimited by two stable anchors.
- `local`: the repository intentionally owns the implementation; Foundation reports the decision but does not write it.
- `unmanaged`: outside Foundation's desired state.
- `ambiguous`: unresolved ownership; planning is blocked.

`threadlabs.config.json` and `.threadlabs.lock.json` are always managed. Managed targets cannot be absolute, traverse `..`, touch `.git`, cross symlinks, escape the physical root, or collide by case.

## Commands and mutation boundary

| Command                                    | Effect                                                                                              |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `audit`                                    | Read-only local classification and staged adoption suggestions                                      |
| `init`, `plan`, `upgrade`                  | Write a preview plan only                                                                           |
| `apply`, `resume`                          | Apply an exact local plan/digest with preimage checks and an append-only journal                    |
| `status`, `explain`, `freshness`, `verify` | Report state or bounded evidence; verification commands may produce their normal build/test outputs |
| `github --action audit`                    | Read GitHub settings                                                                                |
| `github --action plan`                     | Write a separate remote plan                                                                        |
| `github --action apply`                    | Requires `--remote-approve`, the plan, and exact digest                                             |
| `release`                                  | Clean build/package validation only; never publishes                                                |
| `clean --yes`                              | Delete saved preview plans; retain operation journals                                               |

Every command supports `--json`. Structured output uses stdout and diagnostics use stderr. Exit classes are stable: `0` success, `1` findings, `2` invalid input, `3` stale/conflict, `4` unavailable evidence, `5` canceled, and `6` mutation/verification failure.

Plans bind the canonical manifest, lock, standard version, physical repository fingerprint, stage, local preimages, remote observation, and postconditions. Drift means creating and approving a new plan, not acknowledging the old one.
