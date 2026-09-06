import type { ModuleDefinition } from '../domain/module.js';
import { compareText } from '../domain/canonicalize.js';

export interface AuditStage {
  readonly id: string;
  readonly title: string;
  readonly moduleId: string;
  readonly artifactPaths: readonly string[];
  readonly blockedPaths: readonly string[];
}

export function buildAuditStages(
  modules: readonly ModuleDefinition[],
  existingPaths: ReadonlySet<string>,
  resolvedOwnershipPaths: ReadonlySet<string>,
): readonly AuditStage[] {
  return modules
    .flatMap((module) =>
      module.stages.map((stage) => ({
        id: stage.id,
        title: stage.title,
        moduleId: module.id,
        artifactPaths: [...stage.artifactPaths].toSorted(compareText),
        blockedPaths: stage.artifactPaths
          .filter((path) => existingPaths.has(path) && !resolvedOwnershipPaths.has(path))
          .toSorted(compareText),
      })),
    )
    .filter((stage) => stage.artifactPaths.length > 0)
    .toSorted((left, right) => compareText(left.id, right.id));
}
