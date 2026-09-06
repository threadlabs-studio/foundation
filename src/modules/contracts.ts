import type { ModuleDefinition } from '../domain/module.js';
import { validateModule } from '../domain/module.js';

const fields = new Set([
  'contractVersion',
  'id',
  'version',
  'title',
  'description',
  'dependencies',
  'conflicts',
  'capabilities',
  'controls',
  'artifacts',
  'stages',
  'appliesWhen',
  'experimental',
]);
const capabilities = new Set([
  'local-files',
  'commands',
  'network-read',
  'github-read',
  'github-write',
]);

export function loadDeclarativeModule(
  input: unknown,
  availableModules: ReadonlySet<string>,
): ModuleDefinition {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Declarative module must be an object.');
  }
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!fields.has(key)) throw new Error(`Unknown field in declarative module: ${key}`);
  }
  if (typeof record.contractVersion !== 'string' || !record.contractVersion.startsWith('1.')) {
    throw new Error('Unsupported extension contract major.');
  }
  if (
    !Array.isArray(record.capabilities) ||
    record.capabilities.some((item) => !capabilities.has(String(item)))
  ) {
    throw new Error('Unsupported extension capability.');
  }
  for (const key of ['dependencies', 'conflicts', 'controls', 'artifacts', 'stages'] as const) {
    if (!Array.isArray(record[key])) throw new Error(`Extension field must be an array: ${key}`);
  }
  for (const key of ['id', 'version', 'title', 'description'] as const) {
    if (typeof record[key] !== 'string' || record[key].length === 0) {
      throw new Error(`Extension field must be a nonempty string: ${key}`);
    }
  }
  const module = structuredClone(record) as unknown as ModuleDefinition;
  const issues = validateModule(module, availableModules);
  if (issues.length > 0) throw new Error(issues.map((issue) => issue.message).join(' '));
  return module;
}
