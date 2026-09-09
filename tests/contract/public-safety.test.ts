import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));
const ignoredDirectories = new Set(['.git', '.threadlabs', 'coverage', 'dist', 'node_modules']);
const thisFile = 'tests/contract/public-safety.test.ts';

function publicTextFiles(directory = root): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return [];
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) return publicTextFiles(absolute);
    const path = relative(root, absolute).split('\\').join('/');
    return path === thisFile ? [] : [path];
  });
}

describe('public repository safety', () => {
  it('contains no machine-local paths, embedded credentials, or private workspace provenance', () => {
    const localPath = new RegExp(
      ['(?:^|[\\s"\'])', '/', '(?:Users|home)', '/', '[^\\s"\']+'].join(''),
      'u',
    );
    const privateWorkspace = new RegExp(
      ['(?:^|/)', 'git', '/', '(?:oss|private)', '/'].join(''),
      'u',
    );
    const credential = /\b(?:gh[opusr]|npm)_[A-Za-z0-9_=-]{16,}\b/u;
    const failures: string[] = [];

    for (const path of publicTextFiles()) {
      const content = readFileSync(join(root, path), 'utf8');
      if (localPath.test(content)) failures.push(`${path}: machine-local path`);
      if (privateWorkspace.test(content)) failures.push(`${path}: private workspace path`);
      if (credential.test(content)) failures.push(`${path}: credential-like value`);
    }

    expect(failures).toEqual([]);
  });

  it('keeps generated workflows immutable, least-privilege, frozen, and human-gated', () => {
    const workflowDirectory = join(root, '.github', 'workflows');
    const workflows = readdirSync(workflowDirectory).map((name) => ({
      name,
      content: readFileSync(join(workflowDirectory, name), 'utf8'),
    }));
    for (const { name, content } of workflows) {
      for (const line of content.match(/^\s*- uses: .+$/gmu) ?? []) {
        expect(line, name).toMatch(/@[a-f0-9]{40}\s+#\s+v\d+/u);
      }
      expect(content, name).toContain('permissions:');
      expect(content, name).toContain('pnpm install --frozen-lockfile');
      expect(content, name).toContain(
        'npm install --global --ignore-scripts --force corepack@0.34.0',
      );
    }

    const ci = workflows.find(({ name }) => name === 'ci.yml')?.content ?? '';
    expect(ci).toContain("node: ['22.13.1', '24']");
    expect(ci).toContain('name: Required');
    expect(ci).toContain('cancel-in-progress: true');

    const release = workflows.find(({ name }) => name === 'release.yml')?.content ?? '';
    expect(release).toContain('workflow_dispatch:');
    expect(release).toContain('type: boolean');
    expect(release).toContain('id-token: write');
    expect(release).toContain('environment: npm');
    expect(release).toContain('cancel-in-progress: false');
    expect(release).not.toMatch(/NPM_TOKEN|NODE_AUTH_TOKEN/u);
  });

  it('makes the root agent guide sufficient to choose verification and report evidence', () => {
    const guide = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    for (const command of ['verify:inner', 'verify:pr', 'verify:extended', 'verify:release']) {
      expect(guide).toContain(command);
    }
    for (const evidence of [
      'revision',
      'dirty state',
      'durations',
      'skipped',
      'unavailable',
      'human judgment',
    ]) {
      expect(guide.toLowerCase()).toContain(evidence);
    }
  });

  it('keeps managed text hashes stable across Git checkout platforms', () => {
    const attributes = readFileSync(join(root, '.gitattributes'), 'utf8');
    expect(attributes).toContain('* text=auto eol=lf');
  });
});
