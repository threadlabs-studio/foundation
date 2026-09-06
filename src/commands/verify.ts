import { snapshotRepository } from '../adapters/filesystem.js';
import type { VerificationLane } from '../domain/control.js';
import { inferModules } from '../engine/applicability.js';
import { verifyRepository } from '../engine/verify.js';
import { resolveSelection } from '../modules/catalog.js';
import { loadConfig } from './context.js';
import type { CommandOptions, CommandResult } from './types.js';

export function verifyCommand(options: CommandOptions): CommandResult {
  const lane = String(options.values.lane ?? 'inner') as VerificationLane;
  if (!['inner', 'pr', 'extended', 'scheduled', 'release'].includes(lane)) {
    throw new Error(`Unknown verification lane: ${lane}`);
  }
  const config = loadConfig(options.root);
  const moduleIds =
    config === undefined
      ? inferModules(snapshotRepository(options.root))
      : resolveSelection({ bundles: config.bundles, modules: config.modules }).moduleIds;
  const evidence = verifyRepository(options.root, moduleIds, lane);
  return {
    command: 'verify',
    status:
      evidence.state === 'passed'
        ? 'success'
        : evidence.state === 'failed'
          ? 'failed'
          : evidence.state === 'canceled'
            ? 'canceled'
            : 'findings',
    exitClass:
      evidence.state === 'passed'
        ? 'success'
        : evidence.state === 'failed'
          ? 'mutationFailed'
          : evidence.state === 'canceled'
            ? 'canceled'
            : 'unavailableEvidence',
    summary: `Verification ${evidence.state} for the ${lane} lane.`,
    data: evidence,
  };
}
