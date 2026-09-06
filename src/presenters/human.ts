import type { CommandResult } from '../commands/types.js';

export function presentHuman(result: CommandResult): string {
  const lines = [result.summary];
  if (Array.isArray(result.data)) {
    for (const item of result.data) {
      if (typeof item === 'object' && item !== null && 'id' in item && 'title' in item) {
        lines.push(`  ${String(item.id)} — ${String(item.title)}`);
      }
    }
  }
  if (typeof result.data === 'object' && result.data !== null && 'digest' in result.data) {
    lines.push(`Plan digest: ${String((result.data as { digest: unknown }).digest)}`);
  }
  if (typeof result.data === 'object' && result.data !== null && 'findings' in result.data) {
    const findings = (
      result.data as {
        findings?: readonly {
          state: string;
          controlId: string;
          title: string;
          estimatedCiSeconds: number;
          migrationRisk: string;
          humanEffort: string;
          evidence: readonly string[];
        }[];
      }
    ).findings;
    for (const finding of findings ?? []) {
      lines.push(
        `  [${finding.state}] ${finding.controlId} — ${finding.title}`,
        `    CI ~${finding.estimatedCiSeconds}s; migration ${finding.migrationRisk}; effort ${finding.humanEffort}; ${finding.evidence.join(', ')}`,
      );
    }
  }
  if (typeof result.data === 'object' && result.data !== null && 'checks' in result.data) {
    const checks = (
      result.data as {
        checks?: readonly { id?: string; controlId?: string; state: string; details?: string }[];
      }
    ).checks;
    for (const check of checks ?? []) {
      lines.push(
        `  [${check.state}] ${check.id ?? check.controlId ?? 'check'}${check.details === undefined ? '' : ` — ${check.details}`}`,
      );
    }
  }
  if (typeof result.data === 'object' && result.data !== null && 'results' in result.data) {
    const results = (
      result.data as {
        results?: readonly {
          name: string;
          result: { state: string; current: string; latest?: string; heldReason?: string };
          hold?: { owner: string; reviewDate: string };
        }[];
      }
    ).results;
    for (const item of results ?? []) {
      const hold =
        item.result.heldReason === undefined
          ? ''
          : ` — ${item.result.heldReason}; owner ${item.hold?.owner ?? 'unknown'}; review ${item.hold?.reviewDate ?? 'unknown'}`;
      lines.push(
        `  [${item.result.state}] ${item.name} ${item.result.current}${item.result.latest === undefined ? '' : ` -> ${item.result.latest}`}${hold}`,
      );
    }
  }
  if (typeof result.data === 'object' && result.data !== null && 'runtimes' in result.data) {
    const runtimes = (
      result.data as {
        runtimes?: readonly {
          name: string;
          lifecycle: string;
          result: { state: string };
        }[];
      }
    ).runtimes;
    for (const runtime of runtimes ?? []) {
      lines.push(`  [${runtime.result.state}] ${runtime.name} — ${runtime.lifecycle}`);
    }
  }
  if (typeof result.data === 'object' && result.data !== null && 'selection' in result.data) {
    const selection = (
      result.data as {
        selection?: {
          modules: readonly {
            id: string;
            controls: readonly { lane: string; expectedSeconds: number }[];
          }[];
          estimatedSecondsByLane: Readonly<Record<string, number>>;
        };
      }
    ).selection;
    if (selection !== undefined) {
      lines.push('Selected modules:');
      for (const module of selection.modules) {
        const cost = module.controls.reduce((total, control) => total + control.expectedSeconds, 0);
        const lanes = [...new Set(module.controls.map(({ lane }) => lane))].join(', ');
        lines.push(`  ${module.id}: ${lanes}, ~${cost}s`);
      }
      const totals = Object.entries(selection.estimatedSecondsByLane)
        .map(([lane, seconds]) => `${lane} ~${seconds}s`)
        .join(', ');
      lines.push(`Estimated lane totals: ${totals}`);
    }
  }
  if (typeof result.data === 'object' && result.data !== null && 'controls' in result.data) {
    const module = result.data as {
      id?: string;
      title?: string;
      controls?: readonly {
        id: string;
        lane: string;
        cost: { expectedSeconds: number };
        applicability: string;
      }[];
    };
    if (module.id !== undefined && module.title !== undefined) {
      lines.push(`  ${module.id} — ${module.title}`);
    }
    for (const control of module.controls ?? []) {
      lines.push(
        `  ${control.id}: ${control.lane}, ~${control.cost.expectedSeconds}s — ${control.applicability}`,
      );
    }
  }
  if (typeof result.data === 'object' && result.data !== null && 'effects' in result.data) {
    for (const effect of (result.data as { effects: readonly { path: string }[] }).effects) {
      lines.push(`  ${effect.path}`);
    }
  }
  if (typeof result.data === 'object' && result.data !== null && 'next' in result.data) {
    const next = (
      result.data as {
        next?: {
          workingDirectory?: unknown;
          executable?: unknown;
          arguments?: readonly unknown[];
        };
      }
    ).next;
    if (
      typeof next?.executable === 'string' &&
      Array.isArray(next.arguments) &&
      next.arguments.every((argument) => typeof argument === 'string')
    ) {
      const printable = [next.executable, ...next.arguments].map((argument) =>
        /^[A-Za-z0-9_./:@=<>-]+$/u.test(argument) ? argument : JSON.stringify(argument),
      );
      const location =
        typeof next.workingDirectory === 'string' ? ` (from ${next.workingDirectory})` : '';
      lines.push(`Next${location}: ${printable.join(' ')}`);
    }
  }
  return `${lines.join('\n')}\n`;
}
