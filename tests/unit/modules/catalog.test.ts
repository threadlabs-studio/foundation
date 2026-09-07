import { describe, expect, it } from 'vitest';

import {
  BUILT_IN_MODULE_IDS,
  getBuiltInModule,
  resolveSelection,
  TYPESCRIPT_LIBRARY_BUNDLE,
} from '../../../src/modules/catalog.js';
import { renderTemplate, templateNames } from '../../../src/templates/index.js';

function cssRules(source: string): Array<{ selector: string; declarationBlock: string }> {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/gu)]
    .map((match) => ({
      selector: (match[1] ?? '').replace(/\s+/gu, ' ').trim(),
      declarationBlock: (match[2] ?? '').replace(/\s+/gu, ' ').trim(),
    }))
    .filter(({ selector }) => selector.length > 0 && !selector.startsWith('@'));
}

function assertSafeWebReset(reset: string): void {
  const rules = cssRules(reset);
  expect(rules.map(({ selector }) => selector)).toEqual([
    '*, *::before, *::after',
    'html',
    'body',
    ':where(h1, h2, h3, h4, h5, h6, p, ul, ol, menu, figure, blockquote, dl, dd)',
    ':where(button, input, optgroup, select, textarea)',
    ':where(img, picture, video, canvas)',
    ':where(img, video)',
  ]);
  expect(rules[0]?.declarationBlock).toBe('box-sizing: border-box;');
  expect(rules.map(({ selector }) => selector).join(', ')).not.toMatch(
    /\b[a-z][a-z0-9]*-[a-z0-9-]*\b/u,
  );
}

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
      'web-css-reset',
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

  it('keeps the web reset low-specificity and custom-element safe', () => {
    const reset = renderTemplate('web/reset-css', {
      projectName: 'example-web-app',
      description: 'A synthetic web application.',
      licenseHolder: 'Example Authors',
    });

    expect(reset).toContain('@layer reset');
    assertSafeWebReset(reset);
    expect(reset).toContain(':where(h1, h2, h3, h4, h5, h6, p, ul, ol, menu');
    expect(reset).toContain(':where(button, input, optgroup, select, textarea)');
  });

  it('rejects destructive reset mutations and custom-element selectors', () => {
    const reset = renderTemplate('web/reset-css', {
      projectName: 'example-web-app',
      description: 'A synthetic web application.',
      licenseHolder: 'Example Authors',
    });
    const beforeLayerClose = (rule: string): string => reset.replace(/\n\}\n$/u, `\n${rule}\n}\n`);

    expect(() =>
      assertSafeWebReset(
        reset.replace('box-sizing: border-box;', 'box-sizing: border-box; border: 0;'),
      ),
    ).toThrow();
    expect(() =>
      assertSafeWebReset(
        reset.replace('box-sizing: border-box;', 'box-sizing: border-box; border: 0'),
      ),
    ).toThrow();
    expect(() =>
      assertSafeWebReset(
        reset.replace('box-sizing: border-box;', 'box-sizing: border-box; background: none;'),
      ),
    ).toThrow();
    expect(() =>
      assertSafeWebReset(
        reset.replace('box-sizing: border-box;', 'box-sizing: border-box; font: inherit;'),
      ),
    ).toThrow();
    expect(() =>
      assertSafeWebReset(beforeLayerClose('  :where(my-widget) { margin: 0; }')),
    ).toThrow();
    expect(() =>
      assertSafeWebReset(beforeLayerClose('  my-widget:hover { padding: 0; }')),
    ).toThrow();
    expect(() =>
      assertSafeWebReset(
        beforeLayerClose('  input { box-sizing: border-box; }').replace(
          'box-sizing: border-box;',
          'color: inherit;',
        ),
      ),
    ).toThrow();
  });
});
