import type { ControlDefinition } from './control.js';
import { validateManagedPath } from './config.js';
import { validationIssue, type ValidationIssue } from './errors.js';

export type ModuleCapability =
  'local-files' | 'commands' | 'network-read' | 'github-read' | 'github-write';

export interface ArtifactDefinition {
  readonly path: string;
  readonly ownership: 'managed' | 'section-managed';
  readonly template: string;
  readonly anchors?: readonly [string, string];
}

export interface AdoptionStage {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly artifactPaths: readonly string[];
  readonly controlIds: readonly string[];
}

export interface ModuleDefinition {
  readonly contractVersion: '1.0';
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly description: string;
  readonly dependencies: readonly string[];
  readonly conflicts: readonly string[];
  readonly capabilities: readonly ModuleCapability[];
  readonly controls: readonly ControlDefinition[];
  readonly artifacts: readonly ArtifactDefinition[];
  readonly stages: readonly AdoptionStage[];
  readonly appliesWhen?: readonly string[];
  readonly experimental?: boolean;
}

export interface ModuleBundle {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly modules: readonly string[];
}

export function validateModule(
  input: ModuleDefinition,
  availableModules: ReadonlySet<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.contractVersion.startsWith('1.')) {
    issues.push(
      validationIssue(
        'unsupported_schema',
        '/contractVersion',
        'Only contract major 1 is supported.',
      ),
    );
  }
  for (const [index, dependency] of input.dependencies.entries()) {
    if (!availableModules.has(dependency)) {
      issues.push(
        validationIssue(
          'unknown_dependency',
          `/dependencies/${index}`,
          `Unknown dependency: ${dependency}`,
        ),
      );
    }
  }
  const seenControls = new Set<string>();
  for (const [index, control] of input.controls.entries()) {
    if (seenControls.has(control.id)) {
      issues.push(
        validationIssue('duplicate_id', `/controls/${index}/id`, `Duplicate ID: ${control.id}`),
      );
    }
    seenControls.add(control.id);
    if (
      control.failureClass.length === 0 ||
      control.applicability.length === 0 ||
      control.retirementCondition.length === 0 ||
      control.cheaperAlternatives.length === 0 ||
      control.cost.expectedSeconds < 0
    ) {
      issues.push(
        validationIssue(
          'required',
          `/controls/${index}`,
          'Control rationale and cost metadata are required.',
        ),
      );
    }
  }
  input.artifacts.forEach((artifact, index) => {
    issues.push(
      ...validateManagedPath(artifact.path).map((issue) => ({
        ...issue,
        path: `/artifacts/${index}/path`,
      })),
    );
  });
  return issues;
}
