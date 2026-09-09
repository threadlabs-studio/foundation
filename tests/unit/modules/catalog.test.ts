import { describe, expect, it } from 'vitest';

import {
  BUILT_IN_MODULE_IDS,
  getBuiltInModule,
  resolveSelection,
  TYPESCRIPT_LIBRARY_BUNDLE,
} from '../../../src/modules/catalog.js';
import { renderTemplate, templateNames } from '../../../src/templates/index.js';

describe('built-in catalog', () => {
  it('contains every public module with complete control economics', () => {
    expect(BUILT_IN_MODULE_IDS).toEqual([
      'agents',
      'browser',
      'core',
      'cross-platform',
      'docs',
      'freshness',
      'generated-artifacts',
      'github',
      'long-running',
      'npm-publish',
      'performance',
      'public-api',
      'typescript-node',
    ]);

    for (const id of BUILT_IN_MODULE_IDS) {
      const module = getBuiltInModule(id);
      expect(module.controls.length).toBeGreaterThan(0);
      for (const control of module.controls) {
        expect(control.failureClass).not.toBe('');
        expect(control.applicability).not.toBe('');
        expect(control.cost.expectedSeconds).toBeGreaterThanOrEqual(0);
        expect(control.cheaperAlternatives.length).toBeGreaterThan(0);
        expect(control.retirementCondition).not.toBe('');
      }
      for (const artifact of module.artifacts) {
        expect(['managed', 'section-managed']).toContain(artifact.ownership);
        expect(artifact.template).not.toBe('');
      }
    }
  });

  it('resolves the recommended bundle deterministically without expensive optional modules', () => {
    const first = resolveSelection({ bundles: ['typescript-library'], modules: [] });
    const second = resolveSelection({
      bundles: [],
      modules: [...TYPESCRIPT_LIBRARY_BUNDLE.modules].reverse(),
    });
    expect(first.moduleIds).toEqual(second.moduleIds);
    expect(first.moduleIds).toContain('typescript-node');
    expect(first.moduleIds).not.toContain('cross-platform');
    expect(first.moduleIds).not.toContain('performance');
    expect(first.moduleIds).not.toContain('browser');
  });

  it('adds dependencies and rejects unknown modules', () => {
    expect(resolveSelection({ bundles: [], modules: ['performance'] }).moduleIds).toEqual([
      'core',
      'performance',
    ]);
    expect(() => resolveSelection({ bundles: [], modules: ['imaginary'] })).toThrow(
      /Unknown module/u,
    );
  });

  it('orders dependencies before dependent adoption stages', () => {
    const selected = resolveSelection({ bundles: ['typescript-library'], modules: [] });
    expect(selected.moduleIds.indexOf('core')).toBeLessThan(
      selected.moduleIds.indexOf('typescript-node'),
    );
    expect(selected.moduleIds.indexOf('github')).toBeLessThan(
      selected.moduleIds.indexOf('freshness'),
    );
  });

  it('renders every built-in template without unresolved fields', () => {
    for (const name of templateNames()) {
      const rendered = renderTemplate(name, {
        projectName: 'example-library',
        description: 'A synthetic project.',
        licenseHolder: 'Example Authors',
      });
      expect(rendered).not.toMatch(/\{\{(?:project|description|license|year)/u);
      expect(rendered.endsWith('\n')).toBe(true);
      if (name === 'typescript/package-json') expect(() => JSON.parse(rendered)).not.toThrow();
    }
  });

  it('keeps the TypeScript baseline on Oxlint without forbidden styling dependencies', () => {
    const module = getBuiltInModule('typescript-node');
    expect(module.artifacts.map(({ path }) => path)).toContain('oxlint.json');
    expect(module.artifacts.map(({ path }) => path)).not.toContain('prettier.config.mjs');

    const manifest = JSON.parse(
      renderTemplate('typescript/package-json', {
        projectName: 'example-library',
        description: 'A synthetic project.',
        licenseHolder: 'Example Authors',
      }),
    ) as {
      scripts: Readonly<Record<string, string>>;
      devDependencies: Readonly<Record<string, string>>;
    };
    expect(manifest.scripts).not.toHaveProperty('format:check');
    expect(manifest.scripts.lint).toBe('oxlint --deny-warnings .');
    expect(manifest.devDependencies).toHaveProperty('oxlint');
    expect(manifest.devDependencies).not.toHaveProperty('prettier');
    expect(manifest.devDependencies).not.toHaveProperty('tailwindcss');
  });

  it('tells coding agents not to introduce Prettier or Tailwind', () => {
    const module = getBuiltInModule('agents');
    expect(module.artifacts.map(({ path }) => path)).toEqual(['AGENTS.md', 'CLAUDE.md']);

    const guide = renderTemplate('agents/root', {
      projectName: 'example-library',
      description: 'A synthetic project.',
      licenseHolder: 'Example Authors',
    });
    expect(guide).toContain('Do not add Prettier');
    expect(guide).toContain('Do not add Tailwind');

    const claudeGuide = renderTemplate('agents/claude', {
      projectName: 'example-library',
      description: 'A synthetic project.',
      licenseHolder: 'Example Authors',
    });
    expect(claudeGuide).toBe('@AGENTS.md\n');
  });
});
