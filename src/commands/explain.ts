import { allBuiltInModules, getBuiltInModule } from '../modules/catalog.js';
import type { CommandOptions, CommandResult } from './types.js';

export function explainCommand(options: CommandOptions): CommandResult {
  const subject = options.subject;
  const data =
    subject === undefined || subject.startsWith('/')
      ? allBuiltInModules().map(({ id, title, description }) => ({ id, title, description }))
      : getBuiltInModule(subject);
  return {
    command: 'explain',
    status: 'success',
    exitClass: 'success',
    summary:
      subject === undefined
        ? 'Available Foundation modules.'
        : `Foundation explanation for ${subject}.`,
    data,
  };
}
