# Foundation implementation architecture

This document records implementation constraints that are easy to lose when reading one function
at a time. Product policy remains in the standard and configuration documentation; these sections
explain why central mechanisms have their current code shape.

## Module resolution

### Invariant

A resolved module list is a dependency-first closure with no duplicates. The same requested set
must produce the same order regardless of request order because that order feeds adoption stages,
lock content, and machine-readable plans. Conflict checks run against the completed closure so an
indirect dependency cannot evade them.

### Algorithm

`resolveSelection` expands bundles into one requested set, then performs a depth-first traversal.
Both roots and each module's dependencies are sorted before traversal. The temporary `visiting` set
distinguishes a cycle from a module already emitted, while the insertion-ordered `resolved` set is
the topological result. A second pass checks conflicts after dependency expansion.

### Rationale

Preserving caller order would make equivalent manifests produce different plan digests. A generic
graph package would add dependency and surface area to a small, bounded catalog without removing
the need for Foundation-specific unknown-module and conflict diagnostics.

### Verification

`tests/unit/modules/catalog.test.ts` proves request-order independence, dependency ordering,
unknown-module rejection, and conflict-free bundle resolution.

## Plan construction

### Invariant

Planning is read-only with respect to the target repository. Every proposed write carries the
exact preimage it was reviewed against and the postcondition it must produce. The plan also binds
the canonical manifest, prior lock, standard version, and physical repository fingerprint.

### Security

Every target passes repository-relative path validation and physical-root/symlink checks before it
enters the plan. Existing content is replaceable only when ownership is explicit and its managed
preimage matches the lock; a purpose-built local file is never silently adopted as template-owned.

### Rationale

The plan contains rendered bytes rather than instructions to render later. That makes the digest
the approval boundary: applying the plan does not re-resolve templates, current time, module
selection, or repository identity after review.

### Verification

`tests/unit/engine/plan.test.ts` covers deterministic digests, ownership ambiguity, preimages,
staged adoption, safe paths, and preservation of locally owned content.

## Operation application

### Invariant

Application requires the exact approved plan digest, target fingerprint, manifest binding, lock
binding, and every remaining effect preimage. A journal entry marked succeeded is trusted only when
the current file still matches that effect's postcondition.

### Lifecycle

Before writing, Foundation validates all remaining effects so known drift cannot cause an avoidable
half-application. Each write transitions through pending, running, and succeeded journal records.
On resume, already-satisfied postconditions are recorded as skipped; failed or drifted effects
remain visible and block unsafe continuation.

### Security

Local apply rejects remote effects because GitHub mutation has a separate observation, plan,
digest, and approval boundary. The write path is revalidated immediately before each mutation, and
the postcondition is read back before success is journaled.

### Verification

`tests/unit/engine/apply.test.ts` and `tests/integration/apply-resume.test.ts` exercise approval
binding, drift rejection, interruption, idempotent recovery, journal state, and target safety.

## Bounded command execution

### Platform boundary

Foundation invokes only a fixed set of tools as argument arrays with `shell: false`. It supplies a
minimal environment containing the host path, home directory, CI mode, and disabled color rather
than forwarding the entire maintainer environment into verification subprocesses.

### Security

Executable names are allowlisted, arguments containing control characters are rejected, and output
is redacted for home paths and credential-shaped tokens before it is retained. Output is byte-
bounded independently of the subprocess buffer so evidence cannot grow without limit.

### Lifecycle

Pre-canceled work never spawns. Spawned work has a deadline and synchronous completion boundary.
A timeout yields `unknown`, because the check produced no reliable verdict; a nonzero completed
process yields `failed`.

### Rationale

A shell would widen parsing and injection semantics, while inheriting the complete environment
would turn unrelated local state into an undocumented input. Treating timeouts as failures would
claim negative evidence the runner did not observe.

### Verification

`tests/integration/verify.test.ts` covers allowlisting, hostile arguments, redaction, truncation,
timeouts, cancellation, and the no-shell execution path.
