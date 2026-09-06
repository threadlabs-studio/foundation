import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { validateConfig, type ThreadlabsConfig } from '../../src/index.js';

const root = fileURLToPath(new URL('../..', import.meta.url));

describe('published JSON schemas', () => {
  it.each([
    ['config.schema.json', 'https://threadlabs.dev/schemas/config.schema.json'],
    ['lock.schema.json', 'https://threadlabs.dev/schemas/lock.schema.json'],
    ['operation-plan.schema.json', 'https://threadlabs.dev/schemas/operation-plan.schema.json'],
    ['evidence.schema.json', 'https://threadlabs.dev/schemas/evidence.schema.json'],
  ])('publishes %s with a stable identity', (file, id) => {
    const schema = JSON.parse(readFileSync(join(root, 'schemas', file), 'utf8')) as {
      $id?: string;
      $schema?: string;
      type?: string;
    };
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$id).toBe(id);
    expect(schema.type).toBe('object');
  });

  it('keeps the TypeScript and schema minimum manifest aligned', () => {
    const fixture = JSON.parse(
      readFileSync(join(root, 'tests', 'fixtures', 'contracts', 'minimal-config.json'), 'utf8'),
    ) as ThreadlabsConfig;
    const schema = JSON.parse(
      readFileSync(join(root, 'schemas', 'config.schema.json'), 'utf8'),
    ) as { required?: string[] };

    expect(validateConfig(fixture)).toEqual([]);
    expect(schema.required?.sort()).toEqual(Object.keys(fixture).sort());
  });
});
