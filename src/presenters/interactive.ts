import { checkbox, input } from '@inquirer/prompts';

import { BUILT_IN_MODULE_IDS } from '../modules/catalog.js';

export async function enrichInteractiveArguments(
  arguments_: readonly string[],
): Promise<readonly string[]> {
  if (arguments_[0] !== 'init' || arguments_.includes('--json') || !process.stdin.isTTY)
    return arguments_;
  const result = [...arguments_];
  if (!arguments_.includes('--name')) {
    result.push('--name', await input({ message: 'Package name' }));
  }
  if (!arguments_.includes('--bundle') && !arguments_.includes('--module')) {
    const selected = await checkbox({
      message: 'Optional modules (the TypeScript library bundle is the recommended default)',
      choices: BUILT_IN_MODULE_IDS.map((value) => ({ name: value, value })),
    });
    if (selected.length === 0) result.push('--bundle', 'typescript-library');
    else selected.forEach((module) => result.push('--module', module));
  }
  return result;
}
