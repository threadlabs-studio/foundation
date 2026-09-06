import type { VerificationLane } from '../domain/control.js';
import type { ArtifactDefinition, ModuleDefinition } from '../domain/module.js';

interface ModuleInput {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly failureClass: string;
  readonly applicability: string;
  readonly lane?: VerificationLane;
  readonly expectedSeconds?: number;
  readonly dependencies?: readonly string[];
  readonly capabilities?: ModuleDefinition['capabilities'];
  readonly artifacts?: readonly ArtifactDefinition[];
}

export function defineModule(input: ModuleInput): ModuleDefinition {
  const controlId = `${input.id}.baseline`;
  return {
    contractVersion: '1.0',
    id: input.id,
    version: '1.0.0',
    title: input.title,
    description: input.description,
    dependencies: input.dependencies ?? (input.id === 'core' ? [] : ['core']),
    conflicts: [],
    capabilities: input.capabilities ?? ['local-files'],
    controls: [
      {
        id: controlId,
        title: input.title,
        failureClass: input.failureClass,
        applicability: input.applicability,
        lane: input.lane ?? 'pr',
        determinism: 'deterministic',
        cost: { expectedSeconds: input.expectedSeconds ?? 5, humanEffort: 'low' },
        cheaperAlternatives: ['Documented manual inspection when automation is unavailable.'],
        retirementCondition: `Remove when the ${input.failureClass} failure class no longer applies.`,
      },
    ],
    artifacts: input.artifacts ?? [],
    stages: [
      {
        id: `${input.id}.install`,
        title: `Install ${input.title}`,
        description: `Add the ${input.title.toLowerCase()} standard in a reviewable stage.`,
        artifactPaths: (input.artifacts ?? []).map((artifact) => artifact.path),
        controlIds: [controlId],
      },
    ],
  };
}
