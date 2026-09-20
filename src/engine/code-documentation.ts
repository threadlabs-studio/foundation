import type { RepositorySnapshot } from '../adapters/filesystem.js';
import type {
  CodeDocumentationConfig,
  CodeDocumentationDimension,
  CodeDocumentationHotspot,
} from '../domain/config.js';
import type { Finding } from '../domain/finding.js';

const dimensionHeadings: Readonly<Record<CodeDocumentationDimension, string>> = {
  invariant: 'invariant',
  algorithm: 'algorithm',
  'platform-boundary': 'platform-boundary',
  performance: 'performance',
  security: 'security',
  lifecycle: 'lifecycle',
  rationale: 'rationale',
};

function finding(
  state: Finding['state'],
  title: string,
  explanation: string,
  evidence: readonly string[],
): Finding {
  return {
    controlId: 'code-documentation.baseline',
    state,
    title,
    explanation,
    evidence,
    confidenceGain: state === 'conformant' ? 'low' : 'high',
    estimatedCiSeconds: 0,
    migrationRisk: 'low',
    humanEffort: state === 'conformant' ? 'low' : 'medium',
  };
}

function markdownAnchor(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/gu, '')
    .replace(/[^a-z0-9 _-]/gu, '')
    .replace(/[ _]+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '');
}

interface MarkdownSection {
  readonly level: number;
  readonly body: string;
}

function markdownSection(content: string, anchor: string): MarkdownSection | undefined {
  const headings = [...content.matchAll(/^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/gmu)].map(
    (match) => ({
      level: match[1]!.length,
      anchor: markdownAnchor(match[2]!),
      start: match.index!,
      bodyStart: match.index! + match[0].length,
    }),
  );
  const index = headings.findIndex((heading) => heading.anchor === anchor);
  if (index < 0) return undefined;
  const heading = headings[index]!;
  const next = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level);
  return { level: heading.level, body: content.slice(heading.bodyStart, next?.start) };
}

function subsectionAnchors(section: MarkdownSection): ReadonlySet<string> {
  return new Set(
    [...section.body.matchAll(/^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/gmu)]
      .filter((match) => match[1]!.length > section.level)
      .map((match) => markdownAnchor(match[2]!)),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function auditHotspot(
  snapshot: RepositorySnapshot,
  hotspot: CodeDocumentationHotspot,
): Finding {
  const evidence: string[] = [];
  const source = snapshot.files.get(hotspot.source);
  if (source === undefined) {
    evidence.push(`missing-source:${hotspot.source}`);
  } else {
    const symbol = new RegExp(`\\b${escapeRegExp(hotspot.symbol)}\\b`, 'u');
    if (!symbol.test(source)) evidence.push(`missing-symbol:${hotspot.source}#${hotspot.symbol}`);
    const marker = new RegExp(`@docs[ \\t]+${escapeRegExp(hotspot.id)}(?:\\s|\\*|$)`, 'u');
    if (!marker.test(source)) evidence.push(`missing-marker:${hotspot.source}#${hotspot.id}`);
  }

  const [documentationPath, anchor] = hotspot.documentation.split('#', 2) as [string, string];
  const design = snapshot.files.get(documentationPath);
  if (design === undefined) {
    evidence.push(`missing-documentation:${documentationPath}`);
  } else {
    const section = markdownSection(design, anchor);
    if (section === undefined) {
      evidence.push(`missing-anchor:${hotspot.documentation}`);
    } else {
      const headings = subsectionAnchors(section);
      for (const dimension of hotspot.dimensions) {
        if (!headings.has(dimensionHeadings[dimension])) {
          evidence.push(`missing-dimension:${hotspot.documentation}:${dimension}`);
        }
      }
      if (!headings.has('verification')) {
        evidence.push(`missing-verification:${hotspot.documentation}`);
      }
    }
  }
  for (const test of hotspot.tests) {
    if (!snapshot.files.has(test)) evidence.push(`missing-test:${test}`);
  }

  return evidence.length === 0
    ? finding(
        'conformant',
        `Documentation hotspot ${hotspot.id} is linked`,
        'The declared source marker, design dimensions, and verification evidence are present.',
        [`hotspot:${hotspot.id}`, `source:${hotspot.source}`, `documentation:${hotspot.documentation}`],
      )
    : finding(
        'gap',
        `Documentation hotspot ${hotspot.id} has drifted`,
        'A declared explanatory contract no longer resolves to its source, design narrative, or evidence.',
        evidence,
      );
}

export function auditCodeDocumentation(
  snapshot: RepositorySnapshot,
  documentation: CodeDocumentationConfig | undefined,
): readonly Finding[] {
  if (documentation === undefined) {
    return [
      finding(
        'gap',
        'Documentation hotspot map is missing',
        'Select hotspots only after their explanations have been written and reviewed.',
        ['config:documentation.hotspots'],
      ),
    ];
  }
  if (documentation.hotspots.length === 0) {
    return [
      finding(
        'conformant',
        'No documentation hotspots are declared',
        'The repository has not yet declared any non-obvious implementation hotspot.',
        ['hotspots:0'],
      ),
    ];
  }
  return documentation.hotspots.map((hotspot) => auditHotspot(snapshot, hotspot));
}
