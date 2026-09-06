import type { ThreadlabsConfig } from '../../src/domain/config.js';

export function makeConfig(modules: readonly string[] = ['core']): ThreadlabsConfig {
  return {
    schemaVersion: '1.0',
    standardVersion: '1.0.0',
    bundles: [],
    modules,
    exceptions: [],
    ownership: [],
  };
}
