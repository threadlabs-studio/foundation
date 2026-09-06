# Control economics

Foundation controls are justified by failure class and applicability, not project prestige or age. The expected time is a starting estimate; actual lane duration is evidence and may lead to narrower scope or a slower lane.

| Module                | Failure class addressed                         | Default lane | Expected time | Use when                                   |
| --------------------- | ----------------------------------------------- | ------------ | ------------: | ------------------------------------------ |
| `core`                | missing repository contract                     | inner        |            1s | every managed repository                   |
| `typescript-node`     | runtime or type drift                           | inner        |           45s | Node/TypeScript code                       |
| `github`              | unverified default-branch changes               | PR           |          180s | hosted on GitHub                           |
| `freshness`           | silent dependency/runtime obsolescence          | scheduled    |           60s | dependencies exist                         |
| `agents`              | agent completion without authoritative evidence | inner        |            1s | prompt-driven development                  |
| `public-api`          | package/API regression                          | PR           |           30s | reusable imports or bins                   |
| `generated-artifacts` | generated-source drift                          | PR           |           15s | generated output is committed/consumed     |
| `npm-publish`         | untraceable publication                         | release      |          240s | npm publication                            |
| `browser`             | browser behavior regression                     | extended     |          300s | user-visible browser behavior              |
| `cross-platform`      | platform-specific regression                    | extended     |          600s | filesystem/process/platform risk           |
| `docs`                | published documentation regression              | extended     |          120s | a documentation site is shipped            |
| `performance`         | material performance regression                 | extended     |          600s | a measured hot path exists                 |
| `long-running`        | escaped exhaustive/corpus failure               | scheduled    |          900s | valuable checks are too slow/noisy for PRs |

## Choosing a lever

1. Name the failure that would matter and the deterministic evidence that can catch it.
2. Estimate frequency, runtime, flakiness, maintainer effort, and migration risk.
3. Put cheap, stable evidence close to the change.
4. Move high-cost or low-frequency evidence outward instead of deleting it.
5. If evidence cannot be automated reliably, document the remaining human judgment.
6. Review exceptions and held versions on a date, not “eventually.”

The strongest defensible setup is the goal. The highest common denominator is not: a browser suite on a non-browser library adds cost without confidence, while skipping packed-consumer tests for a public library saves time by giving up exactly the evidence its users depend on.
